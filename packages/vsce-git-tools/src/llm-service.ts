export interface LLMConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  owned_by?: string;
}

export interface ToolDef {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export async function fetchModels(config: LLMConfig): Promise<ModelInfo[]> {
  const url = config.baseUrl.replace(/\/+$/, "") + "/models";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.apiKey) headers["Authorization"] = `Bearer ${config.apiKey}`;

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  const body = await res.json() as { data?: ModelInfo[] };
  return body.data ?? [];
}

export interface ChatMsg {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  name?: string;
}

export interface ChatOpts {
  messages: ChatMsg[];
  tools?: ToolDef[];
  stream?: boolean;
  signal?: AbortSignal;
}

export interface ToolCallChunk {
  id: string;
  name: string;
  args: string;
  index: number;
}

export function parseSSELine(line: string): object | null {
  if (!line.startsWith("data: ")) return null;
  const payload = line.slice(6).trim();
  if (payload === "[DONE]") return null;
  try { return JSON.parse(payload); } catch { return null; }
}

export async function* streamChat(config: LLMConfig, opts: ChatOpts): AsyncGenerator<{
  type: "text" | "tool_call" | "done";
  text?: string;
  toolCall?: ToolCallChunk;
}> {
  const url = config.baseUrl.replace(/\/+$/, "") + "/chat/completions";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.apiKey) headers["Authorization"] = `Bearer ${config.apiKey}`;

  const body: Record<string, unknown> = {
    model: config.model,
    messages: opts.messages,
    stream: true,
  };
  if (opts.tools?.length) body.tools = opts.tools;
  if (opts.signal) body.signal = undefined;

  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal: opts.signal });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`LLM API error HTTP ${res.status}: ${errText || res.statusText}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const parsed = parseSSELine(line);
      if (!parsed) continue;
      const chunk = parsed as Record<string, unknown>;
      const choices = chunk.choices as Array<Record<string, unknown>> | undefined;
      if (!choices?.length) continue;
      const delta = choices[0].delta as Record<string, unknown> | undefined;
      if (!delta) continue;

      if (delta.content) {
        yield { type: "text", text: String(delta.content) };
      }

      const tcs = delta.tool_calls as Array<Record<string, unknown>> | undefined;
      if (tcs) {
        for (const tc of tcs) {
          const fn = tc.function as Record<string, unknown> | undefined;
          yield {
            type: "tool_call",
            toolCall: {
              id: String(tc.id ?? ""),
              name: String(fn?.name ?? ""),
              args: String(fn?.arguments ?? ""),
              index: (tc.index as number) ?? 0,
            },
          };
        }
      }
    }
  }

  yield { type: "done" };
}

export async function chatNonStreaming(config: LLMConfig, opts: ChatOpts): Promise<{
  text: string;
  toolCalls?: ToolCallChunk[];
}> {
  const url = config.baseUrl.replace(/\/+$/, "") + "/chat/completions";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.apiKey) headers["Authorization"] = `Bearer ${config.apiKey}`;

  const body: Record<string, unknown> = {
    model: config.model,
    messages: opts.messages,
    stream: false,
  };
  if (opts.tools?.length) body.tools = opts.tools;

  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as Record<string, unknown>;
  const choice = (data.choices as Array<Record<string, unknown>>)?.[0];
  const msg = choice?.message as Record<string, unknown> | undefined;

  const text = String(msg?.content ?? "");
  const rawTcs = msg?.tool_calls as Array<Record<string, unknown>> | undefined;
  const toolCalls: ToolCallChunk[] = (rawTcs ?? []).map((tc, i) => {
    const fn = tc.function as Record<string, unknown> | undefined;
    return {
      id: String(tc.id ?? ""),
      name: String(fn?.name ?? ""),
      args: String(fn?.arguments ?? "{}"),
      index: i,
    };
  });

  return { text, toolCalls: toolCalls.length ? toolCalls : undefined };
}

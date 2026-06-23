import * as vscode from "vscode";
import type { LLMConfig, ToolCallChunk, ChatMsg } from "./llm-service.js";
import { fetchModels, streamChat, chatNonStreaming } from "./llm-service.js";

const LLM_CONFIG_KEY = "git-tools-llm.config";

export function getConfig(): LLMConfig | undefined {
  const c = vscode.workspace.getConfiguration("git-tools");
  const baseUrl = c.get<string>("baseUrl");
  const apiKey = c.get<string>("apiKey", "");
  const model = c.get<string>("model");
  if (!baseUrl || !model) return;
  return { baseUrl, apiKey, model };
}

export function getRawSdkConfig(): { baseUrl: string; apiKey: string; model: string } {
  const c = vscode.workspace.getConfiguration("git-tools");
  return {
    baseUrl: c.get<string>("baseUrl", ""),
    apiKey: c.get<string>("apiKey", ""),
    model: c.get<string>("model", ""),
  };
}

export async function setConfig(config: LLMConfig): Promise<void> {
  const target = vscode.ConfigurationTarget.Global;
  await vscode.workspace.getConfiguration("git-tools").update("baseUrl", config.baseUrl, target);
  await vscode.workspace.getConfiguration("git-tools").update("apiKey", config.apiKey, target);
  await vscode.workspace.getConfiguration("git-tools").update("model", config.model, target);
}

export class LlamaProvider implements vscode.LanguageModelChatProvider<vscode.LanguageModelChatInformation> {
  onDidChangeLanguageModelChatInformation?: vscode.Event<void>;
  private _onDidChange = new vscode.EventEmitter<void>();

  constructor() {
    this.onDidChangeLanguageModelChatInformation = this._onDidChange.event;
    // Fire when config changes
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration("git-tools")) {
        this._onDidChange.fire();
      }
    });
  }

  async provideLanguageModelChatInformation(
    _options: vscode.PrepareLanguageModelChatModelOptions,
    _token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelChatInformation[]> {
    const cfg = getConfig();
    if (!cfg) return [];

    let models: Array<{ id: string; name: string }> = [];
    try {
      const fetched = await fetchModels(cfg);
      models = fetched.map(m => ({ id: m.id, name: m.name || m.id }));
    } catch {
      // If model listing fails, still try with the configured model
      models = [{ id: cfg.model, name: cfg.model }];
    }

    // If fetched models don't include the configured one, add it
    if (models.length > 1 && !models.some(m => m.id === cfg.model)) {
      models.push({ id: cfg.model, name: cfg.model });
    }

    return models.map(m => ({
      id: m.id,
      name: m.name,
      family: "llama",
      version: "1",
      maxInputTokens: 128_000,
      maxOutputTokens: 16_384,
      tooltip: `Local LLM via ${cfg.baseUrl}`,
      detail: cfg.baseUrl.replace(/\/+$/, ""),
      capabilities: {
        toolCalling: true,
        imageInput: false,
      },
    }));
  }

  async provideLanguageModelChatResponse(
    model: vscode.LanguageModelChatInformation,
    messages: readonly vscode.LanguageModelChatRequestMessage[],
    options: vscode.ProvideLanguageModelChatResponseOptions,
    progress: vscode.Progress<vscode.LanguageModelResponsePart>,
    token: vscode.CancellationToken
  ): Promise<void> {
    const cfg = getConfig();
    if (!cfg) throw new Error("Git Tools LLM not configured");

    const msgs: ChatMsg[] = [];

    for (const msg of messages) {
      if (msg.role === vscode.LanguageModelChatMessageRole.User) {
        const textParts = msg.content.filter(c => c instanceof vscode.LanguageModelTextPart) as vscode.LanguageModelTextPart[];
        const toolParts = msg.content.filter(c => c instanceof vscode.LanguageModelToolResultPart) as vscode.LanguageModelToolResultPart[];

        if (toolParts.length > 0) {
          for (const tp of toolParts) {
            const txt = tp.content.filter(c => c instanceof vscode.LanguageModelTextPart).map(c => (c as vscode.LanguageModelTextPart).value).join(" ");
            msgs.push({ role: "tool", content: txt, tool_call_id: tp.callId } as ChatMsg);
          }
        }

        if (textParts.length > 0) {
          msgs.push({ role: "user", content: textParts.map(t => t.value).join("\n") } as ChatMsg);
        }
      } else if (msg.role === vscode.LanguageModelChatMessageRole.Assistant) {
        const textParts = msg.content.filter(c => c instanceof vscode.LanguageModelTextPart) as vscode.LanguageModelTextPart[];
        const callParts = msg.content.filter(c => c instanceof vscode.LanguageModelToolCallPart) as vscode.LanguageModelToolCallPart[];

        const asst: ChatMsg = { role: "assistant", content: null };
        if (textParts.length) asst.content = textParts.map(t => t.value).join("\n");
        if (callParts.length) {
          asst.tool_calls = callParts.map(cp => ({
            id: cp.callId,
            type: "function",
            function: { name: cp.name, arguments: JSON.stringify(cp.input) },
          }));
        }
        msgs.push(asst);
      }
    }

    const llmTools = (options.tools ?? []).map(t => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: (t.inputSchema ?? { type: "object", properties: {} }) as Record<string, unknown>,
      },
    }));

    let pendingToolCalls = new Map<number, ToolCallChunk>();

    const stream = streamChat({ ...cfg, model: model.id }, {
      messages: msgs,
      tools: llmTools,
      stream: true,
      signal: token.isCancellationRequested ? undefined : undefined,
    });

    const abortListener = token.onCancellationRequested(() => {
      // The loop will check token and exit
    });

    try {
      for await (const chunk of stream) {
        if (token.isCancellationRequested) break;

        if (chunk.type === "text") {
          progress.report(new vscode.LanguageModelTextPart(chunk.text!));
        } else if (chunk.type === "tool_call" && chunk.toolCall) {
          const idx = chunk.toolCall.index;
          const existing = pendingToolCalls.get(idx);
          if (existing) {
            if (chunk.toolCall.name) existing.name = chunk.toolCall.name;
            if (chunk.toolCall.args) existing.args += chunk.toolCall.args;
            if (chunk.toolCall.id) existing.id = chunk.toolCall.id;
          } else {
            pendingToolCalls.set(idx, { ...chunk.toolCall });
          }
        }
      }
    } finally {
      abortListener.dispose();
    }

    // Report accumulated tool calls
    for (const tc of pendingToolCalls.values()) {
      let input: object;
      try { input = JSON.parse(tc.args); } catch { input = {}; }
      progress.report(new vscode.LanguageModelToolCallPart(tc.id, tc.name, input));
    }
  }

  async provideTokenCount(
    _model: vscode.LanguageModelChatInformation,
    text: string | vscode.LanguageModelChatRequestMessage,
    _token: vscode.CancellationToken
  ): Promise<number> {
    const str = typeof text === "string" ? text : text.content.map(c => {
      if (c instanceof vscode.LanguageModelTextPart) return c.value;
      return "";
    }).join(" ");
    return Math.ceil(str.length / 4);
  }
}

import * as vscode from "vscode";
import { getRawSdkConfig, setConfig } from "./llm-provider.js";
import { fetchModels, chatNonStreaming } from "./llm-service.js";

export class LlamaConfigViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "git-tools.llmConfig";
  private _view?: vscode.WebviewView;

  constructor(private readonly _ctx: vscode.ExtensionContext) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this._getHtml();

    webviewView.webview.onDidReceiveMessage(async (msg) => {
      switch (msg.type) {
        case "save": {
          try {
            await setConfig(msg.config);
            webviewView.webview.postMessage({ type: "init", config: msg.config });
            webviewView.webview.postMessage({ type: "status", text: "✅ Saved", ok: true });
          } catch (e) {
            webviewView.webview.postMessage({ type: "status", text: `❌ Save failed: ${e instanceof Error ? e.message : e}`, ok: false });
          }
          break;
        }
        case "test": {
          try {
            const models = await fetchModels(msg.config);
            if (models.length === 0) {
              webviewView.webview.postMessage({ type: "status", text: "⚠️ Connected but no models returned", ok: true });
              return;
            }
            webviewView.webview.postMessage({ type: "models", models: models.map(m => m.id) });
            webviewView.webview.postMessage({ type: "status", text: "⏳ Testing model availability...", ok: true });
            // Test the model actually responds
            try {
              const result = await chatNonStreaming(msg.config, {
                messages: [{ role: "system", content: "respond with exactly: OK" }],
              });
              if (result.text.trim() === "OK") {
                webviewView.webview.postMessage({ type: "status", text: `✅ Model "${msg.config.model}" ready`, ok: true });
              } else {
                webviewView.webview.postMessage({ type: "status", text: `⚠️ Model responded but unexpected: "${result.text.slice(0, 50)}"`, ok: true });
              }
            } catch {
              webviewView.webview.postMessage({ type: "status", text: `❌ Model "${msg.config.model}" not responding (not loaded/slotted)`, ok: false });
            }
          } catch (e) {
            webviewView.webview.postMessage({ type: "status", text: `❌ Connection failed: ${e instanceof Error ? e.message : e}`, ok: false });
          }
          break;
        }
        case "refreshModels": {
          try {
            const models = await fetchModels(msg.config);
            webviewView.webview.postMessage({ type: "models", models: models.map(m => m.id) });
            webviewView.webview.postMessage({ type: "status", text: `✅ ${models.length} models found`, ok: true });
          } catch (e) {
            webviewView.webview.postMessage({ type: "status", text: `❌ ${e instanceof Error ? e.message : e}`, ok: false });
          }
          break;
        }
      }
    });
  }

  private _getHtml(): string {
    const cfg = getRawSdkConfig();
    const baseUrl = cfg.baseUrl || "http://127.0.0.1:8080/v1";
    const apiKey = cfg.apiKey || "";
    const model = cfg.model || "";

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
body { font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); padding: 12px; color: var(--vscode-foreground); }
label { display: block; margin: 8px 0 4px; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: .5px; color: var(--vscode-descriptionForeground); }
input, select { width: 100%; padding: 6px 8px; border: 1px solid var(--vscode-input-border); background: var(--vscode-input-background); color: var(--vscode-input-foreground); border-radius: 2px; box-sizing: border-box; }
input:focus, select:focus { outline: 1px solid var(--vscode-focusBorder); }
.btn-row { display: flex; gap: 8px; margin: 12px 0; }
button { flex: 1; padding: 6px 12px; border: none; border-radius: 2px; cursor: pointer; font-size: var(--vscode-font-size); }
button:disabled { opacity: .5; cursor: not-allowed; }
.btn-primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
.btn-primary:hover:not(:disabled) { background: var(--vscode-button-hoverBackground); }
.btn-secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
.btn-secondary:hover:not(:disabled) { background: var(--vscode-button-secondaryHoverBackground); }
#status { margin: 8px 0; padding: 6px 8px; border-radius: 2px; font-size: 12px; white-space: pre-wrap; word-break: break-all; }
#modelList { margin: 8px 0; max-height: 200px; overflow-y: auto; font-size: 12px; }
#modelError { color: var(--vscode-errorForeground); font-size: 11px; margin: 2px 0 0; display: none; }
select { margin: 4px 0; }
</style>
</head>
<body>
  <label>Base URL</label>
  <input id="baseUrl" type="url" value="${baseUrl}" placeholder="http://127.0.0.1:8080/v1" />

  <label>API Key (optional)</label>
  <input id="apiKey" type="password" value="${apiKey}" placeholder="sk-..." />

  <label>Model</label>
  <div style="display:flex; gap:4px;">
    <input id="model" type="text" value="${model}" placeholder="llama3.2" style="flex:1" />
    <button id="refreshBtn" class="btn-secondary" style="flex:0; padding:6px 8px;" title="Refresh model list">↻</button>
  </div>
  <div id="modelError">Model is required</div>
  <div id="modelList"></div>

  <div class="btn-row">
    <button id="testBtn" class="btn-secondary">Test</button>
    <button id="saveBtn" class="btn-primary">Save</button>
  </div>

  <div id="status"></div>

<script>
const vscode = acquireVsCodeApi();
const baseUrlEl = document.getElementById('baseUrl');
const apiKeyEl = document.getElementById('apiKey');
const modelEl = document.getElementById('model');
const statusEl = document.getElementById('status');
const modelListEl = document.getElementById('modelList');
const modelErrorEl = document.getElementById('modelError');
const saveBtn = document.getElementById('saveBtn');
const testBtn = document.getElementById('testBtn');

function getFormConfig() {
  return { baseUrl: baseUrlEl.value, apiKey: apiKeyEl.value, model: modelEl.value };
}

function validate() {
  const modelVal = modelEl.value.trim();
  modelErrorEl.style.display = modelVal ? 'none' : 'block';
  saveBtn.disabled = !modelVal;
}
modelEl.addEventListener('input', validate);
validate();

saveBtn.addEventListener('click', () => {
  if (saveBtn.disabled) return;
  modelListEl.innerHTML = '';
  vscode.postMessage({ type: 'save', config: getFormConfig() });
});
testBtn.addEventListener('click', () => {
  testBtn.disabled = true;
  testBtn.textContent = 'Testing...';
  vscode.postMessage({ type: 'test', config: getFormConfig() });
});
document.getElementById('refreshBtn').addEventListener('click', () => {
  vscode.postMessage({ type: 'refreshModels', config: getFormConfig() });
});

window.addEventListener('message', e => {
  const msg = e.data;
  if (msg.type === 'status') {
    statusEl.textContent = msg.text;
    statusEl.style.color = msg.ok === undefined ? '' : msg.ok ? 'var(--vscode-testing-iconPassed)' : 'var(--vscode-testing-iconFailed)';
    testBtn.disabled = false;
    testBtn.textContent = 'Test';
    if (msg.ok) setTimeout(() => { if (statusEl.textContent === msg.text) statusEl.textContent = ''; }, 8000);
  } else if (msg.type === 'models') {
    const current = modelEl.value;
    modelListEl.innerHTML = '';
    const select = document.createElement('select');
    select.size = Math.min(msg.models.length, 8);
    msg.models.forEach(id => {
      const opt = document.createElement('option');
      opt.value = id; opt.textContent = id;
      if (id === current) opt.selected = true;
      select.appendChild(opt);
    });
    select.addEventListener('change', () => {
      modelEl.value = select.value;
      validate();
    });
    modelListEl.appendChild(select);
  }
});
</script>
</body>
</html>`;
  }
}

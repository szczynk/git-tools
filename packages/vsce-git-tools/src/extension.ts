import * as vscode from "vscode";
import type { GitExtension, Repository } from "./git.js";

let _channel: vscode.OutputChannel;

function channel(): vscode.OutputChannel {
  if (!_channel) _channel = vscode.window.createOutputChannel("Git Tools");
  return _channel;
}

function getRepo(): Repository | undefined {
  const ext = vscode.extensions.getExtension<GitExtension>("vscode.git")?.exports;
  if (!ext?.getAPI) return undefined;
  const api = ext.getAPI(1);
  return api.repositories[0];
}

export function activate(ctx: vscode.ExtensionContext) {
  channel().appendLine("git-tools activated");

  ctx.subscriptions.push(
    vscode.commands.registerCommand("git-tools.status", () => {
      const repo = getRepo();
      if (!repo) return vscode.window.showErrorMessage("No git repository found");
      void vscode.commands.executeCommand("git.status");
    }),

    vscode.commands.registerCommand("git-tools.restoreStaged", () => {
      const repo = getRepo();
      if (!repo) return vscode.window.showErrorMessage("No git repository found");
      repo.revertFiles(".", repo.state.workingTreeChanges, true);
      channel().show();
      channel().appendLine("Unstaged all changes");
    }),

    vscode.commands.registerCommand("git-tools.diff", () => {
      const repo = getRepo();
      if (!repo) return vscode.window.showErrorMessage("No git repository found");
      void vscode.commands.executeCommand("git.viewChange");
    }),

    vscode.commands.registerCommand("git-tools.diffNoCompact", () => {
      const repo = getRepo();
      if (!repo) return vscode.window.showErrorMessage("No git repository found");
      void vscode.commands.executeCommand("git.viewChange");
    }),

    vscode.commands.registerCommand("git-tools.formatMessage", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      const doc = editor.document;
      const text = doc.getText();
      vscode.window.showInputBox({ prompt: "Paste formatted commit message", value: text });
    }),
  );
}

export function deactivate() {}

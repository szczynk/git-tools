import type * as vscode from "vscode";

export interface GitExtension {
  readonly enabled: boolean;
  readonly git: Git;
  getAPI(version: 1): API;
}

export interface Git {
  readonly path: string;
}

export interface API {
  readonly state: State;
  readonly repositories: Repository[];
  readonly onDidOpenRepository: vscode.Event<Repository>;
  readonly onDidCloseRepository: vscode.Event<Repository>;
  readonly onDidChangeRepository: vscode.Event<Repository>;
}

export interface State {
  readonly repositories: Repository[];
}

export interface Repository {
  readonly rootUri: vscode.Uri;
  readonly inputBox: InputBox;
  readonly state: RepositoryState;
  readonly repository: GitResourceGroup;
  revertFiles(uri: string, changes: unknown[], staged: boolean): Promise<void>;
}

export interface InputBox {
  value: string;
}

export interface RepositoryState {
  readonly HEAD: Branch | undefined;
  readonly workingTreeChanges: unknown[];
  readonly indexChanges: unknown[];
  readonly mergeChanges: unknown[];
}

export interface Branch {
  readonly name: string;
  readonly upstream: string | undefined;
  readonly ahead: number;
  readonly behind: number;
}

export interface GitResourceGroup {
  readonly label: string;
  readonly id: string;
  readonly resourceStates: unknown[];
}

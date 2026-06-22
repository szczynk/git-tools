export interface GitFile {
  path: string;
  summary: string;
}

export interface FormatMessageParams {
  files: GitFile[];
  type: string;
  summary: string;
  scope?: string;
  body: string[];
  breaking?: boolean;
  breaking_description?: string;
}

export type FormatMessageResult = {
  ok: true;
  message: string;
  fileList: string;
  header: string;
} | {
  ok: false;
  error: string;
};

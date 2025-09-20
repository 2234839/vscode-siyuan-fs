import { type } from 'arktype';

// API Response Schema
export const ApiResponseSchema = type({
  code: "number",
  msg: "string",
  data: "unknown | null"
});

export type ApiResponse<T = unknown> = typeof ApiResponseSchema.infer & {
  data: T;
};

// Notebook Schema
export const NotebookSchema = type({
  id: "string",
  name: "string",
  icon: "string",
  sort: "number",
  closed: "boolean"
});

export type Notebook = typeof NotebookSchema.infer;

// File/Directory Info Schema
export const FileInfoSchema = type({
  isDir: "boolean",
  isSymlink: "boolean",
  name: "string",
  updated: "number"
});

export type FileInfo = typeof FileInfoSchema.infer;

// Block Kramdown Schema
export const BlockKramdownSchema = type({
  id: "string",
  kramdown: "string"
});

export type BlockKramdown = typeof BlockKramdownSchema.infer;

// Block Update Schema
export const BlockUpdateSchema = type({
  dataType: "'markdown' | 'dom'",
  data: "string",
  id: "string"
});

export type BlockUpdate = typeof BlockUpdateSchema.infer;

// Document Create Schema
export const DocumentCreateSchema = type({
  notebook: "string",
  path: "string",
  markdown: "string"
});

export type DocumentCreate = typeof DocumentCreateSchema.infer;

// Instance Configuration Schema
export const InstanceConfigSchema = type({
  id: "string",
  name: "string",
  url: "string",
  token: "string",
  enabled: "boolean = true"
});

export type InstanceConfig = typeof InstanceConfigSchema.infer;

// Virtual File Entry Schema
export const VirtualFileEntrySchema = type({
  name: "string",
  type: "'file' | 'directory'",
  "size?": "number",
  "lastModified?": "number",
  "id?": "string",
  path: "string",
  "notebookId?": "string"
});

export type VirtualFileEntry = typeof VirtualFileEntrySchema.infer;

// Error Types
export class SiyuanApiError extends Error {
  constructor(
    public code: number,
    message: string,
    public details?: unknown,
    public msg?: string
  ) {
    super(message);
    this.name = 'SiyuanApiError';
    this.msg = message;
  }
}

export class NetworkError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = 'ValidationError';
  }
}
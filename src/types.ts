// JSON-RPC 2.0

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: number | string | null;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number | string | null;
  result?: unknown;
  error?: JsonRpcError;
}

// MCP Server

export interface McpServer {
  handleMessage(message: unknown): Promise<JsonRpcResponse | null>;
}

// Tools

export interface ToolDefinition {
  name: string;
  title: string;
  description: string;
  inputSchema: JsonSchema;
  validate(args: unknown): Record<string, unknown>;
  execute(args: Record<string, unknown>): Promise<ToolResult>;
}

export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: unknown;
  isError?: boolean;
}

export interface JsonSchema {
  type: string;
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean | JsonSchema;
  [key: string]: unknown;
}

// Prompts

export interface PromptParameter {
  name: string;
  description?: string;
  required?: boolean;
}

export interface PromptDefinition {
  name: string;
  description?: string;
  arguments?: PromptParameter[];
}

export interface PromptMessage {
  role: "user";
  content: { type: "text"; text: string };
}

export interface PromptResponse {
  description?: string;
  messages: PromptMessage[];
}

// Obsidian Client

export interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  responseType?: "auto" | "json" | "text" | "none";
  requireAuth?: boolean;
}

export type PatchOperation = "append" | "prepend" | "replace" | "search-replace";
export type PatchTargetType = "heading" | "block" | "frontmatter";

export interface PatchArgs {
  filename?: string;
  operation: PatchOperation;
  targetType?: PatchTargetType;
  target: string;
  content: unknown;
  contentType?: string;
  targetDelimiter?: string;
  trimTargetWhitespace?: boolean;
  applyIfContentPreexists?: boolean;
  createTargetIfMissing?: boolean;
}

export interface SmartSearchFilter {
  folders?: string[];
  excludeFolders?: string[];
  limit?: number;
}

export interface FetchContentArgs {
  url: string;
  maxLength?: number;
  startIndex?: number;
  raw?: boolean;
}

export interface FetchContentResult {
  text: string;
  structuredContent: {
    url: string;
    contentType: string;
    totalLength: number;
    startIndex: number;
    endIndex: number;
    hasMore: boolean;
    raw: boolean;
  };
}

// Obsidian API note payload (format: "json")

export interface NotePayload {
  content: string;
  frontmatter: Record<string, unknown>;
  tags: string[];
}

export interface DataSet {
  sessionId: string;
  fileName: string;
  rawCsv: string;
  columns: ColumnInfo[];
  rows: Record<string, unknown>[];
  rowCount: number;
}

export interface ColumnInfo {
  name: string;
  type: string;
  sample: unknown[];
  nullCount: number;
  uniqueCount: number;
}

export interface AgentMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  output?: unknown;
}

export interface ChartSpec {
  type: "plotly";
  data: Record<string, unknown>[];
  layout: Record<string, unknown>;
  title: string;
}

export interface AnalysisResult {
  insight: string;
  charts: ChartSpec[];
  code: string;
  summary: string;
  reasoning?: string[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export type AgentState = "idle" | "uploading" | "analyzing" | "planning" | "rendering" | "chatting" | "error";

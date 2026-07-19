export interface AgentToolCall {
  id: string;
  name: string;
  /** JSON-encoded arguments, exactly as returned by the model. */
  arguments: string;
}

export interface AgentMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  /** Present on assistant messages that call one or more tools. */
  toolCalls?: AgentToolCall[];
  /** Present on tool-role messages -- links the result back to its call. */
  toolCallId?: string;
  /** Present on tool-role messages. */
  name?: string;
}

export type AgentToolResult = { success: true; result: unknown } | { error: string };

export interface AgentUsage {
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
}

export type AgentSendResult = { message: AgentMessage; usage?: AgentUsage } | { error: string };

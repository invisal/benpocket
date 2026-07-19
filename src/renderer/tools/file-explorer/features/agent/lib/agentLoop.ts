import type { AgentMessage, AgentToolCall } from '../../../../../../preload/file-explorer/api';
import { isMutatingTool } from './toolDescriptions';

export function splitToolCalls(calls: AgentToolCall[]): {
  readOnly: AgentToolCall[];
  mutating: AgentToolCall[];
} {
  const readOnly: AgentToolCall[] = [];
  const mutating: AgentToolCall[] = [];
  for (const call of calls) {
    (isMutatingTool(call.name) ? mutating : readOnly).push(call);
  }
  return { readOnly, mutating };
}

function toolResultMessage(call: AgentToolCall, result: unknown): AgentMessage {
  return {
    role: 'tool',
    content: JSON.stringify(result),
    toolCallId: call.id,
    name: call.name
  };
}

/** Runs a tool call through the main process and wraps the result as a tool-role message. */
export async function runToolCall(call: AgentToolCall): Promise<AgentMessage> {
  let args: unknown;
  try {
    args = JSON.parse(call.arguments);
  } catch {
    return toolResultMessage(call, { error: 'Could not parse tool arguments.' });
  }
  const result = await window.fileExplorer.agentExecuteTool(call.name, args);
  return toolResultMessage(call, result);
}

export function deniedToolMessage(call: AgentToolCall): AgentMessage {
  return toolResultMessage(call, { error: 'User denied this action.' });
}

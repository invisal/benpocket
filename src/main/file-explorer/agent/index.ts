import { ipcMain } from 'electron';
import { sendChatCompletion } from './client';
import { executeAgentTool } from './tools';
import type { AgentMessage, AgentSendResult, AgentToolResult } from './types';

export function registerAgentHandlers(): void {
  ipcMain.handle(
    'file-explorer:agent-send',
    async (_, messages: AgentMessage[]): Promise<AgentSendResult> => {
      return sendChatCompletion(messages);
    }
  );

  ipcMain.handle(
    'file-explorer:agent-execute-tool',
    async (_, name: string, args: unknown): Promise<AgentToolResult> => {
      return executeAgentTool(name, args);
    }
  );
}

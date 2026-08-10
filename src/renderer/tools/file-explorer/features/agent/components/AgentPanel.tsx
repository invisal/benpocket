import { useEffect, useRef, useState } from 'react';
import { Settings2 } from 'lucide-react';
import { Chat, type ChatPermissionStatus } from '@renderer/components/ui/Chat';
import { Button } from '@renderer/components/ui/Button';
import { useCloudflareSettings } from '@renderer/hooks/useCloudflareSettings';
import type { AgentMessage, AgentToolCall } from '../../../../../../preload/file-explorer/api';
import { deniedToolMessage, runToolCall, splitToolCalls } from '../lib/agentLoop';
import {
  AGENT_MODELS,
  calculateCost,
  getModelContextWindow,
  getModelPricing,
  type SessionUsage
} from '../lib/models';
import { describeToolCall } from '../lib/toolDescriptions';
import { ConnectAiGatewayDialog } from './ConnectAiGatewayDialog';

type TimelineItem =
  | { kind: 'text'; id: string; role: 'user' | 'assistant'; content: string }
  | { kind: 'approval'; id: string; call: AgentToolCall; status: ChatPermissionStatus }
  | { kind: 'tool-call'; id: string; call: AgentToolCall };

interface PendingTurn {
  /** Conversation up to and including the assistant message that requested these tool calls. */
  baseMessages: AgentMessage[];
  /** Tool result messages collected so far, keyed by tool_call id. */
  results: Map<string, AgentMessage>;
  /** Ids of mutating calls still awaiting a user decision. */
  remaining: Set<string>;
}

interface AgentPanelProps {
  workingDirectory: string | null;
}

function buildSystemPrompt(workingDirectory: string | null): string {
  return (
    `You are a file-management assistant embedded in a desktop file explorer. ` +
    `The user's current working directory is ${workingDirectory ?? 'unknown'}. ` +
    `When a path isn't specified, assume it's relative to this directory. Use the ` +
    `available tools to inspect and modify the filesystem -- mutating actions are ` +
    `gated behind the user's explicit approval before they run. When an action applies to ` +
    `multiple files or folders (renaming, moving, or deleting several entries), always pass ` +
    `all of them as a single call to the bulk tool (e.g. rename_entries, move_entries, ` +
    `delete_entries) instead of calling the tool once per item -- each tool call needs its ` +
    `own manual approval, so batching keeps the user from having to approve the same action ` +
    `dozens or hundreds of times.`
  );
}

const EMPTY_USAGE: SessionUsage = { promptTokens: 0, completionTokens: 0, cachedTokens: 0 };

export function AgentPanel({ workingDirectory }: AgentPanelProps) {
  const { isLoading, fields, gatewayConfigured, setFields } = useCloudflareSettings();
  const connected = isLoading ? null : gatewayConfigured;
  const modelId = fields.model || null;
  const [connectOpen, setConnectOpen] = useState(false);
  const [usage, setUsage] = useState<SessionUsage>(EMPTY_USAGE);
  // Size of the most recent request's conversation (prompt + completion tokens) --
  // unlike `usage`, this isn't cumulative: it reflects how full the *next* request's
  // context will be, not total spend across the session.
  const [contextTokens, setContextTokens] = useState<number | null>(null);
  // Excludes the system message -- that's derived fresh from `workingDirectoryRef`
  // on every send instead of living in state, so it always reflects panel 1's
  // current path (panel 2 has no navigation of its own while in Agent mode).
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const pendingTurnRef = useRef<PendingTurn | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const workingDirectoryRef = useRef(workingDirectory);

  useEffect(() => {
    workingDirectoryRef.current = workingDirectory;
  }, [workingDirectory]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [timeline]);

  const pricing = modelId ? getModelPricing(modelId) : null;
  const sessionCost = pricing ? calculateCost(usage, pricing) : null;
  const sessionTokens = usage.promptTokens + usage.completionTokens;
  const contextWindow = modelId ? getModelContextWindow(modelId) : null;

  async function runTurn(currentMessages: AgentMessage[]) {
    const systemMessage: AgentMessage = {
      role: 'system',
      content: buildSystemPrompt(workingDirectoryRef.current)
    };
    const response = await window.fileExplorer.agentSend([systemMessage, ...currentMessages]);

    if ('error' in response) {
      setTimeline((t) => [
        ...t,
        {
          kind: 'text',
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `Error: ${response.error}`
        }
      ]);
      setBusy(false);
      return;
    }

    const { message, usage: turnUsage } = response;
    if (turnUsage) {
      setUsage((prev) => ({
        promptTokens: prev.promptTokens + turnUsage.promptTokens,
        completionTokens: prev.completionTokens + turnUsage.completionTokens,
        cachedTokens: prev.cachedTokens + turnUsage.cachedTokens
      }));
      setContextTokens(turnUsage.promptTokens + turnUsage.completionTokens);
    }

    const withAssistant = [...currentMessages, message];
    setMessages(withAssistant);
    if (message.content) {
      setTimeline((t) => [
        ...t,
        {
          kind: 'text',
          id: crypto.randomUUID(),
          role: 'assistant',
          content: message.content as string
        }
      ]);
    }

    const toolCalls = message.toolCalls ?? [];
    if (toolCalls.length === 0) {
      setBusy(false);
      return;
    }

    const { readOnly, mutating } = splitToolCalls(toolCalls);
    if (readOnly.length > 0) {
      setTimeline((t) => [
        ...t,
        ...readOnly.map((call): TimelineItem => ({ kind: 'tool-call', id: call.id, call }))
      ]);
    }
    const results = new Map<string, AgentMessage>();
    for (const call of readOnly) {
      results.set(call.id, await runToolCall(call));
    }

    if (mutating.length === 0) {
      const toolMessages = toolCalls.map((call) => results.get(call.id)!);
      const nextMessages = [...withAssistant, ...toolMessages];
      setMessages(nextMessages);
      await runTurn(nextMessages);
      return;
    }

    pendingTurnRef.current = {
      baseMessages: withAssistant,
      results,
      remaining: new Set(mutating.map((call) => call.id))
    };
    setTimeline((t) => [
      ...t,
      ...mutating.map((call): TimelineItem => ({
        kind: 'approval',
        id: call.id,
        call,
        status: 'pending'
      }))
    ]);
    // busy stays true -- input remains disabled until every approval card resolves.
  }

  function resolvePending(
    call: AgentToolCall,
    message: AgentMessage,
    status: ChatPermissionStatus
  ) {
    setTimeline((t) =>
      t.map((item) =>
        item.kind === 'approval' && item.id === call.id ? { ...item, status } : item
      )
    );

    const pending = pendingTurnRef.current;
    if (!pending) return;
    pending.results.set(call.id, message);
    pending.remaining.delete(call.id);
    if (pending.remaining.size > 0) return;

    const lastAssistant = pending.baseMessages[pending.baseMessages.length - 1];
    const orderedCalls = lastAssistant.toolCalls ?? [];
    const toolMessages = orderedCalls.map((c) => pending.results.get(c.id)!);
    const nextMessages = [...pending.baseMessages, ...toolMessages];
    pendingTurnRef.current = null;
    setMessages(nextMessages);
    void runTurn(nextMessages);
  }

  async function handleApprove(call: AgentToolCall) {
    setTimeline((t) =>
      t.map((item) =>
        item.kind === 'approval' && item.id === call.id ? { ...item, status: 'running' } : item
      )
    );
    const message = await runToolCall(call);
    resolvePending(call, message, 'approved');
  }

  function handleDeny(call: AgentToolCall) {
    resolvePending(call, deniedToolMessage(call), 'denied');
  }

  function handleModelChange(nextModelId: string) {
    setFields({ model: nextModelId });
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || busy || !connected) return;

    setInput('');
    const userMessage: AgentMessage = { role: 'user', content: text };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setTimeline((t) => [
      ...t,
      { kind: 'text', id: crypto.randomUUID(), role: 'user', content: text }
    ]);
    setBusy(true);
    await runTurn(nextMessages);
  }

  if (connected === false) {
    return (
      <>
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground text-xs px-4 text-center">
          <span>Connect an AI Gateway to chat with the agent.</span>
          <Button variant="secondary" size="sm" onClick={() => setConnectOpen(true)}>
            <Settings2 size={14} />
            Connect AI Gateway
          </Button>
        </div>
        <ConnectAiGatewayDialog open={connectOpen} onOpenChange={setConnectOpen} />
      </>
    );
  }

  const lastItem = timeline[timeline.length - 1];
  const awaitingApproval = lastItem?.kind === 'approval' && lastItem.status === 'pending';
  const showThinking = busy && !awaitingApproval;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-end border-b border-border px-2 py-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setConnectOpen(true)}
          title="Agent settings"
        >
          <Settings2 size={14} />
        </Button>
      </div>

      <Chat.Root>
        <Chat.MessageContainer>
          {timeline.map((item) =>
            item.kind === 'text' ? (
              item.role === 'user' ? (
                <Chat.UserMessage key={item.id}>{item.content}</Chat.UserMessage>
              ) : (
                <Chat.AssistantMessage key={item.id}>{item.content}</Chat.AssistantMessage>
              )
            ) : item.kind === 'tool-call' ? (
              <Chat.ToolCall key={item.id}>
                {describeToolCall(item.call.name, item.call.arguments)}
              </Chat.ToolCall>
            ) : (
              <Chat.PermissionRequest
                key={item.id}
                status={item.status}
                onApprove={() => void handleApprove(item.call)}
                onDeny={() => handleDeny(item.call)}
              >
                {describeToolCall(item.call.name, item.call.arguments)}
              </Chat.PermissionRequest>
            )
          )}
          {showThinking && <Chat.Thinking />}
          <div ref={bottomRef} />
        </Chat.MessageContainer>

        <Chat.Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onSend={() => void handleSend()}
          loading={busy}
          disabled={busy || connected === null}
          placeholder="Ask the agent…"
          models={AGENT_MODELS}
          modelId={modelId}
          onModelChange={handleModelChange}
          tokens={sessionTokens > 0 ? sessionTokens : null}
          cost={sessionCost}
          contextTokens={contextTokens}
          contextWindow={contextWindow}
        />
      </Chat.Root>

      <ConnectAiGatewayDialog open={connectOpen} onOpenChange={setConnectOpen} />
    </div>
  );
}

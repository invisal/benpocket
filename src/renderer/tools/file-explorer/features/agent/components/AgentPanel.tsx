import { useEffect, useRef, useState } from 'react';
import { Send, Settings2 } from 'lucide-react';
import { cn } from 'cnfast';
import { Button } from '@renderer/components/ui/Button';
import type { AgentMessage, AgentToolCall } from '../../../../../../preload/file-explorer/api';
import { deniedToolMessage, runToolCall, splitToolCalls } from '../lib/agentLoop';
import { calculateCost, getModelPricing, type SessionUsage } from '../lib/models';
import { MessageBubble } from './MessageBubble';
import { ToolApprovalCard, type ToolApprovalStatus } from './ToolApprovalCard';
import { ConnectAiGatewayDialog } from './ConnectAiGatewayDialog';

type TimelineItem =
  | { kind: 'text'; id: string; role: 'user' | 'assistant'; content: string }
  | { kind: 'approval'; id: string; call: AgentToolCall; status: ToolApprovalStatus };

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
    `gated behind the user's explicit approval before they run.`
  );
}

const EMPTY_USAGE: SessionUsage = { promptTokens: 0, completionTokens: 0, cachedTokens: 0 };

export function AgentPanel({ workingDirectory }: AgentPanelProps) {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);
  const [modelId, setModelId] = useState<string | null>(null);
  const [usage, setUsage] = useState<SessionUsage>(EMPTY_USAGE);
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

  // Re-fetches on mount, and again once the settings dialog closes so an
  // edited gateway/model shows up without remounting the whole panel.
  useEffect(() => {
    if (connectOpen) return;
    window.fileExplorer.getAiGatewayCredentialStatus().then((res) => {
      setConnected(res.configured);
      setModelId(res.model || null);
    });
  }, [connectOpen]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [timeline]);

  const pricing = modelId ? getModelPricing(modelId) : null;
  const sessionCost = pricing ? calculateCost(usage, pricing) : null;

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

  function resolvePending(call: AgentToolCall, message: AgentMessage, status: ToolApprovalStatus) {
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
        <ConnectAiGatewayDialog
          open={connectOpen}
          onOpenChange={setConnectOpen}
          onConnected={() => setConnected(true)}
        />
      </>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between border-b border-border px-2 py-1">
        <span className="text-xs text-muted-foreground">
          {sessionCost !== null ? `Session cost: $${sessionCost.toFixed(4)}` : ''}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setConnectOpen(true)}
          title="Agent settings"
        >
          <Settings2 size={14} />
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 flex flex-col gap-2">
        {timeline.map((item) =>
          item.kind === 'text' ? (
            <MessageBubble key={item.id} role={item.role} content={item.content} />
          ) : (
            <ToolApprovalCard
              key={item.id}
              call={item.call}
              status={item.status}
              onApprove={() => void handleApprove(item.call)}
              onDeny={() => handleDeny(item.call)}
            />
          )
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border p-2 flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
          disabled={busy || connected === null}
          placeholder="Ask the agent…"
          rows={2}
          className={cn(
            'flex-1 resize-none rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs',
            'text-foreground focus-visible:outline-none disabled:opacity-50'
          )}
        />
        <Button
          variant="primary"
          size="sm"
          onClick={() => void handleSend()}
          disabled={busy || connected === null || !input.trim()}
        >
          <Send size={14} />
        </Button>
      </div>

      <ConnectAiGatewayDialog
        open={connectOpen}
        onOpenChange={setConnectOpen}
        onConnected={() => setConnected(true)}
      />
    </div>
  );
}

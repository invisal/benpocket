import { Button } from '@renderer/components/ui/Button';
import type { AgentToolCall } from '../../../../../../preload/file-explorer/api';
import { describeToolCall } from '../lib/toolDescriptions';

export type ToolApprovalStatus = 'pending' | 'running' | 'approved' | 'denied';

interface ToolApprovalCardProps {
  call: AgentToolCall;
  status: ToolApprovalStatus;
  onApprove: () => void;
  onDeny: () => void;
}

export function ToolApprovalCard({ call, status, onApprove, onDeny }: ToolApprovalCardProps) {
  const description = describeToolCall(call.name, call.arguments);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border-dark bg-surface-2 px-3 py-2 text-xs">
      <span className="text-foreground">{description}</span>
      {status === 'pending' && (
        <div className="flex gap-2">
          <Button size="sm" variant="primary" onClick={onApprove}>
            Allow
          </Button>
          <Button size="sm" variant="secondary" onClick={onDeny}>
            Deny
          </Button>
        </div>
      )}
      {status === 'running' && <span className="text-muted-foreground">Running…</span>}
      {status === 'approved' && <span className="text-emerald-400">Allowed</span>}
      {status === 'denied' && <span className="text-red-400">Denied</span>}
    </div>
  );
}

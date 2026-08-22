import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Button } from '@renderer/components/ui/Button';
import { formatShortcut } from '@renderer/lib/shortcut';
import { keybindingActions } from '@renderer/lib/keybindings';
import { useKeybindingsStore } from '@renderer/store/keybindings.store';
import { KeybindingDialog } from './KeybindingDialog';

function KeybindingRow({
  group,
  actionName,
  accelerator,
  onClick
}: {
  group: string;
  actionName: string;
  accelerator: string;
  onClick: () => void;
}) {
  return (
    <button
      role="button"
      onClick={onClick}
      className="w-full flex flex-col gap-2 p-3 text-left transition-colors hover:bg-list-selected cursor-pointer"
    >
      <div className="text-sm flex gap-1 items-center">
        <span>{group}</span> <ChevronRight className="size-3" />
        <strong className="font-medium">{actionName}</strong>
      </div>

      <div className="flex items-center gap-1">
        {formatShortcut(accelerator)
          .split('+')
          .map((part, i) => (
            <kbd
              key={i}
              className="rounded-sm border border-border bg-surface px-1.5 py-0.5 text-sm font-medium shadow-[0_1px_0_0_var(--color-border)]"
            >
              {part}
            </kbd>
          ))}
      </div>
    </button>
  );
}

export function KeybindingsPanel() {
  const bindings = useKeybindingsStore((s) => s.bindings);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingActionId, setEditingActionId] = useState<string | undefined>(undefined);

  function openAddDialog() {
    setEditingActionId(undefined);
    setDialogOpen(true);
  }

  function openEditDialog(actionId: string) {
    setEditingActionId(actionId);
    setDialogOpen(true);
  }

  return (
    <div className="w-84 bg-surface-2 divide-y divide-border-light">
      <div className="p-3">
        <Button className="w-full" onClick={openAddDialog}>
          Add keybinding
        </Button>
      </div>

      {bindings.map((binding) => {
        const action = keybindingActions.find((a) => a.id === binding.actionId);
        if (!action) return null;
        return (
          <KeybindingRow
            key={binding.actionId}
            group={action.group}
            actionName={action.actionName}
            accelerator={binding.accelerator}
            onClick={() => openEditDialog(binding.actionId)}
          />
        );
      })}

      <KeybindingDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingActionId={editingActionId}
      />
    </div>
  );
}

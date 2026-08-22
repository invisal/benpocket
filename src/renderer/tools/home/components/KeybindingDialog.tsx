import { useState } from 'react';
import { Dialog } from '@renderer/components/ui/Dialog';
import { Button } from '@renderer/components/ui/Button';
import { Input } from '@renderer/components/ui/Input';
import { keybindingActions } from '@renderer/lib/keybindings';
import type { KeybindingAction } from '@renderer/types/keybindings';
import { useKeybindingsStore } from '@renderer/store/keybindings.store';
import { KeyCaptureField } from './KeyCaptureField';
import { ChevronsRight } from 'lucide-react';

interface KeybindingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, edits this action's binding directly instead of showing the
   *  action picker -- used when a row in KeybindingsPanel is clicked. */
  editingActionId?: string;
}

type Step = 'select' | 'bind';

function SelectActionStep({
  query,
  onQueryChange,
  onChoose
}: {
  query: string;
  onQueryChange: (query: string) => void;
  onChoose: (actionId: string) => void;
}) {
  const filteredActions = keybindingActions.filter((a) => {
    const haystack = `${a.group} ${a.actionName}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  return (
    <>
      <Dialog.Description>Choose an action to assign a shortcut to.</Dialog.Description>
      <div className="mt-4 flex flex-col gap-2">
        <Input
          autoFocus
          placeholder="Search actions…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />
        <div className="max-h-72 overflow-y-auto border-border-light flex flex-col">
          {filteredActions.length === 0 && (
            <p className="p-3 text-sm text-muted-foreground">No matching actions.</p>
          )}
          {filteredActions.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => onChoose(a.id)}
              className="flex px-2 py-1.5 items-center hover:bg-list-hover cursor-pointer rounded gap-1"
            >
              <span className="leading-none">{a.group}</span>
              <ChevronsRight size={10} className="shrink-0" />
              <span className="leading-none">{a.actionName}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function BindStep({
  isEditing,
  selectedAction,
  draftAccelerator,
  onDraftChange,
  onBack,
  onSave,
  onRemove
}: {
  isEditing: boolean;
  selectedAction: KeybindingAction | undefined;
  draftAccelerator: string | null;
  onDraftChange: (accelerator: string) => void;
  onBack: () => void;
  onSave: () => void;
  onRemove: () => void;
}) {
  return (
    <>
      <Dialog.Description>
        Press the key combination to assign to this action. If another action already uses that
        combination, it will be unbound.
      </Dialog.Description>

      <div className="mt-4 flex flex-col gap-3">
        {selectedAction && (
          <div>
            <p className="text-sm text-muted-foreground">{selectedAction.group}</p>
            <p className="font-medium">{selectedAction.actionName}</p>
            <p className="mt-1 text-sm text-muted-foreground">{selectedAction.description}</p>
          </div>
        )}

        <KeyCaptureField value={draftAccelerator} onChange={onDraftChange} />

        <div className="flex gap-2">
          {!isEditing && (
            <Button variant="secondary" size="sm" onClick={onBack}>
              Back
            </Button>
          )}
          <Button variant="primary" size="sm" disabled={!draftAccelerator} onClick={onSave}>
            Save
          </Button>
          {isEditing && (
            <Button variant="destructive" size="sm" onClick={onRemove}>
              Remove
            </Button>
          )}
        </div>
      </div>
    </>
  );
}

export function KeybindingDialog({ open, onOpenChange, editingActionId }: KeybindingDialogProps) {
  const bindings = useKeybindingsStore((s) => s.bindings);
  const setBinding = useKeybindingsStore((s) => s.setBinding);
  const removeBinding = useKeybindingsStore((s) => s.removeBinding);
  const isEditing = Boolean(editingActionId);

  const [step, setStep] = useState<Step>(isEditing ? 'bind' : 'select');
  const [query, setQuery] = useState('');
  const [selectedActionId, setSelectedActionId] = useState<string | undefined>(editingActionId);
  const [draftAccelerator, setDraftAccelerator] = useState<string | null>(null);

  // Resets to the initial step/draft whenever the dialog opens, adjusted
  // during render rather than in an effect (avoids the extra cascading
  // render an effect-based reset would cause).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setStep(isEditing ? 'bind' : 'select');
      setQuery('');
      setSelectedActionId(editingActionId);
      setDraftAccelerator(
        editingActionId
          ? (bindings.find((b) => b.actionId === editingActionId)?.accelerator ?? null)
          : null
      );
    }
  }

  const selectedAction = keybindingActions.find((a) => a.id === selectedActionId);

  function handleChooseAction(actionId: string) {
    setSelectedActionId(actionId);
    setDraftAccelerator(bindings.find((b) => b.actionId === actionId)?.accelerator ?? null);
    setStep('bind');
  }

  function handleBack() {
    setSelectedActionId(undefined);
    setDraftAccelerator(null);
    setStep('select');
  }

  function handleSave() {
    if (!selectedActionId || !draftAccelerator) return;
    void setBinding(selectedActionId, draftAccelerator);
    onOpenChange(false);
  }

  function handleRemove() {
    if (!editingActionId) return;
    void removeBinding(editingActionId);
    onOpenChange(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content className="max-w-sm">
        <Dialog.Title>{isEditing ? 'Edit keybinding' : 'Add keybinding'}</Dialog.Title>

        {step === 'select' ? (
          <SelectActionStep query={query} onQueryChange={setQuery} onChoose={handleChooseAction} />
        ) : (
          <BindStep
            isEditing={isEditing}
            selectedAction={selectedAction}
            draftAccelerator={draftAccelerator}
            onDraftChange={setDraftAccelerator}
            onBack={handleBack}
            onSave={handleSave}
            onRemove={handleRemove}
          />
        )}
      </Dialog.Content>
    </Dialog.Root>
  );
}

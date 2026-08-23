import { useState } from 'react';
import { Command } from 'lucide-react';
import { Dialog } from '@renderer/components/ui/Dialog';
import { Button } from '@renderer/components/ui/Button';
import { Input } from '@renderer/components/ui/Input';
import { TreeList, type TreeItemMeta } from '@renderer/components/ui/TreeList';
import { FuzzyHighlight } from '@renderer/components/ui/FuzzyHighlight';
import { ShortcutBadge } from '@renderer/components/ui/ShortcutBadge';
import { fuzzyMatch } from '@renderer/lib/fuzzy-match';
import { filterTreeKeepingAncestors } from '@renderer/lib/tree-search';
import { keybindingActions } from '@renderer/lib/keybindings';
import type { KeybindingAction } from '@renderer/types/keybindings';
import { useKeybindingsStore } from '@renderer/store/keybindings.store';
import { KeyCaptureField } from './KeyCaptureField';

interface KeybindingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, edits this action's binding directly instead of showing the
   *  action picker -- used when a row in KeybindingsPanel is clicked. */
  editingActionId?: string;
}

type Step = 'select' | 'bind';

// TreeList has no built-in notion of "action grouped under a tool" -- the
// picker builds its own two-level discriminated-union tree (group -> action)
// from the flat `keybindingActions` list, the same pattern any other
// heterogeneous TreeList consumer (e.g. http-client's CollectionsTree) uses.
interface ActionGroupNode {
  id: string;
  kind: 'group';
  label: string;
  children: ActionPickerNode[];
}
type ActionPickerNode = ActionGroupNode | { id: string; kind: 'action'; action: KeybindingAction };

function buildActionTree(actions: KeybindingAction[]): ActionGroupNode[] {
  const byGroup = new Map<string, KeybindingAction[]>();
  for (const action of actions) {
    const list = byGroup.get(action.group);
    if (list) list.push(action);
    else byGroup.set(action.group, [action]);
  }
  return [...byGroup.entries()].map(([group, groupActions]) => ({
    id: `group:${group}`,
    kind: 'group',
    label: group,
    children: groupActions.map((action) => ({ id: action.id, kind: 'action', action }))
  }));
}

// `keybindingActions` is a static import, so the tree only needs building once.
const ACTION_TREE: ActionGroupNode[] = buildActionTree(keybindingActions);
const ALL_GROUP_IDS = new Set(ACTION_TREE.map((g) => g.id));

const getActionNodeId = (node: ActionPickerNode): string => node.id;
const getActionNodeChildren = (node: ActionPickerNode): ActionPickerNode[] | undefined =>
  node.kind === 'group' ? node.children : undefined;

/**
 * A group matches the query fuzzily on its own label, in which case every
 * action inside it counts as a match too -- otherwise you'd search "Kuberneter"
 * and see an expandable group header with nothing visible under it.
 */
function buildActionPredicate(query: string): (node: ActionPickerNode) => boolean {
  const matchedGroupIds = new Set(
    ACTION_TREE.filter((g) => fuzzyMatch(g.label, query).matched).map((g) => g.id)
  );
  return (node) => {
    if (node.kind === 'group') return matchedGroupIds.has(node.id);
    if (matchedGroupIds.has(`group:${node.action.group}`)) return true;
    return fuzzyMatch(node.action.actionName, query).matched;
  };
}

type ActionNode = Extract<ActionPickerNode, { kind: 'action' }>;

function ActionRow({
  node,
  meta,
  query,
  accelerator,
  onChoose
}: {
  node: ActionNode;
  meta: TreeItemMeta<ActionPickerNode>;
  query: string;
  accelerator: string | undefined;
  onChoose: (actionId: string) => void;
}) {
  // Placeholder icon for any action that hasn't been given its own yet.
  const Icon = node.action.icon ?? Command;

  return (
    <TreeList.Item
      meta={meta}
      dragMode="none"
      onClick={() => onChoose(node.action.id)}
      className="gap-1.5 px-2 cursor-pointer h-9"
      actions={
        accelerator ? (
          <ShortcutBadge accelerator={accelerator} className="shrink-0" />
        ) : (
          <span className="shrink-0 text-muted-foreground">Not set</span>
        )
      }
    >
      <span className="w-3 shrink-0" />
      <Icon size={14} className="shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">
        <FuzzyHighlight text={node.action.actionName} query={query} />
      </span>
    </TreeList.Item>
  );
}

function SelectActionStep({
  query,
  onQueryChange,
  onChoose
}: {
  query: string;
  onQueryChange: (query: string) => void;
  onChoose: (actionId: string) => void;
}) {
  const bindings = useKeybindingsStore((s) => s.bindings);
  const [expanded, setExpanded] = useState<Set<string>>(ALL_GROUP_IDS);
  const isSearching = query.trim().length > 0;

  const { visibleIds, expandIds } = isSearching
    ? filterTreeKeepingAncestors(
        ACTION_TREE,
        getActionNodeId,
        getActionNodeChildren,
        buildActionPredicate(query)
      )
    : { visibleIds: null, expandIds: new Set<string>() };

  const searchData = visibleIds ? ACTION_TREE.filter((n) => visibleIds.has(n.id)) : ACTION_TREE;
  const searchGetChildren = (node: ActionPickerNode): ActionPickerNode[] | undefined =>
    visibleIds && node.kind === 'group'
      ? node.children.filter((c) => visibleIds.has(c.id))
      : getActionNodeChildren(node);
  const effectiveExpanded = isSearching ? new Set([...expanded, ...expandIds]) : expanded;

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
        <TreeList<ActionPickerNode>
          className="h-72 overflow-y-auto"
          data={searchData}
          getId={getActionNodeId}
          getChildren={searchGetChildren}
          expanded={effectiveExpanded}
          onExpandedChange={setExpanded}
          onActivate={(node) => {
            if (node.kind === 'group') return;
            onChoose(node.action.id);
          }}
          emptyState={<p className="p-3 text-sm text-muted-foreground">No matching actions.</p>}
          renderItem={(node, meta) =>
            node.kind === 'group' ? (
              <TreeList.Item
                meta={meta}
                dragMode="none"
                onClick={meta.toggleExpanded}
                className="h-9 gap-1.5 px-2 tracking-wide text-muted-foreground cursor-pointer font-medium"
              >
                <TreeList.ExpandToggle hasChildren isExpanded={meta.isExpanded} />
                <div>
                  <FuzzyHighlight text={node.label} query={query} />
                </div>
              </TreeList.Item>
            ) : (
              <ActionRow
                node={node}
                meta={meta}
                query={query}
                accelerator={bindings.find((b) => b.actionId === node.action.id)?.accelerator}
                onChoose={onChoose}
              />
            )
          }
        />
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
      <Dialog.Content className="max-w-lg">
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

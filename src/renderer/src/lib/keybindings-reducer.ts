import type { KeybindingEntry } from '@shared/keybindings';

/** Assigns `accelerator` to `actionId`, dropping it from whichever other
 *  action (if any) already held it -- an accelerator can only ever be bound
 *  to one action at a time -- and replacing `actionId`'s previous binding. */
export function withBinding(
  bindings: KeybindingEntry[],
  actionId: string,
  accelerator: string
): KeybindingEntry[] {
  const next = bindings.filter((b) => b.accelerator !== accelerator && b.actionId !== actionId);
  next.push({ actionId, accelerator });
  return next;
}

export function withoutBinding(bindings: KeybindingEntry[], actionId: string): KeybindingEntry[] {
  return bindings.filter((b) => b.actionId !== actionId);
}

import type { LucideIcon } from 'lucide-react';

export interface KeybindingAction {
  id: string;
  group: string;
  actionName: string;
  description: string;
  /** Shown next to the action in the binding picker; falls back to a generic placeholder icon when omitted. */
  icon?: LucideIcon;
  action: () => void;
}

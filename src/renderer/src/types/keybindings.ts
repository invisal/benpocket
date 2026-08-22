export interface KeybindingAction {
  id: string;
  group: string;
  actionName: string;
  description: string;
  action: () => void;
}

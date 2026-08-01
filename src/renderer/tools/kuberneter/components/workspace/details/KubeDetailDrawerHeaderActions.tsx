import type React from 'react';
import { Pencil, Star, Trash2, Terminal, Pause, RefreshCw, FileText, Share2 } from 'lucide-react';
import { Tooltip } from '../../../../../src/components/ui/Tooltip';
import { type IngressClassData } from '../../../types/IngressClassData';

interface KubeDetailDrawerHeaderActionsProps {
  contentType: string;
  payload: unknown;
}

interface ActionItem {
  id: string;
  title: string | ((payload: unknown) => string);
  icon: React.ComponentType<{ className?: string }>;
  variant?: 'default' | 'danger' | 'warning';
  isActive?: (payload: unknown) => boolean;
  onClick?: (payload: unknown) => void;
}

const EDIT_ACTION: ActionItem = {
  id: 'edit',
  title: 'Edit',
  icon: Pencil
};

const DELETE_ACTION: ActionItem = {
  id: 'delete',
  title: 'Delete',
  icon: Trash2,
  variant: 'danger'
};

const TERMINAL_ACTION: ActionItem = {
  id: 'terminal',
  title: 'Terminal',
  icon: Terminal
};

const LOGS_ACTION: ActionItem = {
  id: 'logs',
  title: 'Logs',
  icon: FileText
};

const ATTACH_SHARE_ACTION: ActionItem = {
  id: 'attach-share',
  title: 'Attach / Share',
  icon: Share2
};

const CORDON_ACTION: ActionItem = {
  id: 'cordon',
  title: 'Cordon',
  icon: Pause
};

const REFRESH_ACTION: ActionItem = {
  id: 'refresh',
  title: 'Refresh',
  icon: RefreshCw
};

const INGRESS_CLASS_DEFAULT_ACTION: ActionItem = {
  id: 'ingress-default',
  title: (payload) =>
    (payload as IngressClassData)?.isDefault ? 'Remove default' : 'Set as default',
  icon: Star,
  variant: 'warning',
  isActive: (payload) => Boolean((payload as IngressClassData)?.isDefault)
};

const RESOURCE_ACTIONS_MAP: Record<string, ActionItem[]> = {
  pod: [TERMINAL_ACTION, LOGS_ACTION, ATTACH_SHARE_ACTION, EDIT_ACTION, DELETE_ACTION],
  node: [TERMINAL_ACTION, CORDON_ACTION, REFRESH_ACTION, EDIT_ACTION, DELETE_ACTION],
  ingressclass: [INGRESS_CLASS_DEFAULT_ACTION, EDIT_ACTION, DELETE_ACTION],
  clusterrole: [EDIT_ACTION, DELETE_ACTION],
  role: [EDIT_ACTION, DELETE_ACTION],
  clusterrolebinding: [EDIT_ACTION, DELETE_ACTION],
  rolebinding: [EDIT_ACTION, DELETE_ACTION]
};

const VARIANT_HOVER_STYLES = {
  default: 'hover:text-white',
  danger: 'hover:text-red-400',
  warning: 'hover:text-yellow-400'
};

const getNormalizedContentType = (type: string): string => {
  const normalized = type.toLowerCase();
  if (normalized === 'pods') return 'pod';
  if (normalized === 'nodes') return 'node';
  if (normalized === 'ingressclasses') return 'ingressclass';
  if (normalized.endsWith('s') && !normalized.endsWith('class')) {
    return normalized.slice(0, -1);
  }
  return normalized;
};

export const KubeDetailDrawerHeaderActions: React.FC<KubeDetailDrawerHeaderActionsProps> = ({
  contentType,
  payload
}) => {
  const key = getNormalizedContentType(contentType);
  const actions = RESOURCE_ACTIONS_MAP[key];
  if (!actions || actions.length === 0) return null;

  return (
    <Tooltip.Provider delay={200} closeDelay={0}>
      {actions.map((action) => {
        const Icon = action.icon;
        const title = typeof action.title === 'function' ? action.title(payload) : action.title;
        const active = action.isActive ? action.isActive(payload) : false;
        const hoverStyle = VARIANT_HOVER_STYLES[action.variant ?? 'default'];

        return (
          <Tooltip.Root key={action.id}>
            <Tooltip.Trigger
              render={
                <button
                  onClick={() => action.onClick?.(payload)}
                  className={`text-zinc-400 ${hoverStyle} cursor-pointer hover:bg-border-dark/40 p-1 rounded transition-colors border-none bg-transparent flex items-center justify-center`}
                >
                  <Icon className={`size-3.5 ${active ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                </button>
              }
            />
            <Tooltip.Content side="bottom">{title}</Tooltip.Content>
          </Tooltip.Root>
        );
      })}
    </Tooltip.Provider>
  );
};

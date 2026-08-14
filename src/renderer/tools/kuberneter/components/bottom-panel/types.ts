export type KuberneterBottomPanelTabType = 'terminal' | 'create-resource';

export interface KuberneterBottomPanelTabItem {
  id: string;
  type: KuberneterBottomPanelTabType;
  title: string;
}

let nextTabId = 1;
export function generateTabId(type: KuberneterBottomPanelTabType): string {
  return `${type === 'terminal' ? 'term' : 'res'}-${nextTabId++}`;
}

export {
  DEFAULT_TEMPLATES,
  RESOURCE_TEMPLATES,
  TEMPLATE_CATEGORIES,
  type TemplateCategory
} from '../../templates';

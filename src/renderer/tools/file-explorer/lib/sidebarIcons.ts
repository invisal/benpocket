import { type ComponentType } from 'react';
import { Download, FileText, Home, Monitor } from 'lucide-react';

export type IconComponent = ComponentType<{ size?: number; className?: string }>;

export const favoriteIcons: Record<string, IconComponent> = {
  Home,
  Desktop: Monitor,
  Documents: FileText,
  Downloads: Download
};

export function getFavoriteIcon(label: string): IconComponent {
  return favoriteIcons[label] ?? Home;
}

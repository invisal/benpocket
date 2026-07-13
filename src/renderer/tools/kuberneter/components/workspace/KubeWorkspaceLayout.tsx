import type React from 'react';

interface KubeWorkspaceLayoutProps {
  /** Content rendered inside the fixed h-11 header bar */
  header: React.ReactNode;
  /** Scrollable / flex body below the header */
  children: React.ReactNode;
}

/**
 * Uniform workspace shell used by every kuberneter resource page.
 *
 * Header height (h-11 = 44px) is intentionally equal to:
 *   py-2 (8px) + h-7 searchbox (28px) + gap-2 (8px) = 44px
 *
 * This keeps the header bottom border perfectly aligned with:
 *  - the sidebar's post-searchbox separator line
 *  - the drawer panel's header bottom border
 */
export const KubeWorkspaceLayout: React.FC<KubeWorkspaceLayoutProps> = ({ header, children }) => {
  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0 select-none">
      {/* Fixed-height header — aligns with sidebar separator and drawer header */}
      <div className="h-11 shrink-0 flex items-center px-4 border-b border-border-dark">
        {header}
      </div>

      {/* Scrollable / flexible body */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0">{children}</div>
    </div>
  );
};

import { useEffect, type PropsWithChildren } from 'react';
import { useToolContext } from '../providers/ToolProvider';
import { useTitleBarStore } from '../../store/titleBar.store';

/**
 * Publishes its children into the app's title bar while this tool's tab is
 * active. Every open tab keeps its component mounted (see `createTabProvider`'s
 * `Activity` usage), so the `isTabActive` check -- read from `ToolContext`
 * rather than a prop -- keeps a background tab from clobbering the visible
 * tab's title.
 */
export function Title({ children }: PropsWithChildren) {
  const { isTabActive } = useToolContext();
  const setContent = useTitleBarStore((s) => s.setContent);

  useEffect(() => {
    if (!isTabActive) return;
    setContent(children);
    return () => setContent(null);
  }, [isTabActive, children, setContent]);

  return null;
}

// eslint-disable-next-line react-refresh/only-export-components
export const ToolLayout = { Title };

import type { JSX } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { useToastStore } from '../../store/toast-store';
import { cn } from '../../lib/utils';

/** Fixed bottom-right stack driven by toast-store.ts -- mount once at the app root. */
export function ToastViewport(): JSX.Element {
  const toasts = useToastStore((state) => state.toasts);
  const dismissToast = useToastStore((state) => state.dismissToast);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          onClick={() => dismissToast(toast.id)}
          className={cn(
            'pointer-events-auto flex items-center gap-2 rounded-lg border border-line bg-surface-3 px-3 py-2 text-xs shadow-lg',
            'animate-in fade-in slide-in-from-bottom-2'
          )}
        >
          {toast.variant === 'success' ? (
            <CheckCircle2 size={14} className="shrink-0 text-accent" />
          ) : (
            <XCircle size={14} className="shrink-0 text-danger" />
          )}
          <span className="text-foreground">{toast.message}</span>
        </div>
      ))}
    </div>
  );
}

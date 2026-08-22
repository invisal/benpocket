import { useState, useEffect, type FC } from 'react';
import { AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from 'cnfast';

export type ToastType = 'error' | 'warning' | 'info' | 'information';

export interface ToastAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
}

export interface KuberneterToastItem {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  actions?: ToastAction[];
  duration?: number;
}

interface KuberneterToastProps {
  toast: KuberneterToastItem;
  onClose: (id: string) => void;
}

interface ToastThemeConfig {
  container: string;
  header: string;
  titleText: string;
  bodyText: string;
  iconColor: string;
  closeBtn: string;
  footer: string;
  actionPrimary: string;
  actionSecondary: string;
}

const toastThemeMap: Record<ToastType, ToastThemeConfig> = {
  warning: {
    container:
      'bg-amber-50 border-amber-300 text-amber-950 shadow-xl shadow-amber-900/10 border-l-4 border-l-amber-500 dark:bg-amber-950/90 dark:border-amber-500/40 dark:border-l-amber-400 dark:text-amber-100 dark:shadow-amber-950/60 backdrop-blur-md',
    header:
      'bg-amber-100/70 border-b border-amber-200/80 dark:bg-amber-900/50 dark:border-amber-500/30',
    titleText: 'text-amber-950 dark:text-amber-100 font-bold',
    bodyText: 'text-amber-900/90 dark:text-amber-200/90 font-medium',
    iconColor: 'text-amber-600 dark:text-amber-400',
    closeBtn: 'text-amber-700 hover:bg-amber-200/60 dark:text-amber-300 dark:hover:bg-amber-800/60',
    footer:
      'bg-amber-100/40 border-t border-amber-200/60 dark:bg-amber-900/30 dark:border-amber-500/30',
    actionPrimary:
      'bg-amber-600 hover:bg-amber-700 text-strong font-semibold shadow-sm dark:bg-amber-500 dark:hover:bg-amber-400 dark:text-amber-950 dark:font-semibold',
    actionSecondary:
      'bg-amber-200/70 text-amber-900 hover:bg-amber-200 dark:bg-amber-800/50 dark:text-amber-200 dark:hover:bg-amber-800'
  },
  error: {
    container:
      'bg-red-50 border-red-300 text-red-950 shadow-xl shadow-red-900/10 border-l-4 border-l-red-500 dark:bg-red-950/90 dark:border-red-500/40 dark:border-l-red-400 dark:text-red-100 dark:shadow-red-950/60 backdrop-blur-md',
    header: 'bg-red-100/70 border-b border-red-200/80 dark:bg-red-900/50 dark:border-red-500/30',
    titleText: 'text-red-950 dark:text-red-100 font-bold',
    bodyText: 'text-red-900/90 dark:text-red-200/90 font-medium',
    iconColor: 'text-red-600 dark:text-red-400',
    closeBtn: 'text-red-700 hover:bg-red-200/60 dark:text-red-300 dark:hover:bg-red-800/60',
    footer: 'bg-red-100/40 border-t border-red-200/60 dark:bg-red-900/30 dark:border-red-500/30',
    actionPrimary:
      'bg-red-600 hover:bg-red-700 text-strong font-semibold shadow-sm dark:bg-red-500 dark:hover:bg-red-400 dark:text-red-950 dark:font-semibold',
    actionSecondary:
      'bg-red-200/70 text-red-900 hover:bg-red-200 dark:bg-red-800/50 dark:text-red-200 dark:hover:bg-red-800'
  },
  info: {
    container:
      'bg-emerald-50 border-emerald-300 text-emerald-950 shadow-xl shadow-emerald-900/10 border-l-4 border-l-emerald-500 dark:bg-emerald-950/90 dark:border-emerald-500/40 dark:border-l-emerald-400 dark:text-emerald-100 dark:shadow-emerald-950/60 backdrop-blur-md',
    header:
      'bg-emerald-100/70 border-b border-emerald-200/80 dark:bg-emerald-900/50 dark:border-emerald-500/30',
    titleText: 'text-emerald-950 dark:text-emerald-100 font-bold',
    bodyText: 'text-emerald-900/90 dark:text-emerald-200/90 font-medium',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    closeBtn:
      'text-emerald-700 hover:bg-emerald-200/60 dark:text-emerald-300 dark:hover:bg-emerald-800/60',
    footer:
      'bg-emerald-100/40 border-t border-emerald-200/60 dark:bg-emerald-900/30 dark:border-emerald-500/30',
    actionPrimary:
      'bg-emerald-600 hover:bg-emerald-700 text-strong font-semibold shadow-sm dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:text-emerald-950 dark:font-semibold',
    actionSecondary:
      'bg-emerald-200/70 text-emerald-900 hover:bg-emerald-200 dark:bg-emerald-800/50 dark:text-emerald-200 dark:hover:bg-emerald-800'
  },
  information: {
    container:
      'bg-emerald-50 border-emerald-300 text-emerald-950 shadow-xl shadow-emerald-900/10 border-l-4 border-l-emerald-500 dark:bg-emerald-950/90 dark:border-emerald-500/40 dark:border-l-emerald-400 dark:text-emerald-100 dark:shadow-emerald-950/60 backdrop-blur-md',
    header:
      'bg-emerald-100/70 border-b border-emerald-200/80 dark:bg-emerald-900/50 dark:border-emerald-500/30',
    titleText: 'text-emerald-950 dark:text-emerald-100 font-bold',
    bodyText: 'text-emerald-900/90 dark:text-emerald-200/90 font-medium',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    closeBtn:
      'text-emerald-700 hover:bg-emerald-200/60 dark:text-emerald-300 dark:hover:bg-emerald-800/60',
    footer:
      'bg-emerald-100/40 border-t border-emerald-200/60 dark:bg-emerald-900/30 dark:border-emerald-500/30',
    actionPrimary:
      'bg-emerald-600 hover:bg-emerald-700 text-strong font-semibold shadow-sm dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:text-emerald-950 dark:font-semibold',
    actionSecondary:
      'bg-emerald-200/70 text-emerald-900 hover:bg-emerald-200 dark:bg-emerald-800/50 dark:text-emerald-200 dark:hover:bg-emerald-800'
  }
};

export const KuberneterToast: FC<KuberneterToastProps> = ({ toast, onClose }) => {
  const isError = toast.type === 'error';
  const isWarning = toast.type === 'warning';
  const isInfo = toast.type === 'info' || toast.type === 'information';

  const defaultDuration = isError ? 8000 : isWarning ? 6000 : 4500;
  const duration = toast.duration !== undefined ? toast.duration : defaultDuration;

  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (duration <= 0 || isPaused) return;
    const timer = setTimeout(() => {
      onClose(toast.id);
    }, duration);
    return () => clearTimeout(timer);
  }, [toast.id, duration, isPaused, onClose]);

  const theme = toastThemeMap[toast.type] || toastThemeMap.info;

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className={cn(
        'w-80 sm:w-96 rounded-lg border shadow-2xl overflow-hidden flex flex-col transition-all duration-300 ease-out animate-in fade-in slide-in-from-bottom-8',
        theme.container
      )}
    >
      {/* Header */}
      <div className={cn('flex items-center justify-between px-3.5 py-2.5', theme.header)}>
        <div className="flex items-center gap-2 min-w-0">
          {isError && <AlertCircle className={cn('size-4 shrink-0', theme.iconColor)} />}
          {isWarning && <AlertTriangle className={cn('size-4 shrink-0', theme.iconColor)} />}
          {isInfo && <Info className={cn('size-4 shrink-0', theme.iconColor)} />}
          <span className={cn('text-xs truncate', theme.titleText)}>{toast.title}</span>
        </div>
        <button
          onClick={() => onClose(toast.id)}
          className={cn(
            'p-1 rounded transition-colors border-none bg-transparent cursor-pointer',
            theme.closeBtn
          )}
          title="Dismiss"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* Body */}
      <div className={cn('px-3.5 py-3 text-xs leading-relaxed select-text', theme.bodyText)}>
        {toast.message}
      </div>

      {/* Footer Actions */}
      {toast.actions && toast.actions.length > 0 && (
        <div className={cn('flex items-center justify-end gap-2 px-3.5 py-2', theme.footer)}>
          {toast.actions.map((act, idx) => {
            const isPrimary = !act.variant || act.variant === 'primary';
            return (
              <button
                key={idx}
                onClick={() => {
                  act.onClick();
                  onClose(toast.id);
                }}
                className={cn(
                  'text-xs h-7 px-3 rounded-md font-medium select-none cursor-pointer transition-all duration-150',
                  isPrimary ? theme.actionPrimary : theme.actionSecondary
                )}
              >
                {act.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

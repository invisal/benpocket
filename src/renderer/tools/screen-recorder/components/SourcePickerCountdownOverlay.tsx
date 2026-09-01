import type { JSX } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Loader2 } from 'lucide-react';
import { Button } from '@renderer/components/ui/Button';

export function SourcePickerCountdownOverlay({
  countdownRemaining,
  isStarting,
  onCancel
}: {
  countdownRemaining: number | null;
  isStarting: boolean;
  onCancel: () => void;
}): JSX.Element | null {
  if (countdownRemaining === null && !isStarting) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/20">
      <AnimatePresence mode="popLayout">
        {isStarting ? (
          <motion.div
            key="starting"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-3"
          >
            <Loader2 size={48} className="animate-spin text-white" />
            <span className="text-lg font-medium text-white">Starting…</span>
          </motion.div>
        ) : (
          <motion.span
            key={countdownRemaining}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.4 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="font-mono text-8xl font-semibold text-white"
          >
            {countdownRemaining}
          </motion.span>
        )}
      </AnimatePresence>
      {!isStarting && (
        <Button
          variant="ghost"
          onClick={(event) => {
            event.stopPropagation();
            onCancel();
          }}
          className="text-white/60 hover:bg-white/10 hover:text-white"
        >
          Cancel
        </Button>
      )}
    </div>
  );
}

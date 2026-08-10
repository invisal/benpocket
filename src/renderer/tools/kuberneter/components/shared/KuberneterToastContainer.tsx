import type React from 'react';
import { useKuberneterStore } from '../../store/kuberneter.store';
import { KuberneterToast } from './KuberneterToast';

export const KuberneterToastContainer: React.FC = () => {
  const toasts = useKuberneterStore((s) => s.kuberneterToasts);
  const removeToast = useKuberneterStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="absolute bottom-4 right-4 z-50 flex flex-col gap-2.5 max-h-[80vh] overflow-hidden pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <KuberneterToast toast={toast} onClose={removeToast} />
        </div>
      ))}
    </div>
  );
};

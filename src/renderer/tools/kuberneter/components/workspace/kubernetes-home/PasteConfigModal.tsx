import type React from 'react';
import { useState } from 'react';
import { X, FileCode, AlertCircle } from 'lucide-react';

interface PasteConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (content: string, filename: string) => Promise<string | { error: string }>;
}

export const PasteConfigModal: React.FC<PasteConfigModalProps> = ({ isOpen, onClose, onSave }) => {
  const [pastedContent, setPastedContent] = useState('');
  const [pasteFilename, setPasteFilename] = useState('');
  const [pasteError, setPasteError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasteError(null);
    const trimmedContent = pastedContent.trim();
    const trimmedName = pasteFilename.trim();

    if (!trimmedContent) {
      setPasteError('Config content cannot be empty.');
      return;
    }
    if (!trimmedName) {
      setPasteError('Filename cannot be empty.');
      return;
    }

    const res = await onSave(trimmedContent, trimmedName);
    if (typeof res === 'object' && res.error) {
      setPasteError(res.error);
    } else {
      // Success - reset and close
      setPastedContent('');
      setPasteFilename('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-surface-2 border border-border-dark rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Title */}
        <div className="flex items-center justify-between p-4 border-b border-border-dark shrink-0">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <FileCode className="size-4.5 text-accent" />
            Paste Kubeconfig Contents
          </h3>
          <button
            onClick={onClose}
            className="size-7 rounded hover:bg-surface-3 flex items-center justify-center text-zinc-500 hover:text-white cursor-pointer transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <div className="p-4 flex flex-col gap-3 flex-1 min-h-0">
            {/* Filename Input */}
            <div className="flex flex-col gap-1 shrink-0">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider font-sans">
                Config Name / Identifier
              </label>
              <input
                type="text"
                required
                value={pasteFilename}
                onChange={(e) => setPasteFilename(e.target.value)}
                placeholder="e.g. k8s-production-eu"
                className="w-full bg-editor-bg border border-border-dark rounded px-3 py-1.5 text-xs text-white outline-none focus:border-accent transition-colors font-semibold"
              />
            </div>

            {/* Textarea Content */}
            <div className="flex flex-col gap-1 flex-1 min-h-0">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider font-sans">
                YAML Kubeconfig Contents
              </label>
              <textarea
                required
                value={pastedContent}
                onChange={(e) => setPastedContent(e.target.value)}
                placeholder="apiVersion: v1&#10;clusters: ...&#10;contexts: ...&#10;current-context: ..."
                className="w-full flex-1 bg-editor-bg border border-border-dark rounded p-3 text-[11px] font-mono text-zinc-300 outline-none focus:border-accent resize-none min-h-[180px] overflow-y-auto"
              />
            </div>

            {pasteError && (
              <div className="shrink-0 flex items-start gap-1.5 p-2.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-[11px] leading-4">
                <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
                <div>{pasteError}</div>
              </div>
            )}
          </div>

          {/* Modal Actions */}
          <div className="bg-surface-3/20 border-t border-border-dark p-3 shrink-0 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="py-1.5 px-3 bg-surface-2 hover:bg-surface-3 text-zinc-300 border border-border-dark rounded-md text-xs font-semibold cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="py-1.5 px-4 bg-accent hover:bg-accent-light text-white rounded-md text-xs font-semibold cursor-pointer transition-colors"
            >
              Save Config
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

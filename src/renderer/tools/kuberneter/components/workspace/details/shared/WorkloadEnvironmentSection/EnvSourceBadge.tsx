import { type FC } from 'react';
import { FileText, Lock, Layers } from 'lucide-react';
import { useOpenConfigDetail } from '../../../../../hooks/open-detail';
import type { ReferencedEnvEntry, EnvFromEntry } from './types';

interface EnvSourceBadgeProps {
  entry?: ReferencedEnvEntry;
  envFrom?: EnvFromEntry;
  namespace?: string;
}

export const EnvSourceBadge: FC<EnvSourceBadgeProps> = ({ entry, envFrom, namespace = '' }) => {
  const { openConfigMapDetail, openSecretDetail } = useOpenConfigDetail();

  if (envFrom) {
    const isSecret = envFrom.sourceType === 'secret';
    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-surface-2 border border-border/60 text-[10px] font-mono text-zinc-300">
        {isSecret ? (
          <Lock className="size-3 text-amber-400 shrink-0" />
        ) : (
          <FileText className="size-3 text-cyan-400 shrink-0" />
        )}
        <span className="text-zinc-500 font-sans">envFrom:</span>
        <button
          type="button"
          onClick={() => {
            if (isSecret) {
              void openSecretDetail(namespace, envFrom.name);
            } else {
              void openConfigMapDetail(namespace, envFrom.name);
            }
          }}
          className="text-accent hover:underline cursor-pointer border-none bg-transparent p-0 font-mono font-medium"
        >
          {envFrom.name}
        </button>
        {envFrom.prefix && (
          <span className="text-[9px] text-zinc-500 font-sans">
            (prefix: <code className="text-zinc-300 font-mono">{envFrom.prefix}</code>)
          </span>
        )}
      </div>
    );
  }

  if (!entry) return null;

  switch (entry.sourceType) {
    case 'configMap':
      return (
        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-cyan-950/30 border border-cyan-500/20 text-[10px] font-mono text-cyan-200">
          <FileText className="size-3 text-cyan-400 shrink-0" />
          <span className="text-cyan-400/70 font-sans">ConfigMap:</span>
          {entry.refName ? (
            <button
              type="button"
              onClick={() => void openConfigMapDetail(namespace, entry.refName!)}
              className="text-cyan-300 hover:text-cyan-100 hover:underline cursor-pointer border-none bg-transparent p-0 font-mono font-medium"
            >
              {entry.refName}
            </button>
          ) : (
            <span className="text-zinc-400">unknown</span>
          )}
          {entry.refKey && (
            <span className="text-zinc-400">
              [<span className="text-cyan-200 font-semibold">{entry.refKey}</span>]
            </span>
          )}
        </div>
      );

    case 'secret':
      return (
        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-950/30 border border-amber-500/20 text-[10px] font-mono text-amber-200">
          <Lock className="size-3 text-amber-400 shrink-0" />
          <span className="text-amber-400/70 font-sans">Secret:</span>
          {entry.refName ? (
            <button
              type="button"
              onClick={() => void openSecretDetail(namespace, entry.refName!)}
              className="text-amber-300 hover:text-amber-100 hover:underline cursor-pointer border-none bg-transparent p-0 font-mono font-medium"
            >
              {entry.refName}
            </button>
          ) : (
            <span className="text-zinc-400">unknown</span>
          )}
          {entry.refKey && (
            <span className="text-zinc-400">
              [<span className="text-amber-200 font-semibold">{entry.refKey}</span>]
            </span>
          )}
        </div>
      );

    case 'field':
      return (
        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-purple-950/30 border border-purple-500/20 text-[10px] font-mono text-purple-200">
          <Layers className="size-3 text-purple-400 shrink-0" />
          <span className="text-purple-400/70 font-sans">Field:</span>
          <span className="font-semibold text-purple-300">{entry.fieldPath}</span>
        </div>
      );

    case 'resource':
      return (
        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-indigo-950/30 border border-indigo-500/20 text-[10px] font-mono text-indigo-200">
          <Layers className="size-3 text-indigo-400 shrink-0" />
          <span className="text-indigo-400/70 font-sans">Resource:</span>
          <span className="font-semibold text-indigo-300">{entry.resource}</span>
        </div>
      );

    default:
      return null;
  }
};

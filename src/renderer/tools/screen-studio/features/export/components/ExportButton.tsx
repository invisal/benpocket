import type { JSX } from 'react'
import { useExportAction } from '../hooks/useExportAction'
import { cn } from '../../../lib/utils'

/**
 * Top-nav export trigger. Uses whatever's currently in useExportStore
 * (defaults, or whatever was picked on the Presets page / EditorToolRail's
 * Export panel) rather than exposing format/codec/quality controls itself.
 */
export function ExportButton(): JSX.Element {
  const { status, error, progress, canExport, handleExport } = useExportAction()

  return (
    <div className="relative flex items-center">
      <button
        onClick={handleExport}
        disabled={!canExport || status === 'exporting'}
        title={canExport ? undefined : 'Record something first'}
        className={cn(
          'flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-surface transition-colors hover:brightness-110 disabled:pointer-events-none disabled:opacity-40'
        )}
      >
        {status === 'exporting' ? `Exporting… ${progress?.percent ?? 0}%` : 'Export'}
      </button>

      {status === 'error' && error && (
        <p className="absolute right-0 top-full z-20 mt-1 w-56 rounded-lg border border-red-500/30 bg-black/90 p-2 text-[11px] text-red-400 shadow-lg">
          {error}
        </p>
      )}
    </div>
  )
}

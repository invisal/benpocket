import { type EntriesPatch } from '../store/fileExplorer.store';
import { getCapabilitiesForLocation } from './capabilities';

export type OpResult<T extends object = object> = ({ success: true } & T) | { error: string };

export interface DispatchMutationOptions<T extends object = object> {
  /** The location the mutation applies to -- determines which sync strategy runs. */
  locationUri: string;
  run: () => Promise<OpResult<T>>;
  onSuccess?: (result: { success: true } & T) => void;
  onError?: (message: string) => void;
  /** 'sync' strategy: forces a full refetch after the op resolves successfully. */
  onRefetch: () => void;
  /** 'optimistic' strategy: predicted change, applied immediately and rolled back on failure. */
  optimisticPatch?: EntriesPatch;
  onApplyPatch?: (patch: EntriesPatch) => void;
  onRevertPatch?: (patch: EntriesPatch) => void;
}

/**
 * Runs a mutating file-explorer operation according to the current location's
 * declared `capabilities.sync` strategy, instead of every call site hardcoding
 * "await the op, then bumpRefresh()".
 */
export async function dispatchMutation<T extends object = object>(
  options: DispatchMutationOptions<T>
): Promise<void> {
  const {
    locationUri,
    run,
    onSuccess,
    onError,
    onRefetch,
    optimisticPatch,
    onApplyPatch,
    onRevertPatch
  } = options;
  const { sync } = getCapabilitiesForLocation(locationUri);

  if (sync === 'optimistic' && optimisticPatch) {
    onApplyPatch?.(optimisticPatch);
  }

  const result = await run();

  if ('error' in result) {
    if (sync === 'optimistic' && optimisticPatch) {
      onRevertPatch?.(optimisticPatch);
    }
    onError?.(result.error);
    return;
  }

  onSuccess?.(result);

  if (sync === 'sync' || (sync === 'optimistic' && !optimisticPatch)) {
    onRefetch();
  }
  // 'optimistic' with a patch supplied: the applied patch already reflects the change; no refetch.
  // 'watch': the change stream is the source of truth; mutations don't drive refresh.
}

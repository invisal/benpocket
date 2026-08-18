import { InferenceSession } from 'onnxruntime-node';

const sessions = new Map<string, Promise<InferenceSession>>();

function executionProviders(): InferenceSession.ExecutionProviderConfig[] {
  if (process.platform === 'win32') return ['dml', 'cpu'];
  if (process.platform === 'darwin') return ['coreml', 'cpu'];
  return ['cpu'];
}

/**
 * Loads and caches an ONNX session for `path`, keyed by `key` (callers namespace this per model,
 * e.g. `upscale:x4v3` / `bg-remove:u2netp`, since different tools' models can share an id).
 * Sessions are kept alive for the app session -- creation loads and compiles the graph, which is
 * too slow to redo on every Apply click. Falls back to CPU if a GPU execution provider
 * (DirectML/CoreML) fails to load, e.g. on a machine without a compatible GPU/driver.
 */
export function loadSession(key: string, path: string): Promise<InferenceSession> {
  const cached = sessions.get(key);
  if (cached) return cached;

  const promise = InferenceSession.create(path, {
    executionProviders: executionProviders()
  }).catch(async (err) => {
    console.warn(
      `[image-editor] GPU execution provider unavailable for ${key}, falling back to CPU:`,
      err
    );
    return InferenceSession.create(path, { executionProviders: ['cpu'] });
  });

  sessions.set(key, promise);
  promise.catch(() => sessions.delete(key));
  return promise;
}

import { spawn } from 'child_process';

interface SimctlDevice {
  name: string;
  state: string;
}

/**
 * Name of the currently booted iOS Simulator device, or `null` if none is
 * booted (or Xcode Command Line Tools/`xcrun` aren't installed -- both cases
 * collapse to the same "not available" result). Used to spot the Simulator
 * app's window among the generic `desktopCapturer` window list (see
 * `screen-source-provider.ts`) -- recording itself just goes through the
 * normal window-capture path, not a Simulator-specific one.
 */
export function getBootedSimulatorName(): Promise<string | null> {
  // `xcrun`/the iOS Simulator only exist on macOS -- skip the spawn
  // entirely on Windows/Linux rather than relying on it failing with
  // ENOENT every time a source list loads or a recording starts.
  if (process.platform !== 'darwin') return Promise.resolve(null);

  return new Promise((resolve) => {
    const proc = spawn('xcrun', ['simctl', 'list', 'devices', 'booted', '-j']);
    let stdout = '';
    proc.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
    proc.on('error', () => resolve(null));
    proc.on('close', () => {
      try {
        const parsed = JSON.parse(stdout) as { devices: Record<string, SimctlDevice[]> };
        for (const runtimeDevices of Object.values(parsed.devices)) {
          const booted = runtimeDevices.find((d) => d.state === 'Booted');
          if (booted) {
            resolve(booted.name);
            return;
          }
        }
        resolve(null);
      } catch {
        resolve(null);
      }
    });
  });
}

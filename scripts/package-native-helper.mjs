#!/usr/bin/env node
// Copies a built native recording helper binary into native/bin/<platform>-<arch>/,
// the location recording-helper.ts's helperCandidates() resolves against for a
// packaged build (see electron-builder.yml's extraResources entry, which bundles
// that whole directory into the app's resources). Local dev doesn't need this --
// recording-helper.ts also resolves the raw swift/cmake build output directly.
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv[2];

const targets = {
  macos: {
    platform: 'darwin',
    src: (arch) =>
      join(
        rootDir,
        'native/macos-recorder/.build',
        arch === 'arm64' ? 'arm64-apple-macosx' : 'x86_64-apple-macosx',
        'release/benpocket-macos-recorder-helper'
      ),
    fileName: 'benpocket-macos-recorder-helper'
  },
  windows: {
    platform: 'win32',
    src: () =>
      join(rootDir, 'native/windows-recorder/build/Release/benpocket-windows-recorder-helper.exe'),
    fileName: 'benpocket-windows-recorder-helper.exe'
  },
  linux: {
    platform: 'linux',
    src: () => join(rootDir, 'native/linux-recorder/build/benpocket-linux-recorder-helper'),
    fileName: 'benpocket-linux-recorder-helper'
  }
};

const entry = targets[target];
if (!entry) {
  console.error(
    `Unknown native helper target "${target}" -- expected one of: ${Object.keys(targets).join(', ')}`
  );
  process.exit(1);
}

const arch = process.arch;
const src = entry.src(arch);
const destDir = join(rootDir, 'native/bin', `${entry.platform}-${arch}`);
const dest = join(destDir, entry.fileName);

mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log(`[package-native-helper] copied ${src} -> ${dest}`);

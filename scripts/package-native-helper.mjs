#!/usr/bin/env node
// Copies a built native recording helper binary into native/bin/<platform>-<arch>/,
// the location recording-helper.ts's helperCandidates() resolves against for a
// packaged build (see electron-builder.yml's extraResources entry, which bundles
// that whole directory into the app's resources). Local dev doesn't need this --
// recording-helper.ts also resolves the raw swift/cmake build output directly.
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv[2];

const targets = {
  windows: {
    platform: 'win32',
    src: () =>
      join(rootDir, 'native/windows-recorder/build/Release/benpocket-windows-recorder-helper.exe'),
    fileName: 'benpocket-windows-recorder-helper.exe'
  },
  linux: {
    platform: 'linux',
    // Two independent binaries share one cmake build (see
    // native/linux-recorder/CMakeLists.txt): the screen/window capture
    // helper and the CLIPBOARD selection-owner helper used by
    // copy-file-to-clipboard.ts.
    files: [
      {
        src: () => join(rootDir, 'native/linux-recorder/build/benpocket-linux-recorder-helper'),
        fileName: 'benpocket-linux-recorder-helper'
      },
      {
        src: () => join(rootDir, 'native/linux-recorder/build/benpocket-linux-clipboard-helper'),
        fileName: 'benpocket-linux-clipboard-helper'
      }
    ]
  }
};

if (target === 'macos') {
  // build:native:macos compiles both slices separately (`swift build --arch
  // arm64` then `--arch x86_64`) rather than one `--arch arm64 --arch
  // x86_64` invocation -- SwiftPM routes multi-arch requests through a
  // different build system (Apple/XCBuild, `.build/apple/...`) that fails
  // on this package's `main.swift` + `@main` combo ("'main' attribute
  // cannot be used in a module that contains top-level code"). Two
  // single-arch builds use the same plain SwiftPM path that already works,
  // then get lipo'd into one universal binary here. Without this, a
  // release built on GitHub's arm64-only `macos-latest` runner would ship
  // an arm64-only helper -- Intel Mac users would get no matching
  // candidate in findHelperPath() and silently fall back to MediaRecorder.
  const fileName = 'benpocket-macos-recorder-helper';
  const arm64Src = join(
    rootDir,
    'native/macos-recorder/.build/arm64-apple-macosx/release',
    fileName
  );
  const x64Src = join(
    rootDir,
    'native/macos-recorder/.build/x86_64-apple-macosx/release',
    fileName
  );

  for (const arch of ['darwin-arm64', 'darwin-x64']) {
    const destDir = join(rootDir, 'native/bin', arch);
    mkdirSync(destDir, { recursive: true });
    const dest = join(destDir, fileName);
    const result = spawnSync('lipo', ['-create', arm64Src, x64Src, '-output', dest], {
      stdio: 'inherit'
    });
    if (result.status !== 0) process.exit(result.status ?? 1);
    console.log(`[package-native-helper] merged universal binary -> ${dest}`);
  }
  process.exit(0);
}

const entry = targets[target];
if (!entry) {
  console.error(
    `Unknown native helper target "${target}" -- expected one of: macos, ${Object.keys(targets).join(', ')}`
  );
  process.exit(1);
}

const arch = process.arch;
const destDir = join(rootDir, 'native/bin', `${entry.platform}-${arch}`);
mkdirSync(destDir, { recursive: true });

const files = entry.files ?? [{ src: entry.src, fileName: entry.fileName }];
for (const file of files) {
  const src = file.src(arch);
  const dest = join(destDir, file.fileName);
  copyFileSync(src, dest);
  console.log(`[package-native-helper] copied ${src} -> ${dest}`);
}

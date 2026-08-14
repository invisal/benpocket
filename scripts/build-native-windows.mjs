#!/usr/bin/env node
// Configures, builds, and packages the Windows native recording helper
// (native/windows-recorder). Exists as a wrapper around plain `cmake` because
// Visual Studio Build Tools ships its own private copy of CMake for internal
// IDE/MSBuild use but does NOT put it on PATH -- a plain `cmake` invocation
// from an ordinary terminal (not a "Developer Command Prompt") fails with
// "'cmake' is not recognized" even on a machine that has everything needed
// installed. This locates a usable cmake.exe itself instead of assuming one
// is already on PATH. (No vcvars/dev-prompt env is needed beyond that --
// CMake's "Visual Studio" generator locates the MSVC toolchain on its own.)
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');

const onPath = spawnSync('cmake', ['--version'], { stdio: 'ignore' });
let cmake = !onPath.error && onPath.status === 0 ? 'cmake' : null;

if (!cmake) {
  const vswhere = join(
    process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)',
    'Microsoft Visual Studio',
    'Installer',
    'vswhere.exe'
  );
  const vswhereResult = existsSync(vswhere)
    ? spawnSync(vswhere, ['-products', '*', '-property', 'installationPath'], { encoding: 'utf8' })
    : null;
  const vsRoots = (vswhereResult?.stdout ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const candidates = [
    join(process.env.ProgramFiles ?? 'C:\\Program Files', 'CMake', 'bin', 'cmake.exe'),
    ...vsRoots.map((root) =>
      join(
        root,
        'Common7',
        'IDE',
        'CommonExtensions',
        'Microsoft',
        'CMake',
        'CMake',
        'bin',
        'cmake.exe'
      )
    )
  ];
  cmake = candidates.find((candidate) => existsSync(candidate)) ?? null;
}

if (!cmake) {
  console.error(
    '[build-native-windows] Could not find cmake.exe -- install CMake (cmake.org) or the ' +
      '"C++ CMake tools for Windows" component of Visual Studio Build Tools, or run this ' +
      'from a "Developer Command Prompt for VS" where cmake is already on PATH.'
  );
  process.exit(1);
}
console.log(`[build-native-windows] using cmake: ${cmake}`);

const srcDir = join(rootDir, 'native', 'windows-recorder');
const buildDir = join(srcDir, 'build');

for (const args of [
  ['-S', srcDir, '-B', buildDir],
  ['--build', buildDir, '--config', 'Release']
]) {
  const result = spawnSync(cmake, args, { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const pack = spawnSync('node', [join(rootDir, 'scripts', 'package-native-helper.mjs'), 'windows'], {
  stdio: 'inherit'
});
process.exit(pack.status ?? 0);

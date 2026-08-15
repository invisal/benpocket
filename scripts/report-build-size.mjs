#!/usr/bin/env node
// Measures the renderer's JS bundle size (from the rollup-plugin-visualizer
// raw-data output -- see electron.vite.config.ts) and this OS's packaged app
// size. Always writes size-report.json locally (consumed by the PR size-diff
// comment job); also POSTs to benpocket-backend so size can be tracked over
// time on main, when BENPOCKET_BACKEND_URL/CI_METRICS_SECRET are set (push to
// main only -- see .github/workflows/ci.yml). Runs once per CI matrix leg
// (win/mac/linux) after packaging.
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');

const PLATFORMS = {
  win32: { platform: 'win', artifact: (version) => `dist/benpocket-${version}-setup.exe` },
  darwin: { platform: 'mac', artifact: (version) => `dist/benpocket-${version}.dmg` },
  linux: { platform: 'linux', artifact: (version) => `dist/benpocket-${version}.AppImage` }
};

const platformInfo = PLATFORMS[process.platform];
if (!platformInfo) {
  console.error(`[report-build-size] unsupported platform: ${process.platform}`);
  process.exit(1);
}

const { version } = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8'));

let rendererJsBytes;
try {
  const stats = JSON.parse(readFileSync(join(rootDir, 'stats-renderer.json'), 'utf8'));
  rendererJsBytes = Object.values(stats.nodeParts).reduce(
    (sum, part) => sum + part.renderedLength,
    0
  );
} catch (err) {
  console.error(`[report-build-size] failed to read stats-renderer.json: ${err.message}`);
  process.exit(1);
}

const artifactPath = join(rootDir, platformInfo.artifact(version));
let packagedBytes;
try {
  packagedBytes = statSync(artifactPath).size;
} catch (err) {
  console.error(`[report-build-size] failed to stat ${artifactPath}: ${err.message}`);
  process.exit(1);
}

const payload = {
  commitSha: process.env.COMMIT_SHA,
  branch: process.env.BRANCH || 'main',
  platform: platformInfo.platform,
  appVersion: version,
  rendererJsBytes,
  packagedBytes
};
console.log(`[report-build-size] ${JSON.stringify(payload)}`);

writeFileSync(join(rootDir, 'size-report.json'), JSON.stringify(payload));

// A misconfigured/unreachable backend shouldn't turn main red -- the packaging
// steps above already validated the build itself. Just warn and move on.
const backendUrl = process.env.BENPOCKET_BACKEND_URL;
const secret = process.env.CI_METRICS_SECRET;
if (!backendUrl || !secret || !payload.commitSha) {
  console.warn(
    '[report-build-size] missing BENPOCKET_BACKEND_URL, CI_METRICS_SECRET, or COMMIT_SHA -- skipping report'
  );
} else {
  try {
    const res = await fetch(`${backendUrl}/api/build-metrics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      console.warn(`[report-build-size] backend responded ${res.status}: ${await res.text()}`);
    }
  } catch (err) {
    console.warn(`[report-build-size] failed to reach backend: ${err.message}`);
  }
}

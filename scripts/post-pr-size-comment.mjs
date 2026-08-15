#!/usr/bin/env node
// Builds the PR size-diff comment body: renderer bundle + per-OS packaged app
// size, comparing this PR's build (size-report.json from each matrix leg,
// downloaded into reports/<artifact-name>/) against the latest size reported
// for main (fetched from benpocket-backend). Writes body.md, which the
// "Post/update PR comment" step in .github/workflows/ci.yml posts via `gh`.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const reportsDir = join(rootDir, 'reports');

const ROWS = [
  { platform: 'win', label: 'Windows installer' },
  { platform: 'mac', label: 'macOS installer' },
  { platform: 'linux', label: 'Linux installer (AppImage)' }
];

const prReports = {};
try {
  for (const entry of readdirSync(reportsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const reportPath = join(reportsDir, entry.name, 'size-report.json');
    try {
      const report = JSON.parse(readFileSync(reportPath, 'utf8'));
      prReports[report.platform] = report;
    } catch (err) {
      console.warn(`[post-pr-size-comment] skipping ${reportPath}: ${err.message}`);
    }
  }
} catch (err) {
  console.warn(`[post-pr-size-comment] failed to read ${reportsDir}: ${err.message}`);
}

// No branch filter -- report-build-size.mjs only POSTs on pushes to main
// (ci.yml's push trigger is scoped to branches: [main]), so every row the
// backend holds already is a main row. Public read-only endpoint, no auth.
const backend = {
  fetchBaseline: async (url) => {
    const baseline = {};
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[post-pr-size-comment] backend responded ${res.status}: ${await res.text()}`);
      return baseline;
    }
    // Response is an object keyed by platform, with snake_case fields --
    // normalize to the camelCase shape used by size-report.json/fmt.cell.
    const data = await res.json();
    for (const row of Object.values(data)) {
      if (!row) continue;
      baseline[row.platform] = {
        commitSha: row.commit_sha,
        rendererJsBytes: row.renderer_js_bytes,
        packagedBytes: row.packaged_bytes
      };
    }
    return baseline;
  }
};

let baseline = {};
try {
  // Prefer the exact commit this PR branched from (base.sha from the
  // pull_request event, passed in as BASE_COMMIT_SHA -- see ci.yml) so the
  // diff isn't polluted by unrelated commits that landed on main after the
  // branch was created. Falls back to whatever main last reported if that
  // commit was never built (e.g. its CI run was skipped/failed) or no base
  // commit was given at all.
  const baseCommitSha = process.env.BASE_COMMIT_SHA;
  if (baseCommitSha) {
    baseline = await backend.fetchBaseline(
      `https://benpocket.com/api/build-metrics/latest?commit=${encodeURIComponent(baseCommitSha)}`
    );
  }
  if (Object.keys(baseline).length === 0) {
    baseline = await backend.fetchBaseline('https://benpocket.com/api/build-metrics/latest');
  }
} catch (err) {
  console.warn(`[post-pr-size-comment] failed to reach backend: ${err.message}`);
}

const fmt = {
  bytes: (bytes) => {
    const sign = bytes < 0 ? '-' : '';
    return `${sign}${(Math.abs(bytes) / (1024 * 1024)).toFixed(2)} MB`;
  },
  // Auto-scales the unit so small diffs (a few bytes/KB) don't round to "0.00 MB".
  deltaBytes: (bytes) => {
    const sign = bytes < 0 ? '-' : '+';
    const abs = Math.abs(bytes);
    if (abs === 0) return '0 B';
    if (abs < 1024) return `${sign}${abs} B`;
    if (abs < 1024 * 1024) return `${sign}${(abs / 1024).toFixed(2)} KB`;
    return `${sign}${(abs / (1024 * 1024)).toFixed(2)} MB`;
  },
  delta: (before, after) => {
    if (before === undefined || after === undefined) return '—';
    const diff = after - before;
    const sign = diff >= 0 ? '+' : '';
    const pct = before === 0 ? '—' : `${sign}${((diff / before) * 100).toFixed(2)}%`;
    return `${fmt.deltaBytes(diff)} (${pct})`;
  },
  cell: (report, key) => {
    if (!report) return '_build failed_';
    const value = report[key];
    return typeof value === 'number' ? fmt.bytes(value) : '—';
  }
};

const rendererAfterReport = Object.values(prReports)[0];
const rendererBeforeReport = Object.values(baseline)[0];

const lines = [];
lines.push('<!-- renderer-size-report -->');
lines.push('### Build size — before vs after this PR');
lines.push('');
lines.push('| | Before (main) | After (this PR) | Δ |');
lines.push('|---|---|---|---|');
lines.push(
  `| Renderer bundle (uncompressed JS) | ${fmt.cell(rendererBeforeReport, 'rendererJsBytes')} | ${fmt.cell(rendererAfterReport, 'rendererJsBytes')} | ${fmt.delta(rendererBeforeReport?.rendererJsBytes, rendererAfterReport?.rendererJsBytes)} |`
);
for (const { platform, label } of ROWS) {
  const before = baseline[platform];
  const after = prReports[platform];
  lines.push(
    `| ${label} | ${fmt.cell(before, 'packagedBytes')} | ${fmt.cell(after, 'packagedBytes')} | ${fmt.delta(before?.packagedBytes, after?.packagedBytes)} |`
  );
}
lines.push('');
lines.push(
  Object.keys(baseline).length > 0
    ? `Baseline: commit \`${Object.values(baseline)[0].commitSha?.slice(0, 7)}\` on main.`
    : '_No baseline found on main yet -- this may be the first build reported._'
);

writeFileSync(join(rootDir, 'body.md'), lines.join('\n') + '\n');
console.log(`[post-pr-size-comment] wrote body.md`);

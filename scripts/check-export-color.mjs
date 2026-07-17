// Self-check for the export color pipeline (video-encoder.ts).
//
// Verifies, against the real bundled ffmpeg:
//   1. `-vf` on the video stream legally coexists with the audio-only
//      `-filter_complex` (the exact arg structure createEncoder builds).
//   2. The BT.709 conversion + tags actually land in the output file.
//   3. A known color survives the RGBA -> yuv420p -> RGBA round trip, which
//      fails if the conversion matrix and the written tags ever disagree.
//
// Run: npm run check:capture

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const ffmpeg = require('ffmpeg-static');
const ffprobe = require('ffprobe-static').path;

const root = join(import.meta.dirname, '..');
const workDir = join(root, 'node_modules', '.cache', 'craftbox-color-check');
rmSync(workDir, { recursive: true, force: true });
mkdirSync(workDir, { recursive: true });

// --- 1. Source coupling: the strings this check exercises must be the ones
// video-encoder.ts actually uses. If someone edits the encoder recipe, this
// check must be updated (or it fails here).
const encoderSource = readFileSync(
  join(root, 'src/main/screen-recorder/export/video-encoder.ts'),
  'utf8'
);
const VIDEO_FILTERS = ['scale=out_color_matrix=bt709:out_range=tv', 'format=yuv420p'];
const COLOR_FLAGS = [
  ['-colorspace', 'bt709'],
  ['-color_primaries', 'bt709'],
  ['-color_trc', 'bt709'],
  ['-color_range', 'tv']
];
for (const filter of VIDEO_FILTERS) {
  assert.ok(encoderSource.includes(filter), `video-encoder.ts no longer uses "${filter}"`);
}
for (const [flag, value] of COLOR_FLAGS) {
  assert.ok(
    encoderSource.includes(`'${flag}'`) && encoderSource.includes(`'${value}'`),
    `video-encoder.ts no longer sets ${flag} ${value}`
  );
}

// --- 2. Build a tiny mp4 with the same argument structure as createEncoder:
// rawvideo RGBA on stdin, an audio input carved by -filter_complex, and the
// color recipe on the video stream.
const size = 64;
const frames = 15;
const red = Buffer.alloc(size * size * 4);
for (let i = 0; i < red.length; i += 4) {
  red[i] = 255; // R
  red[i + 3] = 255; // A
}
const rawVideo = Buffer.concat(Array.from({ length: frames }, () => red));

const audioPath = join(workDir, 'audio.webm');
execFileSync(ffmpeg, [
  '-hide_banner',
  '-loglevel',
  'error',
  '-f',
  'lavfi',
  '-i',
  'anullsrc=r=48000:cl=stereo',
  '-t',
  '1',
  '-c:a',
  'libopus',
  audioPath
]);

const outPath = join(workDir, 'out.mp4');
const encode = spawnSync(
  ffmpeg,
  [
    '-hide_banner',
    '-loglevel',
    'error',
    '-f',
    'rawvideo',
    '-pix_fmt',
    'rgba',
    '-s',
    `${size}x${size}`,
    '-r',
    '30',
    '-i',
    'pipe:0',
    '-i',
    audioPath,
    '-filter_complex',
    '[1:a]atrim=start=0:end=0.5,asetpts=PTS-STARTPTS[aout]',
    '-map',
    '0:v',
    '-map',
    '[aout]',
    '-shortest',
    '-c:v',
    'libx264',
    '-vf',
    VIDEO_FILTERS.join(','),
    '-pix_fmt',
    'yuv420p',
    ...COLOR_FLAGS.flat(),
    '-crf',
    '23',
    '-preset',
    'veryfast',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-movflags',
    '+faststart',
    '-f',
    'mp4',
    outPath
  ],
  { input: rawVideo }
);
assert.equal(
  encode.status,
  0,
  `ffmpeg encode failed (-vf may conflict with -filter_complex):\n${encode.stderr}`
);

// --- 3. The color tags must be present in the output stream.
const probed = JSON.parse(
  execFileSync(ffprobe, [
    '-v',
    'error',
    '-select_streams',
    'v:0',
    '-show_streams',
    '-of',
    'json',
    outPath
  ]).toString()
).streams[0];

assert.equal(probed.pix_fmt, 'yuv420p');
assert.equal(probed.color_space, 'bt709', 'output not tagged bt709 (matrix)');
assert.equal(probed.color_transfer, 'bt709', 'output not tagged bt709 (transfer)');
assert.equal(probed.color_primaries, 'bt709', 'output not tagged bt709 (primaries)');
assert.equal(probed.color_range, 'tv', 'output not tagged tv range');

// --- 4. Round trip: decode explicitly per the written tags. If the pixels
// were converted with a different matrix than the tags claim (the exact bug
// this recipe fixes), pure red comes back visibly shifted and this fails.
const decoded = spawnSync(ffmpeg, [
  '-hide_banner',
  '-loglevel',
  'error',
  '-i',
  outPath,
  '-frames:v',
  '1',
  '-vf',
  'scale=in_color_matrix=bt709:in_range=tv',
  '-f',
  'rawvideo',
  '-pix_fmt',
  'rgba',
  'pipe:1'
]);
assert.equal(decoded.status, 0, `ffmpeg decode failed:\n${decoded.stderr}`);
const [r, g, b] = decoded.stdout;
const tolerance = 10; // yuv420p subsampling + limited-range rounding
assert.ok(
  Math.abs(r - 255) <= tolerance && g <= tolerance && b <= tolerance,
  `red round-tripped to rgb(${r},${g},${b}) -- conversion matrix and tags disagree`
);

rmSync(workDir, { recursive: true, force: true });
console.log('check-export-color: OK (flags coexist, tags written, colors round-trip)');

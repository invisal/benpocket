import { describe, expect, it } from 'vitest';
import { isSourceCopyEligible } from './export-orchestrator';
import type { ExportOptions, ExportSegment } from '@screen-recorder/types/export';
import type { Project } from '@screen-recorder/types/project';

const SOURCE_INFO = { width: 1920, height: 1080, durationMs: 10_000 };

function baseSegment(overrides: Partial<ExportSegment> = {}): ExportSegment {
  return {
    range: { startMs: 0, endMs: SOURCE_INFO.durationMs },
    speed: 1,
    cursorHidden: false,
    webcamHidden: false,
    audioMuted: false,
    audioVolume: 1,
    ...overrides
  };
}

function baseProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    name: 'test',
    createdAt: 0,
    updatedAt: 0,
    source: 'recorded',
    sourceVideoPath: '/tmp/source.mp4',
    durationMs: SOURCE_INFO.durationMs,
    tracks: [],
    zoomKeyframes: [],
    webcam: {
      enabled: false,
      shape: 'circle',
      mirrored: false,
      position: { x: 0, y: 0 },
      size: 100,
      shadow: 0
    },
    webcamVideoPath: null,
    webcamOffsetMs: 0,
    background: {
      enabled: false,
      kind: 'color',
      value: '#000000',
      padding: 0,
      blur: 0,
      cornerRadius: 0,
      shadow: 0
    },
    cursor: {
      visible: true,
      clipToCanvas: false,
      style: 'coal',
      size: 4.5,
      smoothing: 0.67,
      motionBlur: 0,
      clickBounce: 2.5,
      clickRippleEnabled: false,
      clickSoundEnabled: false,
      handGestureEnabled: true
    },
    cursorPath: [],
    clickPath: [],
    resizePath: [],
    crosshairPath: [],
    textSelectPath: [],
    captions: { enabled: false, language: 'en', segments: [] },
    annotations: [],
    blurMasks: [],
    motionBlur: false,
    crop: null,
    ...overrides
  };
}

function baseOptions(overrides: Partial<ExportOptions> = {}): ExportOptions {
  return {
    format: 'mp4',
    codec: 'h264',
    aspectRatio: '16:9',
    resolution: { width: SOURCE_INFO.width, height: SOURCE_INFO.height },
    frameRate: 30,
    quality: 1,
    includeAudio: true,
    outputPath: '/tmp/out.mp4',
    sourceVideoPath: '/tmp/source.mp4',
    crop: null,
    segments: [baseSegment()],
    project: baseProject(),
    ...overrides
  };
}

describe('isSourceCopyEligible', () => {
  it('is eligible for an untouched, single-segment, no-cursor-data export', () => {
    expect(isSourceCopyEligible(baseOptions(), SOURCE_INFO)).toBe(true);
  });

  it('is ineligible when the cursor overlay would actually be drawn -- regression case: the byte-copy path skips the whole render pass (evaluateSceneAtMs/resolveCursor), which is the only place cursor/ripple/gesture icons are drawn, so taking it silently produces an export with none of them', () => {
    const options = baseOptions({
      project: baseProject({ cursorPath: [{ atMs: 0, x: 0.5, y: 0.5 }] })
    });
    expect(isSourceCopyEligible(options, SOURCE_INFO)).toBe(false);
  });

  it('stays eligible when cursor.visible is off, even with recorded cursor data -- resolveCursor would draw nothing either way', () => {
    const options = baseOptions({
      project: baseProject({
        cursorPath: [{ atMs: 0, x: 0.5, y: 0.5 }],
        cursor: { ...baseProject().cursor, visible: false }
      })
    });
    expect(isSourceCopyEligible(options, SOURCE_INFO)).toBe(true);
  });

  it('stays eligible when the single segment has cursorHidden set, even with recorded cursor data', () => {
    const options = baseOptions({
      segments: [baseSegment({ cursorHidden: true })],
      project: baseProject({ cursorPath: [{ atMs: 0, x: 0.5, y: 0.5 }] })
    });
    expect(isSourceCopyEligible(options, SOURCE_INFO)).toBe(true);
  });

  it('stays eligible with cursor visible but no recorded cursor data at all (nothing for resolveCursor to draw)', () => {
    const options = baseOptions({
      project: baseProject({ cursorPath: [] })
    });
    expect(isSourceCopyEligible(options, SOURCE_INFO)).toBe(true);
  });

  it('is ineligible for a resolution mismatch', () => {
    expect(
      isSourceCopyEligible(baseOptions({ resolution: { width: 1280, height: 720 } }), SOURCE_INFO)
    ).toBe(false);
  });

  it('is ineligible when a crop is set', () => {
    expect(
      isSourceCopyEligible(
        baseOptions({ crop: { x: 0, y: 0, width: 0.5, height: 0.5 } }),
        SOURCE_INFO
      )
    ).toBe(false);
  });
});

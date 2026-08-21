import { describe, expect, it } from 'vitest';
import {
  blendSizeCalibrationRatio,
  estimateExport,
  estimateRawExportBytes
} from './estimate-export';

const BASE_OPTIONS = {
  durationMs: 10_000,
  width: 1920,
  height: 1080,
  frameRate: 30,
  quality: 75,
  includeAudio: false,
  format: 'mp4' as const,
  hasWebcam: false
};

describe('estimateExport', () => {
  it('matches the raw estimate when no calibration ratio is given', () => {
    const raw = estimateRawExportBytes(BASE_OPTIONS);
    expect(estimateExport(BASE_OPTIONS).fileSizeBytes).toBe(raw);
  });

  it('scales file size by the calibration ratio, without affecting the time estimate', () => {
    const uncalibrated = estimateExport(BASE_OPTIONS);
    const calibrated = estimateExport(BASE_OPTIONS, 0.4);
    expect(calibrated.fileSizeBytes).toBeCloseTo(uncalibrated.fileSizeBytes * 0.4);
    expect(calibrated.timeSeconds).toBe(uncalibrated.timeSeconds);
  });
});

describe('blendSizeCalibrationRatio', () => {
  it('fully replaces the ratio on the first sample (no prior belief to blend against)', () => {
    expect(blendSizeCalibrationRatio(1, false, 1000, 500)).toBeCloseTo(0.5);
    expect(blendSizeCalibrationRatio(1, false, 1000, 250)).toBeCloseTo(0.25);
  });

  it('moves the ratio toward a later sample, not straight to it', () => {
    // A real export at exactly half the running ratio's prediction should
    // pull the ratio down, but not all the way in one sample (EMA, not a
    // straight replace) once there's a real prior belief to blend against.
    const next = blendSizeCalibrationRatio(1, true, 1000, 500);
    expect(next).toBeLessThan(1);
    expect(next).toBeGreaterThan(0.5);
  });

  it('converges toward the true ratio over repeated identical later samples', () => {
    let ratio = blendSizeCalibrationRatio(1, false, 1000, 300);
    for (let i = 0; i < 50; i++) {
      ratio = blendSizeCalibrationRatio(ratio, true, 1000, 300);
    }
    expect(ratio).toBeCloseTo(0.3, 2);
  });

  it('leaves the ratio unchanged for a degenerate (zero/negative) sample', () => {
    expect(blendSizeCalibrationRatio(0.8, true, 0, 500)).toBe(0.8);
    expect(blendSizeCalibrationRatio(0.8, true, 1000, 0)).toBe(0.8);
    expect(blendSizeCalibrationRatio(0.8, true, -100, 500)).toBe(0.8);
    expect(blendSizeCalibrationRatio(0.8, false, 0, 500)).toBe(0.8);
  });

  it('clamps to the configured min/max even for an extreme single sample', () => {
    expect(blendSizeCalibrationRatio(1, false, 1000, 1)).toBeGreaterThanOrEqual(0.05);
    expect(blendSizeCalibrationRatio(1, false, 1, 1000)).toBeLessThanOrEqual(1.5);
  });
});

import type { InnerRect } from './types';

/** Content area inset by `background.padding` (% of the shorter output dimension), contain-fit to the source aspect ratio. */
export function computeInnerRect(
  outputWidth: number,
  outputHeight: number,
  sourceAspect: number,
  paddingPercent: number
): InnerRect {
  const pad = (paddingPercent / 100) * Math.min(outputWidth, outputHeight);
  const availWidth = Math.max(1, outputWidth - pad * 2);
  const availHeight = Math.max(1, outputHeight - pad * 2);
  const availAspect = availWidth / availHeight;

  const width = sourceAspect > availAspect ? availWidth : availHeight * sourceAspect;
  const height = sourceAspect > availAspect ? availWidth / sourceAspect : availHeight;

  return {
    x: Math.round((outputWidth - width) / 2),
    y: Math.round((outputHeight - height) / 2),
    width: Math.round(width),
    height: Math.round(height)
  };
}

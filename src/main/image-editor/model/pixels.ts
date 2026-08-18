import sharp from 'sharp';

export interface RawPlane {
  data: Buffer;
  width: number;
  height: number;
}

export interface DecodedRgba {
  rgb: RawPlane;
  /** Present only if the source has an alpha channel. */
  alpha: RawPlane | null;
}

export async function decodeRgba(input: Uint8Array): Promise<DecodedRgba> {
  const buffer = Buffer.from(input);
  const metadata = await sharp(buffer).metadata();

  const { data, info } = await sharp(buffer)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let alpha: RawPlane | null = null;
  if (metadata.hasAlpha) {
    const alphaData = await sharp(buffer).extractChannel('alpha').raw().toBuffer();
    alpha = { data: alphaData, width: info.width, height: info.height };
  }

  return { rgb: { data, width: info.width, height: info.height }, alpha };
}

/**
 * Resizes `alpha` up to `rgb`'s dimensions (a no-op resize when they already match, e.g.
 * bg-remove's mask) and joins it back on. Returns plain RGB (no channel join) when there was no
 * alpha to begin with.
 */
export async function recombineWithAlpha(
  rgb: RawPlane,
  alpha: RawPlane | null
): Promise<{ data: Buffer; width: number; height: number; channels: 3 | 4 }> {
  if (!alpha) {
    return { data: rgb.data, width: rgb.width, height: rgb.height, channels: 3 };
  }

  const resizedAlpha = await sharp(alpha.data, {
    raw: { width: alpha.width, height: alpha.height, channels: 1 }
  })
    .resize(rgb.width, rgb.height, { kernel: sharp.kernel.lanczos3 })
    // libvips silently widens a single-band raw buffer to 3 bands (sRGB) as it passes through
    // resize -- without this, `.raw().toBuffer()` below returns 3x the bytes `joinChannel`'s
    // `channels: 1` declaration expects, which desyncs every row after the first and shows up as
    // diagonal stripe corruption in the final image. Forcing back to a single band here recovers
    // the (correctly resized, just mis-tagged) greyscale data losslessly.
    .toColourspace('b-w')
    .raw()
    .toBuffer();

  const data = await sharp(rgb.data, {
    raw: { width: rgb.width, height: rgb.height, channels: 3 }
  })
    .joinChannel(resizedAlpha, {
      raw: { width: rgb.width, height: rgb.height, channels: 1 }
    })
    .raw()
    .toBuffer();

  return { data, width: rgb.width, height: rgb.height, channels: 4 };
}

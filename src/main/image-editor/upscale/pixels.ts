import sharp from 'sharp';

export interface RawPlane {
  data: Buffer;
  width: number;
  height: number;
}

export interface DecodedForUpscale {
  rgb: RawPlane;
  /** Present only if the source has an alpha channel -- the ONNX graph has no alpha input, so
   * this is upscaled separately (plain Lanczos resize) and recombined after inference. */
  alpha: RawPlane | null;
}

export async function decodeForUpscale(input: Uint8Array): Promise<DecodedForUpscale> {
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
 * Resizes `alpha` (the *original*, pre-upscale, alpha plane) up to `upscaledRgb`'s dimensions and
 * joins it back on, so transparency survives upscaling even though the network itself only ever
 * sees RGB. Returns plain RGB (no channel join) when there was no alpha to begin with.
 */
export async function recombineWithAlpha(
  upscaledRgb: RawPlane,
  alpha: RawPlane | null
): Promise<{ data: Buffer; width: number; height: number; channels: 3 | 4 }> {
  if (!alpha) {
    return {
      data: upscaledRgb.data,
      width: upscaledRgb.width,
      height: upscaledRgb.height,
      channels: 3
    };
  }

  const upscaledAlpha = await sharp(alpha.data, {
    raw: { width: alpha.width, height: alpha.height, channels: 1 }
  })
    .resize(upscaledRgb.width, upscaledRgb.height, { kernel: sharp.kernel.lanczos3 })
    .raw()
    .toBuffer();

  const data = await sharp(upscaledRgb.data, {
    raw: { width: upscaledRgb.width, height: upscaledRgb.height, channels: 3 }
  })
    .joinChannel(upscaledAlpha, {
      raw: { width: upscaledRgb.width, height: upscaledRgb.height, channels: 1 }
    })
    .raw()
    .toBuffer();

  return { data, width: upscaledRgb.width, height: upscaledRgb.height, channels: 4 };
}

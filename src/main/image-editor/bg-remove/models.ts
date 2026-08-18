export type BgRemoveModelId = 'u2netp' | 'isnet-general-use';

export interface BgRemoveModel {
  id: BgRemoveModelId;
  label: string;
  description: string;
  /** These graphs are self-contained (unlike the upscale models, no external-data weights file
   * sitting alongside), so there's just one file to fetch and verify. */
  url: string;
  filename: string;
  sizeBytes: number;
  sha256: string;
  inputName: string;
  outputName: string;
  /** Fixed square input the graph was trained/exported with -- the source image is stretched
   * (not letterboxed -- matches the reference `rembg` preprocessing) to this size for inference,
   * and the resulting mask resized back up to the source's own dimensions afterward. */
  inputSize: number;
  /** Per-channel normalization applied after scaling pixels to [0, 1] (`(x - mean) / std`),
   * matching each model's own training preprocessing -- see infer.ts. */
  mean: [number, number, number];
  std: [number, number, number];
}

/** Both ONNX exports come from the `rembg` project (danielgatis/rembg, MIT), which -- like Real-
 * ESRGAN for upscale -- hosts them as direct GitHub release downloads with published md5s;
 * `sha256` below was computed locally against a copy verified against rembg's own checksum.
 * Verified live 2026-08-17. */
export const BG_REMOVE_MODELS: BgRemoveModel[] = [
  {
    id: 'u2netp',
    label: 'Fast (U²-Net-p)',
    description: 'Small general-purpose model -- quick, good default for most photos.',
    url: 'https://cdn.benpocket.com/u2netp.onnx',
    filename: 'u2netp.onnx',
    sizeBytes: 4574861,
    sha256: '309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8',
    inputName: 'input.1',
    outputName: '1959',
    inputSize: 320,
    mean: [0.485, 0.456, 0.406],
    std: [0.229, 0.224, 0.225]
  },
  {
    id: 'isnet-general-use',
    label: 'Quality (IS-Net general-use)',
    description: 'Larger model -- cleaner edges and finer detail, slower per image.',
    url: 'https://cdn.benpocket.com/isnet-general-use.onnx',
    filename: 'isnet-general-use.onnx',
    sizeBytes: 178648008,
    sha256: '60920e99c45464f2ba57bee2ad08c919a52bbf852739e96947fbb4358c0d964a',
    inputName: 'input_image',
    outputName: 'output_image',
    inputSize: 1024,
    mean: [0.5, 0.5, 0.5],
    std: [1.0, 1.0, 1.0]
  }
];

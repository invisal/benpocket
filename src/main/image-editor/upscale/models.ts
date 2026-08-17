export type UpscaleModelId = 'x4v3' | 'x4plus';

export interface UpscaleModelFile {
  /** Filename this file must be saved under, both inside the cache dir and inside the archive --
   * onnxruntime resolves the `.data` (external-data weights) file by the name embedded in the
   * `.onnx` graph, so the two must keep these exact names and sit side by side on disk. */
  filename: string;
  sizeBytes: number;
  sha256: string;
}

export interface UpscaleModel {
  id: UpscaleModelId;
  label: string;
  description: string;
  /** Where the model's `.onnx` graph + `.data` weights are fetched from -- a versioned Qualcomm
   * AI Hub release archive (ONNX export of the official xinntao/Real-ESRGAN weights, opset 11,
   * value range 0-1). Verified live 2026-08-17. */
  archiveUrl: string;
  archiveSizeBytes: number;
  graph: UpscaleModelFile;
  data: UpscaleModelFile;
  /** Fixed I/O the graph was exported with (Qualcomm AI Hub compiles these to a static shape --
   * see the archive's metadata.json). Tiling in `infer.ts` works within this constraint. */
  inputName: string;
  outputName: string;
  tileSize: number;
  scale: number;
  /** Context pixels sampled around each tile's core region and then discarded from its output,
   * so tile seams fall inside the network's receptive field instead of on a hard edge. */
  overlap: number;
}

export const UPSCALE_MODELS: UpscaleModel[] = [
  {
    id: 'x4v3',
    label: 'Fast (realesr-general-x4v3)',
    description: 'Compact general-purpose model -- quick, good default for most photos.',
    archiveUrl: 'https://cdn.benpocket.com/real_esrgan_general_x4v3-onnx-float.zip',
    archiveSizeBytes: 4540848,
    graph: {
      filename: 'real_esrgan_general_x4v3.onnx',
      sizeBytes: 160920,
      sha256: 'ec0e5c3b7ed8d6daeca1c6a756a06b992cea912487cf4c8f8ef59ad93499f1fe'
    },
    data: {
      filename: 'real_esrgan_general_x4v3.data',
      sizeBytes: 4836096,
      sha256: '512d0ec9940c2e9d85d27f2952f12a0b77b7841dc22df4ce9f3ea458bc98f37f'
    },
    inputName: 'image',
    outputName: 'upscaled_image',
    tileSize: 128,
    scale: 4,
    overlap: 16
  },
  {
    id: 'x4plus',
    label: 'Quality (RealESRGAN x4plus)',
    description: 'Full-size model -- sharper detail on photos, slower per tile.',
    archiveUrl: 'https://cdn.benpocket.com/real_esrgan_x4plus-onnx-float.zip',
    archiveSizeBytes: 62173535,
    graph: {
      filename: 'real_esrgan_x4plus.onnx',
      sizeBytes: 3156238,
      sha256: 'd5768cb04c959018ca363fda2f6f7bb72700c0d8e5ca4b763fb8d3ec6c14c037'
    },
    data: {
      filename: 'real_esrgan_x4plus.data',
      sizeBytes: 66737664,
      sha256: '28fada125730d3c87d504d48dd8332837f65811ec431a570ea4919ba3eee3287'
    },
    inputName: 'image',
    outputName: 'upscaled_image',
    tileSize: 128,
    scale: 4,
    overlap: 16
  }
];

// onnxruntime-node ships prebuilt native binaries for every OS x arch combo in a
// single npm package (bin/napi-v6/<os>/<arch>/), unlike sharp which splits per
// platform into separate optionalDependencies that npm only installs one of. Because
// onnxruntime-node's native addon can't be dlopen'd from inside app.asar, it has to be
// asarUnpack'd wholesale -- which means electron-builder was copying all ~260MB of it
// (every OS, every arch) into every packaged build, regardless of target. This hook
// strips everything except the platform/arch actually being packaged.
//
// Linux's x64 binary set additionally bundles libonnxruntime_providers_cuda.so and
// libonnxruntime_providers_tensorrt.so -- GPU execution-provider plugins on the order
// of 100+MB each. Windows/macOS don't have this problem: session.ts's
// executionProviders() only ever requests 'dml'/'coreml', both of which onnxruntime
// bakes into the core library rather than shipping as separate plugin files, but
// Linux only ever requests 'cpu' and still gets these dynamic GPU plugins bundled
// unconditionally. Since this app never requests 'cuda'/'tensorrt' on any platform,
// strip them wherever they show up.
//
// Logs every step -- this file has silently no-op'd in CI before (Windows/macOS
// pruned fine, Linux didn't, with nothing in the build log to say why), so don't
// go back to being silent here even once it's confirmed working.
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { Arch } from 'electron-builder';

const UNUSED_PROVIDERS = ['cuda', 'tensorrt'];
const isUnusedProviderFile = (name) =>
  UNUSED_PROVIDERS.some((provider) => name.includes(`providers_${provider}`));

const afterPack = async (context) => {
  const targetOs = context.electronPlatformName;
  const targetArch = Arch[context.arch];
  const napiDir = join(
    context.packager.getResourcesDir(context.appOutDir),
    'app.asar.unpacked',
    'node_modules',
    'onnxruntime-node',
    'bin',
    'napi-v6'
  );

  console.log(
    `[prune-onnxruntime] target=${targetOs}/${targetArch} appOutDir=${context.appOutDir} napiDir=${napiDir}`
  );

  if (!existsSync(napiDir)) {
    console.log('[prune-onnxruntime] napiDir does not exist, nothing to prune');
    return;
  }

  let removed = 0;
  let kept = 0;
  let providersRemoved = 0;

  for (const osEntry of readdirSync(napiDir, { withFileTypes: true })) {
    if (!osEntry.isDirectory()) continue;
    const osPath = join(napiDir, osEntry.name);

    if (osEntry.name !== targetOs) {
      rmSync(osPath, { recursive: true, force: true });
      removed++;
      continue;
    }

    for (const archEntry of readdirSync(osPath, { withFileTypes: true })) {
      if (!archEntry.isDirectory()) continue;
      if (archEntry.name !== targetArch) {
        rmSync(join(osPath, archEntry.name), { recursive: true, force: true });
        removed++;
        continue;
      }
      kept++;

      const archPath = join(osPath, archEntry.name);
      for (const file of readdirSync(archPath, { withFileTypes: true })) {
        if (file.isFile() && isUnusedProviderFile(file.name)) {
          rmSync(join(archPath, file.name), { force: true });
          console.log(`[prune-onnxruntime] removed unused execution provider: ${file.name}`);
          providersRemoved++;
        }
      }
    }
  }

  console.log(
    `[prune-onnxruntime] removed=${removed} kept=${kept} providersRemoved=${providersRemoved}`
  );
};

export default afterPack;

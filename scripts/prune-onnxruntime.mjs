// onnxruntime-node ships prebuilt native binaries for every OS x arch combo in a
// single npm package (bin/napi-v6/<os>/<arch>/), unlike sharp which splits per
// platform into separate optionalDependencies that npm only installs one of. Because
// onnxruntime-node's native addon can't be dlopen'd from inside app.asar, it has to be
// asarUnpack'd wholesale -- which means electron-builder was copying all ~260MB of it
// (every OS, every arch) into every packaged build, regardless of target. This hook
// strips everything except the platform/arch actually being packaged.
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { Arch } from 'electron-builder';

const afterPack = async (context) => {
  const napiDir = resolveNapiDir(context);
  if (!existsSync(napiDir)) return;

  const targetOs = context.electronPlatformName;
  const targetArch = Arch[context.arch];

  for (const osEntry of readdirSync(napiDir, { withFileTypes: true })) {
    if (!osEntry.isDirectory()) continue;
    const osPath = join(napiDir, osEntry.name);

    if (osEntry.name !== targetOs) {
      rmSync(osPath, { recursive: true, force: true });
      continue;
    }

    for (const archEntry of readdirSync(osPath, { withFileTypes: true })) {
      if (archEntry.isDirectory() && archEntry.name !== targetArch) {
        rmSync(join(osPath, archEntry.name), { recursive: true, force: true });
      }
    }
  }
};

const resolveNapiDir = ({ appOutDir, electronPlatformName, packager }) => {
  const resourcesDir =
    electronPlatformName === 'darwin'
      ? join(appOutDir, `${packager.appInfo.productFilename}.app`, 'Contents', 'Resources')
      : join(appOutDir, 'resources');

  return join(
    resourcesDir,
    'app.asar.unpacked',
    'node_modules',
    'onnxruntime-node',
    'bin',
    'napi-v6'
  );
};

export default afterPack;

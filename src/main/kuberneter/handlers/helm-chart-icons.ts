import { ipcMain, app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as readline from 'readline';
import { runHelm } from '../helm-cli';

let cachedHelmRepoCacheDir: string | null = null;

async function getHelmRepositoryCacheDir(): Promise<string> {
  if (cachedHelmRepoCacheDir) return cachedHelmRepoCacheDir;

  try {
    const envOut = await runHelm(['env']);
    const match = envOut.match(/HELM_REPOSITORY_CACHE="([^"]+)"/);
    if (match) {
      cachedHelmRepoCacheDir = match[1];
      return cachedHelmRepoCacheDir;
    }
  } catch (err) {
    console.error('Failed to get Helm repo cache dir:', err);
  }

  const home = app.getPath('home');
  const temp = app.getPath('temp');
  if (process.platform === 'win32') {
    return path.join(temp, 'helm', 'repository');
  } else if (process.platform === 'darwin') {
    return path.join(home, 'Library', 'Caches', 'helm', 'repository');
  } else {
    return path.join(home, '.cache', 'helm', 'repository');
  }
}

async function getChartIconsMap(): Promise<Record<string, string>> {
  const iconMap: Record<string, string> = {};
  try {
    const cacheDir = await getHelmRepositoryCacheDir();
    if (!fs.existsSync(cacheDir)) {
      return iconMap;
    }

    const files = fs.readdirSync(cacheDir);
    for (const file of files) {
      if (file.endsWith('-index.yaml')) {
        const repoPrefix = file.substring(0, file.length - '-index.yaml'.length);
        const filePath = path.join(cacheDir, file);

        const fileStream = fs.createReadStream(filePath);
        const rl = readline.createInterface({
          input: fileStream,
          crlfDelay: Infinity
        });

        let currentChart = '';
        let inEntries = false;

        for await (const line of rl) {
          const cleanLine = line.replace(/\r$/, '');
          const trimmed = cleanLine.trim();
          if (trimmed === 'entries:') {
            inEntries = true;
            continue;
          }
          if (!inEntries) continue;

          const indent = cleanLine.search(/\S/);

          if (indent === 2 && !cleanLine.startsWith('  -') && cleanLine.endsWith(':')) {
            currentChart = cleanLine.substring(2, cleanLine.length - 1).trim();
            continue;
          }

          if (currentChart && trimmed.startsWith('icon:')) {
            const iconUrl = trimmed
              .substring(5)
              .trim()
              .replace(/^['"]|['"]$/g, '');
            const fullName = `${repoPrefix}/${currentChart}`;
            if (!iconMap[fullName]) {
              iconMap[fullName] = iconUrl;
            }
            currentChart = '';
          }
        }
      }
    }
  } catch (err) {
    console.error('Error reading Helm chart icons:', err);
  }
  return iconMap;
}

export function registerHelmChartIconsHandler(): void {
  // Get Helm chart icons mapping
  ipcMain.handle('kuberneter:helm-get-chart-icons', async () => {
    return await getChartIconsMap();
  });
}

import { ipcMain, app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as readline from 'readline';
import { runHelm } from './helm-cli';

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

interface ParsedHelmChart {
  [key: string]: string | string[] | Record<string, string>[];
  name: string;
  version: string;
  appVersion: string;
  description: string;
  home: string;
  icon: string;
  keywords: string[];
  maintainers: Record<string, string>[];
}

function parseHelmChartYaml(yaml: string): ParsedHelmChart {
  const result: ParsedHelmChart = {
    name: '',
    version: '',
    appVersion: '',
    description: '',
    home: '',
    icon: '',
    keywords: [],
    maintainers: []
  };

  const lines = yaml.split(/\r?\n/);
  let currentKey = '';
  let multilineValue = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const indent = line.search(/\S/);

    if (indent > 0 && currentKey === 'description') {
      multilineValue += ' ' + trimmed;
      result.description = multilineValue.trim();
      continue;
    }

    if (trimmed.startsWith('-')) {
      const val = trimmed.replace(/^-\s*/, '').trim();
      if (currentKey === 'keywords') {
        result.keywords.push(val.replace(/^['"]|['"]$/g, ''));
      } else if (currentKey === 'maintainers') {
        const maintainer: Record<string, string> = {};
        if (val.includes(':')) {
          const parts = val.split(':');
          const mKey = parts[0].trim();
          const mVal = parts.slice(1).join(':').trim();
          maintainer[mKey] = mVal.replace(/^['"]|['"]$/g, '');
        } else {
          maintainer.name = val;
        }

        let j = i + 1;
        while (
          j < lines.length &&
          lines[j].search(/\S/) > indent &&
          !lines[j].trim().startsWith('-')
        ) {
          const nextLine = lines[j].trim();
          if (nextLine.includes(':')) {
            const parts = nextLine.split(':');
            const mKey = parts[0].trim();
            const mVal = parts.slice(1).join(':').trim();
            maintainer[mKey] = mVal.replace(/^['"]|['"]$/g, '');
          }
          j++;
        }
        i = j - 1;
        result.maintainers.push(maintainer);
      }
      continue;
    }

    const colonIndex = line.indexOf(':');
    if (colonIndex !== -1) {
      const key = line.substring(0, colonIndex).trim();
      const val = line.substring(colonIndex + 1).trim();

      if (
        [
          'name',
          'version',
          'appVersion',
          'home',
          'icon',
          'description',
          'keywords',
          'maintainers'
        ].includes(key)
      ) {
        currentKey = key;
        if (key === 'description') {
          multilineValue = val;
          result.description = val.replace(/^['"]|['"]$/g, '');
        } else if (key === 'keywords' || key === 'maintainers') {
          // Arrays, bullet items parsed below
        } else {
          result[key] = val.replace(/^['"]|['"]$/g, '');
        }
      } else {
        currentKey = '';
      }
    }
  }

  return result;
}

export function registerHelmHandlers(): void {
  // 7. Search Helm repository charts
  ipcMain.handle('kuberneter:helm-search-charts', async (_, kubeconfigPath?: string) => {
    try {
      const stdout = await runHelm(['search', 'repo', '-o', 'json'], kubeconfigPath);
      return JSON.parse(stdout);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { error: message };
    }
  });

  // 8. Get all versions of a Helm chart
  ipcMain.handle(
    'kuberneter:helm-get-chart-versions',
    async (_, chartName: string, kubeconfigPath?: string) => {
      try {
        const stdout = await runHelm(
          ['search', 'repo', chartName, '-l', '-o', 'json'],
          kubeconfigPath
        );
        return JSON.parse(stdout);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { error: message };
      }
    }
  );

  // 9. Get detailed metadata of a specific Helm chart version
  ipcMain.handle(
    'kuberneter:helm-get-chart-details',
    async (_, chartName: string, version?: string, kubeconfigPath?: string) => {
      try {
        const args = ['show', 'chart', chartName];
        if (version) {
          args.push('--version', version);
        }
        const stdout = await runHelm(args, kubeconfigPath);
        return parseHelmChartYaml(stdout);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { error: message };
      }
    }
  );

  // 10. Install a Helm chart
  ipcMain.handle(
    'kuberneter:helm-install-chart',
    async (
      _,
      releaseName: string,
      chartName: string,
      version: string,
      namespace: string,
      kubeconfigPath?: string,
      contextName?: string
    ) => {
      try {
        const args = ['install', releaseName, chartName, '--version', version, '-n', namespace];
        const stdout = await runHelm(args, kubeconfigPath, contextName);
        return { result: stdout };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { error: message };
      }
    }
  );

  // 11. Get Helm chart icons mapping
  ipcMain.handle('kuberneter:helm-get-chart-icons', async () => {
    return await getChartIconsMap();
  });

  // 12. List Helm releases
  ipcMain.handle(
    'kuberneter:helm-list-releases',
    async (_, kubeconfigPath?: string, contextName?: string) => {
      try {
        const stdout = await runHelm(['list', '-A', '-o', 'json'], kubeconfigPath, contextName);
        return JSON.parse(stdout);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { error: message };
      }
    }
  );
}

import { ipcMain } from 'electron';
import { runHelm } from '../helm-cli';

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

export function registerHelmChartDetailsHandler(): void {
  // Get detailed metadata of a specific Helm chart version
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
}

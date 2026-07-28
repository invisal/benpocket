import { spawn } from 'child_process';

/**
 * Runs a kubectl command with arguments and optional custom kubeconfig path.
 */
export function runKubectl(args: string[], kubeconfigPath?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const kubeArgs = kubeconfigPath ? ['--kubeconfig', kubeconfigPath, ...args] : args;

    const child = spawn('kubectl', kubeArgs, { shell: true });

    let stdout = '';
    let stderr = '';

    if (child.stdout) {
      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
    }

    child.on('close', (code) => {
      if (code !== 0) {
        try {
          const firstBrace = stdout.indexOf('{');
          const lastBrace = stdout.lastIndexOf('}');
          if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
            const jsonCandidate = stdout.substring(firstBrace, lastBrace + 1);
            JSON.parse(jsonCandidate);
            resolve(jsonCandidate);
            return;
          }
        } catch {
          // ignore parsing error, proceed to reject
        }
        reject(new Error(stderr.trim() || stdout.trim() || `kubectl exited with code ${code}`));
        return;
      }
      resolve(stdout);
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}

export interface K8sContext {
  name: string;
  cluster: string;
  user: string;
  namespace?: string;
  server?: string; // Cluster endpoint URL
  isActive: boolean;
}

export interface KubeApiConfig {
  server?: string;
  token?: string;
  caData?: string;
  certData?: string;
  keyData?: string;
  insecureSkipTlsVerify?: boolean;
}

/**
 * Parses minified kubeconfig to extract cluster server endpoint, CA, client certs, and token credentials.
 * Uses --raw flag to prevent kubectl from replacing certificate data with 'DATA+OMITTED'.
 */
export async function getKubeApiConfig(
  kubeconfigPath?: string,
  contextName?: string
): Promise<KubeApiConfig | undefined> {
  try {
    const args = ['config', 'view', '-o', 'json', '--minify', '--raw'];
    if (contextName) {
      args.push('--context', contextName);
    }
    const rawJson = await runKubectl(args, kubeconfigPath);
    const config = JSON.parse(rawJson);

    const clusterObj = config.clusters?.[0]?.cluster;
    const userObj = config.users?.[0]?.user;

    const server = clusterObj?.server;
    let token =
      userObj?.token ||
      userObj?.['auth-provider']?.config?.['access-token'] ||
      userObj?.['auth-provider']?.config?.['id-token'];

    let certData = userObj?.['client-certificate-data'];
    let keyData = userObj?.['client-key-data'];
    const caData = clusterObj?.['certificate-authority-data'];
    const insecureSkipTlsVerify = !!clusterObj?.['insecure-skip-tls-verify'];

    // Evaluate Exec Credential plugin if credentials are missing but exec configuration exists
    if (!token && !certData && userObj?.exec?.command) {
      try {
        const execCmd = userObj.exec.command;
        const execArgs = userObj.exec.args || [];
        const envVars = { ...process.env };

        if (kubeconfigPath) {
          envVars.KUBECONFIG = kubeconfigPath;
        }

        if (Array.isArray(userObj.exec.env)) {
          for (const envItem of userObj.exec.env) {
            if (envItem.name && envItem.value) {
              envVars[envItem.name] = envItem.value;
            }
          }
        }

        const execResult = await new Promise<string>((resolve, reject) => {
          const child = spawn(execCmd, execArgs, { env: envVars, shell: true });
          let out = '';
          if (child.stdout) {
            child.stdout.on('data', (c) => {
              out += c.toString();
            });
          }
          child.on('close', (code) => {
            if (code === 0) resolve(out);
            else reject(new Error(`exec plugin ${execCmd} exited with code ${code}`));
          });
          child.on('error', (err) => reject(err));
        });

        const firstBrace = execResult.indexOf('{');
        const lastBrace = execResult.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
          const parsedExec = JSON.parse(execResult.substring(firstBrace, lastBrace + 1));
          if (parsedExec?.status?.token) {
            token = parsedExec.status.token;
          }
          if (parsedExec?.status?.clientCertificateData) {
            certData = parsedExec.status.clientCertificateData;
          }
          if (parsedExec?.status?.clientKeyData) {
            keyData = parsedExec.status.clientKeyData;
          }
        }
      } catch (execErr) {
        console.warn('Failed to evaluate exec auth plugin:', execErr);
      }
    }

    if (!server) return undefined;
    return { server, token, caData, certData, keyData, insecureSkipTlsVerify };
  } catch {
    return undefined;
  }
}

/**
 * Lists contexts and endpoints from a kubeconfig file by running config view.
 */
export async function listKubeconfigContexts(kubeconfigPath?: string): Promise<K8sContext[]> {
  try {
    const rawJson = await runKubectl(['config', 'view', '-o', 'json'], kubeconfigPath);
    const config = JSON.parse(rawJson);

    const contexts = config.contexts || [];
    const clusters = config.clusters || [];
    const currentContext = config['current-context'] || '';

    // Create a map of cluster name to API server endpoint
    const clusterServerMap = new Map<string, string>();
    for (const c of clusters) {
      if (c.name && c.cluster?.server) {
        clusterServerMap.set(c.name, c.cluster.server);
      }
    }

    interface KubeconfigContext {
      name: string;
      context?: {
        cluster?: string;
        user?: string;
        namespace?: string;
      };
    }

    return contexts.map((ctx: KubeconfigContext) => {
      const name = ctx.name || '';
      const contextData = ctx.context || {};
      const clusterName = contextData.cluster || '';
      return {
        name,
        cluster: clusterName,
        user: contextData.user || '',
        namespace: contextData.namespace || 'default',
        server: clusterServerMap.get(clusterName) || '',
        isActive: name === currentContext
      };
    });
  } catch (err) {
    console.error('Error listing contexts:', err);
    throw err;
  }
}

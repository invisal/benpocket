export { registerKubeconfigHandlers } from './handlers/kubeconfig';
export { registerResourcesHandler } from './handlers/resources';
export { registerTopNodesHandler } from './handlers/top-nodes';
export { registerTopPodsHandler } from './handlers/top-pods';
export { registerPrometheusHandler } from './handlers/prometheus';
export { registerPortForwardHandler } from './handlers/port-forward';
export { registerWatchHandler } from './handlers/watch';
export { registerTerminalHandler } from './handlers/terminal';

import { registerKubeconfigHandlers } from './handlers/kubeconfig';
import { registerResourcesHandler } from './handlers/resources';
import { registerTopNodesHandler } from './handlers/top-nodes';
import { registerTopPodsHandler } from './handlers/top-pods';
import { registerPrometheusHandler } from './handlers/prometheus';
import { registerPortForwardHandler } from './handlers/port-forward';
import { registerWatchHandler } from './handlers/watch';
import { registerTerminalHandler } from './handlers/terminal';

export function registerK8sHandlers(): void {
  registerKubeconfigHandlers();
  registerResourcesHandler();
  registerTopNodesHandler();
  registerTopPodsHandler();
  registerPrometheusHandler();
  registerPortForwardHandler();
  registerWatchHandler();
  registerTerminalHandler();
}

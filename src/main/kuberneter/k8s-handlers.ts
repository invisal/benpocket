export { registerKubeconfigHandlers } from './handlers/kubeconfig';
export { registerResourcesHandler } from './handlers/resources';
export { registerTopNodesHandler } from './handlers/top-nodes';
export { registerTopPodsHandler } from './handlers/top-pods';
export { registerPrometheusHandler } from './handlers/prometheus';
export { registerPortForwardHandler } from './handlers/port-forward';

import { registerKubeconfigHandlers } from './handlers/kubeconfig';
import { registerResourcesHandler } from './handlers/resources';
import { registerTopNodesHandler } from './handlers/top-nodes';
import { registerTopPodsHandler } from './handlers/top-pods';
import { registerPrometheusHandler } from './handlers/prometheus';
import { registerPortForwardHandler } from './handlers/port-forward';

export function registerK8sHandlers(): void {
  registerKubeconfigHandlers();
  registerResourcesHandler();
  registerTopNodesHandler();
  registerTopPodsHandler();
  registerPrometheusHandler();
  registerPortForwardHandler();
}

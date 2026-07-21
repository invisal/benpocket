export { registerKubeconfigHandlers } from './handlers/kubeconfig';
export { registerResourcesHandler } from './handlers/resources';
export { registerTopNodesHandler } from './handlers/top-nodes';
export { registerTopPodsHandler } from './handlers/top-pods';
export { registerPrometheusHandler } from './handlers/prometheus';

import { registerKubeconfigHandlers } from './handlers/kubeconfig';
import { registerResourcesHandler } from './handlers/resources';
import { registerTopNodesHandler } from './handlers/top-nodes';
import { registerTopPodsHandler } from './handlers/top-pods';
import { registerPrometheusHandler } from './handlers/prometheus';

export function registerK8sHandlers(): void {
  registerKubeconfigHandlers();
  registerResourcesHandler();
  registerTopNodesHandler();
  registerTopPodsHandler();
  registerPrometheusHandler();
}

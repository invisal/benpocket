import { registerK8sHandlers } from './k8s-handlers';
import { registerHelmHandlers } from './helm-handlers';

export function registerKuberneterHandlers(): void {
  registerK8sHandlers();
  registerHelmHandlers();
}

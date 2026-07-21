export { registerHelmSearchChartsHandler } from './handlers/helm-search-charts';
export { registerHelmChartVersionsHandler } from './handlers/helm-chart-versions';
export { registerHelmChartDetailsHandler } from './handlers/helm-chart-details';
export { registerHelmInstallChartHandler } from './handlers/helm-install-chart';
export { registerHelmChartIconsHandler } from './handlers/helm-chart-icons';
export { registerHelmListReleasesHandler } from './handlers/helm-list-releases';
export { registerHelmReleaseValuesHandler } from './handlers/helm-release-values';

import { registerHelmSearchChartsHandler } from './handlers/helm-search-charts';
import { registerHelmChartVersionsHandler } from './handlers/helm-chart-versions';
import { registerHelmChartDetailsHandler } from './handlers/helm-chart-details';
import { registerHelmInstallChartHandler } from './handlers/helm-install-chart';
import { registerHelmChartIconsHandler } from './handlers/helm-chart-icons';
import { registerHelmListReleasesHandler } from './handlers/helm-list-releases';
import { registerHelmReleaseValuesHandler } from './handlers/helm-release-values';

export function registerHelmHandlers(): void {
  registerHelmSearchChartsHandler();
  registerHelmChartVersionsHandler();
  registerHelmChartDetailsHandler();
  registerHelmInstallChartHandler();
  registerHelmChartIconsHandler();
  registerHelmListReleasesHandler();
  registerHelmReleaseValuesHandler();
}

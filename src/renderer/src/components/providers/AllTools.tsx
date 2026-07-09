import { registerTool } from './createTabProvider';

const homeTool = registerTool({
  name: 'home',
  loadComponent: () => import('./../../../tools/home'),
  generateName: () => 'Home',
  label: ''
});

const httpClientTool = registerTool({
  name: 'http-client',
  loadComponent: () => import('./../../../tools/http-client'),
  generateName: () => 'HTTP Client',
  label: ''
});

const screenRecordTool = registerTool({
  name: 'screen-recorder',
  loadComponent: () => import('@screen-recorder/index'),
  generateName: () => 'Screen Recorder',
  label: ''
});

const kuberneterTool = registerTool({
  name: 'kuberneter' as const,
  loadComponent: () => import('./../../../tools/kuberneter'),
  generateName: () => `Kuberneter`,
  label: ''
});

export const allTools = [homeTool, httpClientTool, screenRecordTool, kuberneterTool];

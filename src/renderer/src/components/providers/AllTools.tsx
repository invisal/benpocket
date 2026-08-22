import { registerTool } from './createTabProvider';

const homeTool = registerTool({
  name: 'home',
  loadComponent: () => import('./../../../tools/home'),
  generateName: () => 'Home',
  label: ''
});

const fileExplorerTool = registerTool({
  name: 'file-explorer' as const,
  loadComponent: () => import('./../../../tools/file-explorer'),
  generateName: () => 'File Explorer',
  label: ''
});

const kuberneterTool = registerTool({
  name: 'kuberneter' as const,
  loadComponent: () => import('./../../../tools/kuberneter'),
  generateName: () => `Kuberneter`,
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

const screenCaptureTool = registerTool({
  name: 'screen-capture',
  loadComponent: () => import('./../../../tools/screen-capture'),
  generateName: () => 'Screen Capture',
  label: ''
});

const storybookTool = registerTool({
  name: 'storybook' as const,
  loadComponent: () => import('./../../../tools/storybook'),
  generateName: () => 'Storybook',
  label: ''
});

// Not listed on the Home page or in the "+ Add Tool" dialog -- only reachable
// via File Explorer's "Open Workspace" context menu item on a folder.
const workspaceTool = registerTool({
  name: 'workspace' as const,
  loadComponent: () => import('./../../../tools/workspace'),
  generateName: (payload: { path: string }) =>
    payload.path
      .replace(/[\\/]+$/, '')
      .split(/[\\/]/)
      .pop() || 'Workspace',
  label: ''
});

export const allTools = [
  homeTool,
  fileExplorerTool,
  kuberneterTool,
  httpClientTool,
  screenRecordTool,
  screenCaptureTool,
  workspaceTool,
  ...(import.meta.env.DEV ? [storybookTool] : [])
];

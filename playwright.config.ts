import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  fullyParallel: false, // only one Electron instance/window is exercised at a time
  workers: 1,
  reporter: 'list'
});

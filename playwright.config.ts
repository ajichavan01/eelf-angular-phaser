import { defineConfig, devices } from '@playwright/test';

const angularPort = process.env.EELF_ANGULAR_PORT ?? '4200';
const phaserPort = process.env.EELF_PHASER_PORT ?? '5173';
const angularURL = `http://127.0.0.1:${angularPort}`;
const phaserURL = `http://127.0.0.1:${phaserPort}`;

export default defineConfig({
  testDir: './tests',
  timeout: 45000,
  expect: { timeout: 10000 },
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: [
    { command: `npm run dev --workspace @eelf/angular -- --port ${angularPort}`, url: angularURL, reuseExistingServer: false, timeout: 120000 },
    { command: `npm run dev --workspace @eelf/phaser -- --port ${phaserPort}`, url: phaserURL, reuseExistingServer: false, timeout: 120000 },
  ],
  projects: [
    { name: 'angular-desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 960 }, baseURL: angularURL } },
    { name: 'phaser-desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 960 }, baseURL: phaserURL } },
    { name: 'angular-mobile', use: { ...devices['Pixel 7'], baseURL: angularURL } },
    { name: 'phaser-mobile', use: { ...devices['Pixel 7'], baseURL: phaserURL } },
  ],
});
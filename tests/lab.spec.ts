import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { PNG } from 'pngjs';

async function tick(page: Page): Promise<number> {
  return Number((await page.getByTestId('tick').innerText()).replace('Tick ', ''));
}

async function pause(page: Page): Promise<void> {
  const button = page.getByRole('button', { name: 'Pause simulation', exact: true });
  if (await button.count()) await button.click();
  await expect(page.getByTestId('run-state')).toHaveText('Paused');
}

test('ecosystem renders, moves, pauses, steps, and saves/restores', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect.poll(async () => Number(await page.getByTestId('population-count').innerText())).toBeGreaterThan(0);
  await pause(page);
  const canvas = page.getByTestId('world-canvas');
  await expect(canvas).toBeVisible();
  const first = await canvas.screenshot();
  const pixels = PNG.sync.read(first);
  let colorfulPixels = 0;
  for (let index = 0; index < pixels.data.length; index += 4) {
    const red = pixels.data[index];
    const green = pixels.data[index + 1];
    const blue = pixels.data[index + 2];
    if (red > 45 && green > 60 && blue > 40 && Math.max(red, green, blue) - Math.min(red, green, blue) > 25) colorfulPixels++;
  }
  expect(colorfulPixels).toBeGreaterThan(100);
  const before = await tick(page);
  await page.getByRole('button', { name: 'Advance one tick', exact: true }).click();
  await expect.poll(() => tick(page)).toBe(before + 1);
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export experiment', exact: true }).click();
  const download = await downloadEvent;
  const path = (await download.path())!;
  const saved = JSON.parse(await readFile(path, 'utf8'));
  expect(saved.format).toBe('eelf');
  expect(saved.tick).toBe(before + 1);
  await page.getByRole('button', { name: 'Run simulation', exact: true }).click();
  await expect.poll(() => tick(page)).toBeGreaterThan(before + 35);
  await pause(page);
  expect((await canvas.screenshot()).equals(first)).toBe(false);
  await page.getByLabel('Experiment file', { exact: true }).setInputFiles(path);
  await expect.poll(() => tick(page)).toBe(saved.tick);
  await expect(page.getByTestId('run-state')).toHaveText('Paused');
  await page.getByLabel('Experiment file', { exact: true }).setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{"format":"not-eelf","version":99}') });
  await expect(page.getByRole('alert')).toContainText('Unsupported save format');
  expect(await tick(page)).toBe(saved.tick);
  await page.getByRole('button', { name: 'Dismiss error' }).click();
  await page.getByLabel('Senses', { exact: true }).check();
  await page.getByLabel('Energy', { exact: true }).check();
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await page.getByRole('button', { name: 'Fit world', exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath('lab.png'), fullPage: true });
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('environment settings, accessible tabs, and population inspection work', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Pause simulation', exact: true })).toBeEnabled();
  await pause(page);
  await page.getByRole('tab', { name: 'Environment', exact: true }).click();
  await page.getByLabel('Seed', { exact: true }).fill('12345');
  await page.getByLabel('Initial population', { exact: true }).fill('12');
  await page.getByLabel('Population limit', { exact: true }).fill('12');
  await page.getByLabel('Plant capacity', { exact: true }).fill('100');
  await page.getByRole('button', { name: 'Start new experiment', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Restart experiment', exact: true }).click();
  await expect(page.getByTestId('population-count')).toHaveText('12');
  await pause(page);
  await page.getByRole('tab', { name: 'Population', exact: true }).click();
  await page.getByLabel('Filter creature ID', { exact: true }).fill('1');
  await page.getByRole('button', { name: /Creature #1 Generation/ }).first().click();
  await expect(page.getByRole('tab', { name: 'Inspector', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('selected-creature')).toHaveText('Creature #1');
  await page.getByRole('tab', { name: 'Inspector', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Environment', exact: true })).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath('environment.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
/**
 * 诊断探针 v3:验证页内确认 UI 的完整导入流(不依赖任何 JS dialog)。
 * 页面全程拦截 dialog(模拟抑制环境):若有代码走 window.confirm/alert 会直接返回 false 不弹,
 * 断言只认页内 data-testid 元素与 storage 结果。
 * 用法:node scripts/probe-import3.mjs
 */
import { chromium } from 'playwright-core';
import { resolve } from 'node:path';
import { writeFileSync } from 'node:fs';

const extPath = resolve('.output/chrome-mv3');
const browser = await chromium.launchPersistentContext('', {
  headless: false,
  args: [
    '--headless=new',
    `--disable-extensions-except=${extPath}`,
    `--load-extension=${extPath}`,
  ],
});

const backup = JSON.stringify({
  format: 'browser-ext/custom-styles',
  version: 1,
  exportedAt: '2026-09-02T00:00:00.000Z',
  styles: [{ id: 'probe3-1', name: '探针v3', enabled: false, patterns: ['*://example.com/*'], code: '/*p3*/', createdAt: 1, updatedAt: 1 }],
}, null, 2);
const backupPath = resolve('.output/probe3-backup.json');
writeFileSync(backupPath, backup);

try {
  const ctx = browser;
  const extPage = await ctx.newPage();
  await extPage.goto('chrome://extensions');
  await extPage.waitForSelector('extensions-manager');
  const extId = await extPage.evaluate(() => {
    const mgr = document.querySelector('extensions-manager');
    const list = mgr?.shadowRoot?.querySelector('extensions-item-list');
    const items = list?.shadowRoot?.querySelectorAll('extensions-item');
    return items ? [...items].map((i) => i.id) : [];
  });
  await extPage.close();
  console.log('extId:', extId[0]);

  const page = await ctx.newPage();
  // 模拟抑制环境:dialog 一律 dismiss(不 accept)——页内 UI 不应受影响
  page.on('dialog', async (d) => { console.log('[dialog-suppressed]', d.type()); await d.dismiss(); });
  page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 400)));

  await page.goto(`chrome-extension://${extId}/options.html`);
  await page.waitForSelector('button', { timeout: 30000 });

  // 导入 → 页内确认条应出现(即使 dialog 全部被抑制)
  const fcPromise = page.waitForEvent('filechooser', { timeout: 8000 });
  await page.getByText('导入', { exact: true }).click();
  const fc = await fcPromise;
  await fc.setFiles(backupPath);

  const banner = page.locator('[data-testid="import-confirm"]');
  await banner.waitFor({ state: 'visible', timeout: 5000 });
  console.log('[banner text]', (await banner.innerText()).trim());

  // 点确认 → storage 落盘,确认条消失
  await page.getByText('确认导入', { exact: true }).click();
  await page.waitForTimeout(1000);

  const storage = await page.evaluate(async () => {
    const got = await browser.storage.local.get('customStyles');
    return (got.customStyles ?? []).map((s) => s.id);
  });
  const bannerGone = (await banner.count()) === 0;
  console.log('[storage ids]', JSON.stringify(storage), '| banner gone:', bannerGone);

  const pass = storage.includes('probe3-1') && bannerGone;
  console.log(pass ? 'PASS: 页内确认导入流端到端可用(dialog 抑制环境)' : 'FAIL');
} finally {
  await browser.close();
}

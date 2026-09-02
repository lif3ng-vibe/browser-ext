/**
 * 诊断探针(#14 导入无反应):真 Chrome 加载扩展,打开 options 页,
 * 逐环节取证:① 点导入按钮是否弹文件框(headless 无法真弹,改为断言 click 调用链)
 * ② 直接对 input 派发 change(带 File)→ 是否走 parse→confirm→import 链
 * ③ 通过 CDPFile chooser 路径真实走一遍 file chooser
 * 用法:pnpm build -b chrome && node scripts/probe-import.mjs
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
  styles: [{ id: 'probe-1', name: '探针样式', enabled: false, patterns: ['*://example.com/*'], code: '/* probe */', createdAt: 1, updatedAt: 1 }],
}, null, 2);

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
  page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 400)));
  page.on('console', (m) => console.log(`[console.${m.type()}]`, m.text().slice(0, 300)));
  page.on('dialog', async (d) => {
    console.log('[dialog]', d.type(), JSON.stringify(d.message()).slice(0, 200));
    await d.accept();
  });

  await page.goto(`chrome-extension://${extId}/options.html`);
  await page.waitForSelector('button', { timeout: 30000 });

  // 取证 1:导入按钮与隐藏 input 的状态
  const probe1 = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')].map((b) => b.textContent?.trim());
    const input = document.querySelector('input[type="file"]');
    return {
      buttons: btns,
      hasFileInput: !!input,
      inputHidden: input ? getComputedStyle(input).display === 'none' : null,
      inputAccept: input?.getAttribute('accept'),
    };
  });
  console.log('[probe1]', JSON.stringify(probe1));

  // 取证 2:点击导入按钮 → file chooser 是否被请求(CDP 事件)
  const fileChooserPromise = page.waitForEvent('filechooser', { timeout: 5000 }).then(() => 'filechooser-fired').catch(() => 'filechooser-TIMEOUT');
  await page.getByText('导入', { exact: true }).click();
  console.log('[probe2 click]', await fileChooserPromise);

  // 取证 3:走真实 file chooser setInputFiles 路径(模拟用户选文件)
  const backupPath = resolve('.output/probe-backup.json');
  writeFileSync(backupPath, backup);
  const fcPromise = page.waitForEvent('filechooser', { timeout: 5000 });
  await page.getByText('导入', { exact: true }).click();
  const fc = await fcPromise;
  await fc.setFiles(backupPath);
  await page.waitForTimeout(1500);

  // 取证 4:storage 是否落了探针样式
  const probe4 = await page.evaluate(async () => {
    const got = await browser.storage.local.get('customStyles');
    return (got.customStyles ?? []).map((s) => s.id);
  });
  console.log('[probe4 storage ids]', JSON.stringify(probe4));

  await page.screenshot({ path: resolve('.output/probe-import-final.png') });
} finally {
  await browser.close();
}

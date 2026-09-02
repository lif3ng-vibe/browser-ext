/**
 * 诊断探针 v2:真 Chrome、**非 headless**(用户是有头环境),完整用户路径:
 * 点导入 → 真实 file chooser(setInputFiles)→ 检查 change 是否到达组件 handler。
 * 微探针:① input 元素身份(点击前后是否同一个 DOM 节点)
 *         ② window 上派发测试事件计数
 * 用法:node scripts/probe-import2.mjs
 */
import { chromium } from 'playwright-core';
import { resolve } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';

const extPath = resolve('.output/chrome-mv3');
const OUT = resolve('.output');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launchPersistentContext('', {
  headless: false, // 与用户环境一致:有头
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
  styles: [{ id: 'probe2-1', name: '探针v2', enabled: false, patterns: ['*://example.com/*'], code: '/*p2*/', createdAt: 1, updatedAt: 1 }],
}, null, 2);
const backupPath = resolve(OUT, 'probe2-backup.json');
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
  const logs = [];
  page.on('pageerror', (e) => { logs.push(`[pageerror] ${e}`); console.log('[pageerror]', String(e).slice(0, 400)); });
  page.on('console', (m) => { logs.push(`[${m.type()}] ${m.text()}`); });
  page.on('dialog', async (d) => { console.log('[dialog]', d.type(), JSON.stringify(d.message()).slice(0, 200)); await d.accept(); });

  await page.goto(`chrome-extension://${extId}/options.html`);
  await page.waitForSelector('button', { timeout: 30000 });

  // 微探针 A:给隐藏 input 打标记 + 挂原生监听,数 change 到达情况
  await page.evaluate(() => {
    const input = document.querySelector('input[type="file"]');
    window.__probe = { idBefore: Math.random().toString(36).slice(2), changes: 0 };
    input.dataset.probeId = window.__probe.idBefore;
    input.addEventListener('change', (e) => {
      window.__probe.changes++;
      window.__probe.changeFired = true;
      window.__probe.filesLen = e.target.files?.length;
      window.__probe.fileName = e.target.files?.[0]?.name;
      console.log('[probe] input change fired, files=', e.target.files?.length);
    });
    // Vue 的 onChange 是 addEventListener 挂的;确认 listener 数量(Chrome 只能数 gothrough mark)
    console.log('[probe] marker set on input, dataset=', input.dataset.probeId);
  });

  // 用户路径:点导入 → chooser → 选文件
  const fcPromise = page.waitForEvent('filechooser', { timeout: 8000 });
  await page.getByText('导入', { exact: true }).click();
  const fc = await fcPromise;
  await fc.setFiles(backupPath);
  await page.waitForTimeout(2000);

  // 微探针 B:change 到达了吗?input 身份变了吗?
  const probe = await page.evaluate(() => {
    const input = document.querySelector('input[type="file"]');
    return {
      ...window.__probe,
      idAfter: input.dataset.probeId,
      sameNode: input.dataset.probeId === window.__probe.idBefore,
      valueNow: input.value,
    };
  });
  console.log('[probeB]', JSON.stringify(probe));

  const storage = await page.evaluate(async () => {
    const got = await browser.storage.local.get('customStyles');
    return (got.customStyles ?? []).map((s) => s.id);
  });
  console.log('[storage ids]', JSON.stringify(storage));
  console.log('[all logs]', logs.slice(-20));
  await page.screenshot({ path: resolve(OUT, 'probe2-final.png') });
} finally {
  await browser.close();
}

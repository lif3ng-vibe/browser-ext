/**
 * T6(#12)验收脚本:真浏览器跑 #8 手动验收 + 四主题 × 两页面截图。
 * 用法:pnpm build -b chrome && node scripts/acceptance.mjs
 * 产物:.output/acceptance/*.png + 控制台断言报告。
 * 说明:playwright-core + channel 'chrome'(本机 Chrome,无需下浏览器)。
 */
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const OUT = resolve('.output/acceptance');
mkdirSync(OUT, { recursive: true });

const extPath = resolve('.output/chrome-mv3');
const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

const browser = await chromium.launchPersistentContext('', {
  headless: false,
  args: [
    // MV3 扩展加载在 stable Chrome 137+ 已禁,本组合用 Playwright chromium + headless=new
    '--headless=new',
    `--disable-extensions-except=${extPath}`,
    `--load-extension=${extPath}`,
  ],
});

try {
  const ctx = browser; // persistent context 本身即 context
  // 扩展 id:chrome://extensions 的 extensions-item 元素 id 属性即扩展 id
  const extPage = await ctx.newPage();
  await extPage.goto('chrome://extensions');
  await extPage.waitForSelector('extensions-manager');
  const extId = await extPage.evaluate(() => {
    const mgr = document.querySelector('extensions-manager');
    const list = mgr?.shadowRoot?.querySelector('extensions-item-list');
    const items = list?.shadowRoot?.querySelectorAll('extensions-item');
    return items ? [...items].map((i) => i.id) : [];
  });
  console.log('extensions found:', extId);
  if (extId.length !== 1) throw new Error('期望恰好一个扩展,id=' + extId.join(','));
  await extPage.close();
  const options = await ctx.newPage();
  options.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 200)));
  options.on('console', (m) => {
    if (m.type() === 'error') console.log('[console.error]', m.text().slice(0, 200));
  });
  await options.goto(`chrome-extension://${extId}/options.html`);
  await options.waitForSelector('button[aria-pressed]', { timeout: 30000 }).catch(async () => {
    await options.screenshot({ path: resolve(OUT, 'options-debug.png') });
    console.log('options body:', await options.evaluate(() => document.body.innerHTML.slice(0, 500)));
    throw new Error('options 页 30s 未渲染出色块');
  });

  // 断言:四主题色块渲染
  const swatches = await options.$$('button[aria-pressed]');
  check('options 渲染 4 个主题色块', swatches.length === 4, `实际 ${swatches.length}`);

  // 色块 label 可能带「生效中」尾巴,归一化;并找到跟随系统复选框
  const labels = await Promise.all(swatches.map((b) => b.textContent().then((t) => t.trim().replace(/生效中$/, '').trim())));
  const checkbox = await options.$('#follow-system');

  // -- 第一组:关闭跟随系统,验证纯「选择 → 解析 = 所见即所选」+ 四主题截图 --
  if (await checkbox.isChecked()) await checkbox.uncheck();
  await options.waitForTimeout(150);
  const expectTheme = {
    '亮色': 'light',
    '暗色': 'dark',
    'Vercel 亮色': 'vercel-light',
    'Vercel 暗色': 'vercel-dark',
  };
  for (let i = 0; i < swatches.length; i++) {
    const expected = expectTheme[labels[i]];
    await swatches[i].click();
    await options.waitForTimeout(150);
    const actual = await options.evaluate(() => document.documentElement.dataset.theme);
    check(`跟随关:点「${labels[i]}」→ data-theme`, expected ? actual === expected : false, `${actual}`);
    await options.screenshot({ path: resolve(OUT, `options-${actual}.png`) });
  }

  // popup 各主题截图(切主题后 popup 实时跟随 = storage 同步验证)
  const popup = await ctx.newPage();
  await popup.goto(`chrome-extension://${extId}/popup.html`);
  await popup.waitForSelector('button[aria-pressed]');
  for (const theme of ['light', 'vercel-dark']) {
    // 在 options 点色块,popup 应实时跟随(跨 context 同步)
    const idx = theme === 'light' ? 0 : 3;
    await swatches[idx].click();
    await popup.waitForTimeout(300);
    const pt = await popup.evaluate(() => document.documentElement.dataset.theme);
    check(`popup 跟随 options 切到 ${theme}`, pt === theme, `实际 ${pt}`);
    await popup.screenshot({ path: resolve(OUT, `popup-${theme}.png`) });
  }

  // -- 第二组:跟随系统分支:emulateMedia 模拟 OS 明暗 --
  await swatches[2].click(); // vercel-light(纯选择)
  await options.waitForTimeout(150);

  // 开「跟随系统」
  if (!(await checkbox.isChecked())) await checkbox.check();
  if (!(await checkbox.isChecked())) await checkbox.check();
  await options.waitForTimeout(150);

  await popup.emulateMedia({ colorScheme: 'dark' });
  // options 页也挂了 matchMedia,同样要 emulate;popup 页与 options 页各自 context media 模拟
  await options.emulateMedia({ colorScheme: 'dark' });
  await options.waitForTimeout(300);
  const followDark = await popup.evaluate(() => document.documentElement.dataset.theme);
  check('跟随系统 + 选 vercel-light + 系统暗 → vercel-dark', followDark === 'vercel-dark', `实际 ${followDark}`);

  await popup.emulateMedia({ colorScheme: 'light' });
  await options.emulateMedia({ colorScheme: 'light' });
  await options.waitForTimeout(300);
  const followLight = await popup.evaluate(() => document.documentElement.dataset.theme);
  check('系统亮 → 回 vercel-light', followLight === 'vercel-light', `实际 ${followLight}`);

  // 关跟随系统:改系统明暗,页面应不动
  await checkbox.uncheck();
  await options.waitForTimeout(150);
  await popup.emulateMedia({ colorScheme: 'dark' });
  await options.emulateMedia({ colorScheme: 'dark' });
  await options.waitForTimeout(300);
  const unfollow = await popup.evaluate(() => document.documentElement.dataset.theme);
  check('关闭跟随系统后改系统明暗 → 不动(vercel-light)', unfollow === 'vercel-light', `实际 ${unfollow}`);

  await options.screenshot({ path: resolve(OUT, 'options-final.png') });
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n=== ${results.length - failed.length}/${results.length} PASS`);
process.exit(failed.length ? 1 : 0);
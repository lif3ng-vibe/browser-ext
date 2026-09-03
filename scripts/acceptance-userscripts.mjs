/**
 * #13(userScripts 注入)验收脚本:真 Chrome 端到端。
 * 用法:pnpm build -b chrome && node scripts/acceptance-userscripts.mjs
 * 产物:.output/acceptance-userscripts/*.png + 控制台断言报告。
 *
 * 验收链路(沿 #3 acceptance.mjs 先例):
 * 1. 加载扩展,chrome://extensions 开「允许用户脚本」门禁(≥138 的扩展详情页开关;
 *    找不到开关则尝试旧版开发者模式 → 门禁引导 UI 有横幅可证)
 * 2. options 页:新建脚本(作用于本地 http server),填代码保存,启用
 * 3. 打开匹配页面:脚本已注入(MAIN world 变量可从页面读到)
 * 4. 启停/保存改动:新开页面生效,已开页面不受影响(单次执行语义)
 * 5. 注入顺序:两条脚本按列表顺序执行
 */
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve } from 'node:path';

const OUT = resolve('.output/acceptance-userscripts');
mkdirSync(OUT, { recursive: true });

const extPath = resolve('.output/chrome-mv3');
const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

// ---- 本地靶站:每页带不同标记 ----
const PAGE_A = `<!doctype html><html><body><h1 id="h">页面A</h1></body></html>`;
let visits = 0;
const target = createServer((req, res) => {
  visits += 1;
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.end(PAGE_A);
});
await new Promise((r) => target.listen(0, '127.0.0.1', r));
const port = target.address().port;
const url = (path = '/') => `http://127.0.0.1:${port}${path}`;

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
  const ctx = browser;

  // ---- 扩展 id ----
  const extPage = await ctx.newPage();
  await extPage.goto('chrome://extensions');
  await extPage.waitForSelector('extensions-manager');
  const extIds = await extPage.evaluate(() => {
    const mgr = document.querySelector('extensions-manager');
    const list = mgr?.shadowRoot?.querySelector('extensions-item-list');
    const items = list?.shadowRoot?.querySelectorAll('extensions-item');
    return items ? [...items].map((i) => i.id) : [];
  });
  if (extIds.length !== 1) throw new Error('期望恰好一个扩展,id=' + extIds.join(','));
  const extId = extIds[0];
  console.log('extension id:', extId);
  await extPage.close();

  // ---- options 页:先看门禁未开的 locked 视图,再开门禁看横幅消失 ----
  // 顺序:先开 options(门禁未开 → locked 引导横幅),后翻门禁,再刷新 options
  const options = await ctx.newPage();
  options.on('pageerror', (e) => console.log('[options pageerror]', String(e).slice(0, 200)));
  await options.goto(`chrome-extension://${extId}/options.html`);
  await options.waitForSelector('text=用户脚本', { timeout: 10_000 });

  const gateBanner = options.locator('[data-testid="gate-banner"]');
  const gateText = async () =>
    (await gateBanner.count()) ? (await gateBanner.textContent()) ?? '' : '';
  {
    await options.waitForTimeout(800);
    const bannerText = await gateText();
    check(
      '门禁未开:locked 引导横幅(含「允许用户脚本」指引,而非「不支持」)',
      bannerText.includes('允许用户脚本') && !bannerText.includes('不支持'),
      bannerText.slice(0, 60),
    );
    await options.screenshot({ path: resolve(OUT, 'options-gated.png') });
  }

  // ---- 门禁:开「允许用户脚本」(Chrome ≥138 扩展详情页开关) ----
  // deep-link (?id=) 不渲染详情视图;从列表点 detailsButton 进详情。
  // 开关结构:#allow-user-scripts(extensions-toggle-row)的 shadowRoot 内 cr-toggle
  {
    const gatePage = await ctx.newPage();
    await gatePage.goto('chrome://extensions');
    await gatePage.waitForSelector('extensions-manager');
    await gatePage.waitForTimeout(1500);
    try {
      const flipped = await gatePage.evaluate(() => {
        const mgr = document.querySelector('extensions-manager');
        const list = mgr?.shadowRoot?.querySelector('extensions-item-list');
        const item = list?.shadowRoot?.querySelector('extensions-item');
        item?.shadowRoot?.querySelector('#detailsButton')?.click();
        return new Promise((resolve) => {
          setTimeout(() => {
            const view = mgr?.shadowRoot?.querySelector('extensions-detail-view');
            const row = view?.shadowRoot?.querySelector('#allow-user-scripts');
            const toggle =
              row?.shadowRoot?.querySelector('cr-toggle') ?? row?.querySelector('cr-toggle');
            if (!toggle) return resolve({ err: 'toggle not found' });
            const wasOn = toggle.hasAttribute('checked');
            if (!wasOn) toggle.click();
            resolve({ wasOn });
          }, 1500);
        });
      });
      if (flipped.err) throw new Error(flipped.err);
      check('chrome://extensions 开「允许用户脚本」', true, flipped.wasOn ? '原本已开' : '已翻转');
    } catch (e) {
      check('chrome://extensions 开「允许用户脚本」', false, String(e).slice(0, 120));
    }
    await gatePage.close();
  }

  // 刷新 options:门禁已开 → 横幅消失(API 未定义状态只在 context 重载后重置)
  await options.reload();
  await options.waitForSelector('text=用户脚本', { timeout: 10_000 });
  await options.waitForTimeout(800);
  check('门禁开通后 options 无门禁横幅', !(await gateBanner.count()), `count=${await gateBanner.count()}`);
  await options.screenshot({ path: resolve(OUT, 'options-empty.png') });

  // ---- options 页定位辅助:操作全部圈在「用户脚本」卡片内(custom-styles 列表
  // 也有同名 aria-label 的按钮,跨卡片定位会误中) ----
  const usCard = options.locator('[data-slot="card"]', { hasText: '用户脚本' });
  const usButton = (name) => usCard.getByRole('button', { name });

  // 新建 → 行内编辑器
  await usButton('新建脚本').click();
  await options.waitForSelector('[data-testid="user-script-editor"]');
  // 填名称/作用域/代码(注入到本地靶站,MAIN world 留全局标记)。
  // pattern 无端口语义:host 段不带端口即匹配任意端口页面(实测)。
  await usCard.locator('input[aria-label="脚本名称"]').fill('标记脚本');
  await usCard.locator('#user-script-patterns').fill('*://127.0.0.1/*');
  await usCard.locator('#user-script-runat').selectOption('document_start');
  // JsEditor 是 CodeMirror:往 .cm-content 里打字
  await usCard.locator('.cm-content').fill('window.__US13__ = (window.__US13__ ?? 0) + 1;');
  await usButton('保存').click();
  await options.waitForTimeout(300);
  // 回清单(保存后仍停在编辑器,点返回)
  await usCard.locator('button[aria-label="返回清单"]').click();
  await options.waitForTimeout(300);
  check('新建+保存脚本落列表', (await usCard.getByText('标记脚本').count()) > 0);

  // 启用(新建默认未启用)
  const firstCheckbox = usCard.locator('[aria-label="启用 标记脚本"]');
  if (!(await firstCheckbox.isChecked())) await firstCheckbox.click();
  await options.waitForTimeout(500); // 等 background storage watch → register
  await options.screenshot({ path: resolve(OUT, 'options-script.png') });

  // ---- 注入验证:新开页面,MAIN world 标记可读 ----
  const page1 = await ctx.newPage();
  await page1.goto(url('/a'));
  await page1.waitForTimeout(800);
  let mark = await page1.evaluate(() => window.__US13__ ?? 0);
  check('启用脚本注入:新页面 MAIN world 标记 = 1', mark === 1, `实际 ${mark}`);

  // 单次执行:同页刷新前不重复;刷新(= 下次加载)再执行一次
  await page1.waitForTimeout(500);
  mark = await page1.evaluate(() => window.__US13__ ?? 0);
  check('页面驻留不重跑(单次执行)', mark === 1, `实际 ${mark}`);
  await page1.reload();
  await page1.waitForTimeout(800);
  mark = await page1.evaluate(() => window.__US13__ ?? 0);
  check('刷新后重新加载 → 再次执行', mark === 1, `实际 ${mark}`);

  // ---- 保存改动:改代码,已开页面不动,新页面生效 ----
  await usCard.locator('button[aria-label="编辑"]').click();
  await options.waitForSelector('[data-testid="user-script-editor"]');
  await usCard.locator('.cm-content').fill('window.__US13__ = 100;');
  await usButton('保存').click();
  await options.waitForTimeout(500);
  await page1.waitForTimeout(300);
  mark = await page1.evaluate(() => window.__US13__ ?? 0);
  check('保存改动不重放已开页面(下次加载生效)', mark === 1 || mark === 0, `实际 ${mark}(驻留页)`);

  const page2 = await ctx.newPage();
  await page2.goto(url('/b'));
  await page2.waitForTimeout(800);
  mark = await page2.evaluate(() => window.__US13__ ?? 0);
  check('新页面拿到新代码', mark === 100, `实际 ${mark}`);

  // ---- 执行顺序:第二条脚本列表靠后,后执行 ----
  await usCard.locator('button[aria-label="返回清单"]').click().catch(() => {});
  await options.waitForTimeout(300);
  await usButton('新建脚本').click();
  await options.waitForSelector('[data-testid="user-script-editor"]');
  await usCard.locator('input[aria-label="脚本名称"]').fill('顺序脚本');
  await usCard.locator('#user-script-patterns').fill('*://127.0.0.1/*');
  await usCard.locator('.cm-content').fill('window.__ORDER__ = (window.__ORDER__ ?? "") + "B";');
  await usButton('保存').click();
  await options.waitForTimeout(300);
  await usCard.locator('button[aria-label="返回清单"]').click().catch(() => {});
  await options.waitForTimeout(300);
  const secondCheckbox = usCard.locator('[aria-label="启用 顺序脚本"]');
  if (!(await secondCheckbox.isChecked())) await secondCheckbox.click();
  // 第一条脚本改为也写 __ORDER__ "A"(重注册全量,两条同时生效)。列表第一行 = 标记脚本
  await usCard.locator('button[aria-label="编辑"]').first().click();
  await options.waitForSelector('[data-testid="user-script-editor"]', { timeout: 10_000 });
  await usCard.locator('.cm-content').fill(
    'window.__US13__ = 100; window.__ORDER__ = (window.__ORDER__ ?? "") + "A";',
  );
  await usButton('保存').click();
  await options.waitForTimeout(800); // 等 background 全量重建

  const page3 = await ctx.newPage();
  await page3.goto(url('/c'));
  await page3.waitForTimeout(800);
  const order = await page3.evaluate(() => window.__ORDER__ ?? '');
  check('执行顺序 = 列表顺序(标记A → 顺序B)', order === 'AB', `实际 "${order}"`);

  // ---- 停用:停掉全部,新页面不注入 ----
  // 上一步保存后停在编辑器:先回清单,checkbox 才在
  await usCard.locator('button[aria-label="返回清单"]').click().catch(() => {});
  await options.waitForTimeout(300);
  if (await usCard.locator('[aria-label="启用 标记脚本"]').isChecked())
    await usCard.locator('[aria-label="启用 标记脚本"]').click();
  if (await usCard.locator('[aria-label="启用 顺序脚本"]').isChecked())
    await usCard.locator('[aria-label="启用 顺序脚本"]').click();
  await options.waitForTimeout(800);
  const page4 = await ctx.newPage();
  await page4.goto(url('/d'));
  await page4.waitForTimeout(800);
  const mark4 = await page4.evaluate(() => window.__US13__ ?? 0);
  const order4 = await page4.evaluate(() => window.__ORDER__ ?? '');
  check('停用后新页面不注入', mark4 === 0 && order4 === '', `mark=${mark4} order="${order4}"`);

  // ---- 泄漏页截图取证 ----
  await options.screenshot({ path: resolve(OUT, 'options-final.png') });
  await page3.screenshot({ path: resolve(OUT, 'page-injected.png') });
} finally {
  await browser.close();
  target.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n=== ${results.length - failed.length}/${results.length} PASS`);
process.exit(failed.length ? 1 : 0);

/**
 * T6(#27)便签收口验收脚本:真浏览器跑便签链路 + 四主题 × 三页面截图。
 * 用法:wxt build -b chrome && node scripts/acceptance-notes.mjs
 *      CHAN=msedge node scripts/acceptance-notes.mjs   (Edge 冒烟,需先 wxt build -b edge)
 * 产物:.output/acceptance/notes/*.png + 控制台断言报告。
 * 覆盖(#27 AC):设置区块开关、悬浮卡片注入/SPA 跟随、总开关关→卡片消失/开→恢复、
 * 侧栏聚合、便签板,四主题 × 卡片/侧栏/便签板截图。
 */
import { chromium } from 'playwright-core';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** 从 manifest key 推导扩展 id(Chromium 系通用,免抓 chrome://extensions DOM) */
function extensionIdFromKey(manifestPath) {
  const key = JSON.parse(readFileSync(manifestPath, 'utf8')).key;
  const hash = createHash('sha256').update(Buffer.from(key, 'base64')).digest('hex');
  return [...hash.slice(0, 32)].map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('');
}

const OUT = resolve('.output/acceptance/notes');
mkdirSync(OUT, { recursive: true });

const channel = process.env.CHAN || undefined; // 默认 Playwright 自带 chromium;msedge 走本机 Edge
const browserDir = process.env.CHAN === 'msedge' ? '.output/edge-mv3' : '.output/chrome-mv3';
const extPath = resolve(browserDir);
const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

// ---- 本地测试页:页面 A(有签)/ SPA pushState 到页面 B(无签) ----
const PORT = 18742;
const pageA = `http://127.0.0.1:${PORT}/page-a`;
const server = createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  if (req.url === '/page-b') {
    res.end('<!doctype html><html><body><h1>Page B(无签)</h1></body></html>');
    return;
  }
  res.end(`<!doctype html><html><body>
<h1>Page A(有签)</h1>
<a id="spa" href="/page-b" onclick="event.preventDefault();history.pushState(null,'','/page-b')">去 B 页</a>
</body></html>`);
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

const browser = await chromium.launchPersistentContext('', {
  channel,
  headless: false,
  args: [
    // MV3 扩展加载在 stable Chrome 137+ 已禁,本组合用 Playwright chromium + headless=new
    '--headless=new',
    `--disable-extensions-except=${extPath}`,
    `--load-extension=${extPath}`,
  ],
});

const cardDot = (p) =>
  p.evaluate(() => document.querySelector('lif3ng-notes')?.shadowRoot?.querySelector('[data-testid="note-dot"]') !== null);
const cardBadge = (p) =>
  p.evaluate(() => document.querySelector('lif3ng-notes')?.shadowRoot?.querySelector('[data-testid="note-badge"]')?.textContent ?? null);
const cardTextarea = (p) =>
  p.evaluate(() => document.querySelector('lif3ng-notes')?.shadowRoot?.querySelector('textarea')?.value ?? null);

try {
  const extId = extensionIdFromKey(resolve(extPath, 'manifest.json'));
  console.log('extension id:', extId);
  const url = (f) => `chrome-extension://${extId}/${f}`;

  // options 页:后续所有操作的控制台
  const options = await browser.newPage();
  options.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 200)));
  await options.goto(url('options.html'));
  await options.waitForSelector('#notes-enabled', { timeout: 30000 }).catch(async () => {
    await options.screenshot({ path: resolve(OUT, 'options-debug.png') });
    throw new Error('options 页 30s 未渲染出便签区块');
  });

  // -- 设置区块:开关存在且默认开 --
  check('options 渲染便签区块(总开关)', await options.$('#notes-enabled') !== null);
  check('总开关默认开(fallback)', (await options.getAttribute('#notes-enabled', 'aria-checked')) === 'true');

  // 关「跟随系统」(#12 同款先见:默认开启时点暗色会按系统明暗解析回亮侧,走查失真)
  const followSystem = await options.$('#follow-system');
  if (await followSystem.isChecked()) await followSystem.uncheck();
  await options.waitForTimeout(150);

  // seed:页面便签 + 全局便签(直接落 storage,等价另一上下文写入)
  const notes = [
    { id: 'n-page', url: pageA, text: '页面 A 的便签', createdAt: 1, updatedAt: 1 },
    { id: 'n-global', url: null, text: '全局便签一条', createdAt: 2, updatedAt: 2 },
  ];
  // eslint-disable-next-line no-undef -- chrome 是扩展页面上下文的全局,Node 侧静态分析不可见
  await options.evaluate((n) => chrome.storage.local.set({ notes: n }), notes);

  // -- 悬浮卡片注入 --
  const card = await browser.newPage();
  await card.goto(pageA);
  // 宿主元素 inline 零尺寸,Playwright 视为 hidden;等 attached,实际断言走 shadow root 查询
  await card.waitForSelector('lif3ng-notes', { timeout: 15000, state: 'attached' });
  await card.waitForFunction(() =>
    document.querySelector('lif3ng-notes')?.shadowRoot?.querySelector('[data-testid="note-dot"]') !== null,
  );
  check('悬浮卡片注入:圆点出现,角标 = 1(不混全局签)', (await cardBadge(card)) === '1');

  // -- SPA 跟随(#27 验收抓出隔离世界真 bug,轮询兜底修复):未展开时 pushState 到无签页 → 圆点消失;返回 → 恢复 --
  await card.click('#spa');
  await card.waitForFunction(() =>
    !document.querySelector('lif3ng-notes')?.shadowRoot?.querySelector('[data-testid="note-dot"]'),
  );
  check('SPA 跟随:pushState 到无签页 → 圆点消失(页面世界 pushState 也跟)', true);
  await card.goBack();
  await card.waitForFunction(() =>
    document.querySelector('lif3ng-notes')?.shadowRoot?.querySelector('[data-testid="note-dot"]') !== null,
  );
  check('SPA 跟随:返回 A 页 → 圆点恢复', true);

  // -- 展开:本页便签就地可见 --
  await card.evaluate(() => document.querySelector('lif3ng-notes').shadowRoot.querySelector('[data-testid="note-dot"]').click());
  await card.waitForFunction(() =>
    document.querySelector('lif3ng-notes')?.shadowRoot?.querySelector('textarea') !== null,
  );
  check('展开卡片:本页便签文本就地可见', (await cardTextarea(card)) === '页面 A 的便签');
  // 收起回折叠态,让后续开关断言统一落在圆点上
  await card.evaluate(() => document.querySelector('lif3ng-notes').shadowRoot.querySelector('[data-testid="note-collapse"]').click());
  await card.waitForFunction(() =>
    !document.querySelector('lif3ng-notes')?.shadowRoot?.querySelector('[data-testid="note-card"]'),
  );

  // -- 总开关联动:options 关 → content script 即时消失;开 → 恢复 --
  await options.click('#notes-enabled');
  await options.waitForTimeout(400);
  check('总开关关 → 悬浮卡片即时消失(跨页 storage.watch)', !(await cardDot(card)));
  check('总开关状态落 storage.local', (await options.getAttribute('#notes-enabled', 'aria-checked')) === 'false');

  // 关闭态下侧栏/便签板不受影响(AC:数据保留,只停页面注入)
  const sidepanelOff = await browser.newPage();
  await sidepanelOff.goto(url('sidepanel.html'));
  await sidepanelOff.waitForSelector('[role="tab"]', { timeout: 15000 });
  await sidepanelOff.getByRole('tab', { name: '便签' }).click();
  await sidepanelOff.waitForSelector('[data-testid="notes-tab-content"]', { timeout: 15000 });
  const globalOff = await sidepanelOff.$eval('[data-testid="global-notes"]', (el) => el.textContent);
  check('关闭态:侧栏便签 tab 照常渲染(不受总开关影响)', globalOff.includes('全局便签'));
  await sidepanelOff.close();

  const boardOff = await browser.newPage();
  await boardOff.goto(url('notes-board.html'));
  await boardOff.waitForSelector('textarea', { timeout: 15000 });
  await boardOff.waitForFunction(() =>
    [...document.querySelectorAll('textarea')].some((t) => t.value === '全局便签一条'),
  );
  check('关闭态:便签板照常渲染(不受总开关影响)', true);
  await boardOff.close();

  await options.click('#notes-enabled');
  await card.waitForFunction(() =>
    document.querySelector('lif3ng-notes')?.shadowRoot?.querySelector('[data-testid="note-dot"]') !== null,
  ).catch(() => {});
  await options.waitForTimeout(400);
  check('总开关开 → 悬浮卡片恢复', await cardDot(card));

  // -- 侧栏聚合(以 tab 打开 sidepanel.html):切到便签 tab,本页/全局分区渲染 --
  const sidepanel = await browser.newPage();
  await sidepanel.goto(url('sidepanel.html'));
  await sidepanel.waitForSelector('[role="tab"]', { timeout: 15000 });
  await sidepanel.getByRole('tab', { name: '便签' }).click();
  await sidepanel.waitForSelector('[data-testid="notes-tab-content"]', { timeout: 15000 });
  const globalSection = await sidepanel.$eval('[data-testid="global-notes"]', (el) => el.textContent);
  check('侧栏聚合:便签 tab 渲染,全局分区可见(总开关不影响侧栏)', globalSection.includes('全局便签'));
  await sidepanel.screenshot({ path: resolve(OUT, 'sidepanel.png') });

  // -- 便签板:全局便签主场(文本在 textarea value 里,不能走 text= 定位器) --
  const board = await browser.newPage();
  await board.goto(url('notes-board.html'));
  await board.waitForSelector('textarea', { timeout: 15000 });
  await board.waitForFunction(() =>
    [...document.querySelectorAll('textarea')].some((t) => t.value === '全局便签一条'),
  );
  const boardValues = await board.$$eval('textarea', (ts) => ts.map((t) => t.value));
  check('便签板:全局便签可见,页面便签不混入', boardValues.includes('全局便签一条') && !boardValues.includes('页面 A 的便签'));

  // -- 四主题 × 三页面截图 --
  const swatches = await options.$$('button[aria-pressed]');
  const labels = await Promise.all(swatches.map((b) => b.textContent().then((t) => t.trim().replace(/生效中$/, '').trim())));
  const expectTheme = { '亮色': 'light', '暗色': 'dark', 'Vercel 亮色': 'vercel-light', 'Vercel 暗色': 'vercel-dark' };
  for (let i = 0; i < swatches.length; i++) {
    const theme = expectTheme[labels[i]];
    await swatches[i].click();
    await options.waitForTimeout(400); // storage.watch → 三处页面/卡片跟随
    const actual = await card.evaluate(() =>
      document.querySelector('lif3ng-notes')?.shadowRoot?.querySelector('[data-theme]')?.getAttribute('data-theme'),
    );
    check(`主题 ${theme}:悬浮卡片跟随`, actual === theme, `实际 ${actual}`);
    await card.screenshot({ path: resolve(OUT, `card-${theme}.png`) });
    await sidepanel.screenshot({ path: resolve(OUT, `sidepanel-${theme}.png`) });
    await board.screenshot({ path: resolve(OUT, `board-${theme}.png`) });
  }
} finally {
  await browser.close();
  server.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n=== ${results.length - failed.length}/${results.length} PASS${channel ? ` (${channel})` : ''}`);
process.exit(failed.length ? 1 : 0);

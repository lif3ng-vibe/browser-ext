// [DEBUG-b7k1] 反馈回路:加载 chrome-mv3 扩展,直接打开 sidepanel.html,抓报错。
// 红的判定:console error / pageerror 出现,或 sidepanel 主内容没渲染出来。
// 扩展 ID 从 chrome://extensions 页面 DOM 拿(开 devMode 后 item id 即扩展 ID)。
/* global chrome */ // evaluate 回调在扩展页面上下文执行,chrome 为浏览器端全局
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = '.output/loop-sidepanel';
mkdirSync(OUT, { recursive: true });

const errors = [];

const EXT_DIR = new URL('../.output/chrome-mv3', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');

const ctx = await chromium.launchPersistentContext('', {
  headless: false,
  args: [
    `--disable-extensions-except=${EXT_DIR}`,
    `--load-extension=${EXT_DIR}`,
    '--no-first-run',
  ],
});

const probe = await ctx.newPage();
let extId = null;
await probe.goto('chrome://extensions/');
await probe.waitForTimeout(1000);
// 打开开发者模式以显示扩展 ID 与错误
const toggle = probe.locator('cr-toggle#devMode');
await toggle.click();
await probe.waitForTimeout(500);
const items = await probe.locator('extensions-item').evaluateAll((els) =>
  els.map((el) => ({
    id: el.id,
    name: el.shadowRoot.querySelector('#name')?.textContent?.trim(),
    errorsButton: !!el.shadowRoot.querySelector('#errors-button'),
  })),
);
console.log('EXT_ITEMS:', JSON.stringify(items, null, 1));
const ext = items.find((i) => i.name?.includes('browser-ext') || i.name);
if (ext) extId = ext.id;
if (!extId) throw new Error('未找到已加载扩展');
console.log('EXT_ID:', extId);

const page = await ctx.newPage();
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') {
    errors.push(`[console.${m.type()}] ${m.text()}`);
  }
});
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

await page.goto(`chrome-extension://${extId}/sidepanel.html`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

// ---- 红回路:预置坏存量数据(某历史时刻 storage 里 patterns 为字符串 + editingId 指向它)----
// 用户症状:打开侧边栏即 TypeError: e.record.patterns.join is not a function
const BUG_RECORD = {
  id: 'bad-record-1',
  name: '坏数据样式',
  enabled: true,
  patterns: '*://a.com/*', // 坏:字符串而非数组
  code: 'body{}',
  createdAt: 1,
  updatedAt: 1,
};
await page.evaluate((rec) => chrome.storage.local.set({ 'customStyles': [rec], 'customStyles/editing': rec.id }), BUG_RECORD);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const red = errors.some((e) => e.includes('patterns.join is not a function'));

// 交互序列(仅绿基线时跑,坏数据场景跳过)
const acts = [];
const runSteps = !red;
async function step(name, fn) {
  try {
    await fn();
    acts.push(`OK  ${name}`);
  } catch (e) {
    acts.push(`ERR ${name}: ${e.message.split('\n')[0]}`);
  }
  await page.waitForTimeout(600);
}

if (runSteps) await step('新建样式', () => page.getByText('新建样式').click());
if (runSteps) await step('样式名输入', () =>
  page.locator('input').first().fill('回路测试样式'),
);
if (runSteps) await step('CSS 输入', () => page.locator('.cm-content').first().fill('body { color: red; }'));
if (runSteps) await step('保存', () => page.getByText('保存').first().click());
if (runSteps) await step('截图后返回列表', () => page.getByText('返回').first().click());

// 主内容可见性断言:样式 tab 的管理面板是否渲染出来
const tablist = await page.locator('[role=tablist]').count();
const mainHtml = await page.locator('main').first().innerHTML();
const mainLen = mainHtml.length;
await page.screenshot({ path: `${OUT}/sidepanel.png`, fullPage: true });

console.log('TABLIST_COUNT:', tablist);
console.log('MAIN_HTML_LEN:', mainLen);
console.log('STEPS:', JSON.stringify(acts, null, 1));
console.log('RED(bad-data repro):', red);
console.log('MAIN_HTML_HEAD:', mainHtml.slice(0, 500));
console.log('ERRORS:', errors.length);
for (const e of errors) console.log('  ' + e);

await ctx.close();
// 红回路:命中用户症状(patterns.join 报错)→ exit 0(复现成功);其余 error → exit 1
const otherErr = errors.some((e) => e.startsWith('[console.error]') || e.startsWith('[pageerror]'));
process.exit(red ? 0 : otherErr ? 1 : 0);
/**
 * Token 规范强制面(#11 / docs/ui.md):CSS 侧色值纪律。
 * - tokens.css 是唯一允许裸色值(oklch/hex)的文件——token 真源
 * - 其余 .css 只准 var(--lif3ng-*) 等语义引用
 * - Tailwind v4 at-rule(@theme/@custom-variant)与 import 语法按需放行
 * - 豁免:`/* tokens-ignore: <理由> *` 行注释(stylelint-disable-line 简写靠人守,
 *   这里实现为对违规行的 message 提示,豁免统一走 stylelint-disable 注释 + 理由)
 */
export default {
  extends: ['stylelint-config-standard'],
  ignoreFiles: ['public/**', '.output/**', 'node_modules/**'],
  rules: {
    // Tailwind v4 生态写法
    'import-notation': ['string'],
    'at-rule-no-unknown': [
      true,
      {
        ignoreAtRules: ['theme', 'custom-variant', 'source', 'utility', 'variant', 'plugin', 'apply', 'reference', 'config'],
      },
    ],
    // ---- 色值纪律 ----
    'color-no-hex': [true, { message: '色值只能写进 tokens.css(token 真源)。豁免:stylelint-disable-line color-no-hex -- tokens-ignore: 理由' }],
    // shadcn/tweakcn 导出口径是无单位 oklch,保留原样降低导入摩擦
    'lightness-notation': null,
    'hue-degree-notation': null,
    // 字体名是专有名词(Georgia/Consolas),不强制小写
    'value-keyword-case': ['lower', { ignoreProperties: ['font-family', 'font'], ignoreKeywords: ['Georgia', 'Consolas'] }],
    'declaration-property-value-allowed-list': {
      '/^background(-color)?$/': ['/^var\\(--lif3ng-[\\w-]+\\)(\\s+[^;]+)?$/'],
      'color': ['/^var\\(--lif3ng-[\\w-]+\\)$/'],
      'border-color': ['/^var\\(--lif3ng-[\\w-]+\\)$/'],
      'outline-color': ['/^var\\(--lif3ng-[\\w-]+\\)$/'],
    },
  },
  overrides: [
    {
      // token 真源:唯一可写裸色值之地;shadcn/tailwind 入口文件的非色值格式规则照常
      files: ['src/shared/theme/tokens.css'],
      rules: {
        'color-no-hex': null,
        'declaration-property-value-allowed-list': null,
      },
    },
    {
      // tailwind.css 入口:shadcn 生成物的注释/空行风格不追;@apply 不受白名单管
      files: ['src/shared/theme/tailwind.css'],
      rules: {
        'declaration-property-value-allowed-list': null,
        'comment-empty-line-before': null,
        'rule-empty-line-before': null,
      },
    },
  ],
};
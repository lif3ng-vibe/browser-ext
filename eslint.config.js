import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import pluginVue from 'eslint-plugin-vue';
import globals from 'globals';

/*
 * Token 规范强制面(#11 / docs/ui.md):
 * 禁止原子色 utility(red-500 等)进组件——UI 只准消费语义 token 类。
 * 豁免:行内注释 tokens-ignore(后接冒号与理由),豁免须带理由。
 * 注:vue-eslint-parser 的 templateBody 不进 core 规则遍历(no-restricted-syntax
 * 看不到 VElement/VLiteral),模板静态 class 由本地自定义规则 atomic-class 检查。
 */

/** 原子色 utility:标准调色板色号类,如 text-red-500、bg-zinc-100/80、hover:text-blue-300 */
const ATOMIC_COLOR_CLASS = '(?:[\\w-]+:)*(?:text|bg|border|ring|fill|stroke|outline|from|via|to|decoration|divide|accent|caret|shadow)-(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone|black|white)(?:-\\d{2,3})?(?:\\/\\d{1,3})?\\b';
const ATOMIC_RE = new RegExp(ATOMIC_COLOR_CLASS);
const MSG =
  '原子色 utility 禁用:只用语义 token 类(bg-primary / text-muted-foreground 等)。加新语义槽位先改 tokens.css。豁免用行内 tokens-ignore 注释(带理由)。';

/** 是否被行内 tokens-ignore 注释豁免(必须是紧邻上一行的注释,理由必填) */
function hasTokensIgnore(context, node) {
  const lines = context.sourceCode.getLines();
  const start = node.loc.start.line;
  const prevLine = lines[start - 2] ?? '';
  return /tokens-ignore\s*:/.test(prevLine) || /tokens-ignore\s*:/.test(context.sourceCode.getText(node));
}

const atomicClass = {
  meta: { type: 'problem', schema: [] },
  create(context) {
    function checkString(raw, node) {
      if (raw && ATOMIC_RE.test(raw) && !hasTokensIgnore(context, node)) {
        context.report({ node, message: MSG });
      }
    }
    // Vue 文件:模板走 defineTemplateBodyVisitor,脚本走普通 visitor
    const services = context.sourceCode.parserServices;
    const scriptVisitor = {
      'Literal, TemplateElement'(node) {
        const raw = node.type === 'Literal' ? node.value : node.value?.cooked;
        if (typeof raw === 'string') checkString(raw, node);
      },
    };
    if (services?.defineTemplateBodyVisitor) {
      return services.defineTemplateBodyVisitor(
        {
          // 模板静态 class="..."(不过 esquery 选择器,手动判定更稳)
          VAttribute(node) {
            if (node.directive || !node.value) return;
            if (node.key?.name !== 'class') return;
            checkString(node.value.value, node.value);
          },
        },
        scriptVisitor,
      );
    }
    return scriptVisitor;
  },
};

const tokenLintPlugin = {
  meta: { name: 'lif3ng-token-lint', version: '0.1.0' },
  rules: { 'atomic-class': atomicClass },
};

export default tseslint.config(
  { ignores: ['.output/', '.wxt/', 'node_modules/', 'public/'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: { parser: tseslint.parser },
    },
  },
  {
    // shadcn-vue 复制组件(Button/Card/...):上游命名约定与类写法,不归我们改
    files: ['src/shared/ui/**/*.{vue,ts}'],
    rules: {
      'vue/multi-word-component-names': 'off',
      'vue/require-default-prop': 'off',
 // token 禁令也整体豁免:复制组件由上游 shadcn 仓库守护
    },
  },
  {
    plugins: { 'lif3ng': tokenLintPlugin },
    files: ['src/**/*.{vue,ts}'],
    ignores: ['src/shared/ui/**', 'public/**'],
    rules: {
      // 原子色统一由 lif3ng/atomic-class 检查(脚本字面量 + 模板静态 class)
      'lif3ng/atomic-class': 'error',
    },
  },
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        // WXT 注入的全局(webextension-polyfill):TS 类型由 .wxt 类型生成提供
        browser: 'readonly',
      },
    },
  },
);
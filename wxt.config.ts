import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  srcDir: 'src',
  // Tailwind v4 走 WXT 官方路径:直接挂 @tailwindcss/vite(wxt-module-tailwindcss 已 404)
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  // 版本单一来源是 git tag(package.json 固定 0.0.0)。CI 传 WXT_VERSION 注入
  // manifest 版本,zip 文件名跟着 manifest 版本走(默认模板取 packageVersion)。
  manifest: (env) => ({
    name: 'browser-ext',
    description: '个人浏览器插件工具箱',
    version: process.env.WXT_VERSION || '0.0.0',
    // storage:主题/custom-styles 存储同步(非敏感);sidePanel:侧边栏管理面板 API(仅 Chromium)
    permissions: env.browser === 'firefox' ? ['storage'] : ['storage', 'sidePanel'],
    // custom-styles(#3):<all_urls> host 权限 —— content script 全站注入 + tabs.url 读取
    host_permissions: ['<all_urls>'],
  }),
  zip: {
    artifactTemplate: '{{name}}-{{version}}-{{browser}}.zip',
  },
});

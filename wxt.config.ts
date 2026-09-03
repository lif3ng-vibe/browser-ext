import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';
import { existsSync, readFileSync } from 'node:fs';

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
    // 本地自动化测试的稳定扩展 ID:key 存 .superpowers/sdd/ext-key.txt(gitignored,
    // 不随产物分发);存在则注入 manifest.key,Chrome 由它派生固定 ID。CI 无此文件,不受影响。
    ...(existsSync('.superpowers/sdd/ext-key.txt')
      ? { key: readFileSync('.superpowers/sdd/ext-key.txt', 'utf8').trim() }
      : {}),
    // storage:主题/custom-styles 存储同步(非敏感);sidePanel:侧边栏管理面板 API(仅 Chromium)
    // userScripts(#13):Chromium 装时声明(用户还需在 chrome://extensions 开"允许用户脚本");
    // Firefox 唯 optional 权限(代码里 permissions.request 申请,见 ManageUserScriptsBlock)
    permissions:
      env.browser === 'firefox' ? ['storage'] : ['storage', 'sidePanel', 'userScripts'],
    // Firefox:userScripts 是 optional-only 权限(MDN),不进 permissions
    optional_permissions: env.browser === 'firefox' ? ['userScripts'] : undefined,
    // custom-styles(#3):<all_urls> host 权限 —— content script 全站注入 + tabs.url 读取
    // user-scripts(#13):userScripts.register 的 matches 同样吃 host 权限
    host_permissions: ['<all_urls>'],
  }),
  zip: {
    artifactTemplate: '{{name}}-{{version}}-{{browser}}.zip',
  },
});

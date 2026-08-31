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
  manifest: () => ({
    name: 'browser-ext',
    description: '个人浏览器插件工具箱',
    version: process.env.WXT_VERSION || '0.0.0',
    // storage:主题系统(shared/theme)用 WXT storage 存设置 + 跨页面同步(非敏感权限)
    permissions: ['storage'],
  }),
  zip: {
    artifactTemplate: '{{name}}-{{version}}-{{browser}}.zip',
  },
});

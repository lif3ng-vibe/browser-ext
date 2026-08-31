import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  srcDir: 'src',
  // 版本单一来源是 git tag(package.json 固定 0.0.0)。CI 传 WXT_VERSION 注入
  // manifest 版本,zip 文件名跟着 manifest 版本走(默认模板取 packageVersion)。
  manifest: () => ({
    name: 'browser-ext',
    description: '个人浏览器插件工具箱',
    version: process.env.WXT_VERSION || '0.0.0',
  }),
  zip: {
    artifactTemplate: '{{name}}-{{version}}-{{browser}}.zip',
  },
});

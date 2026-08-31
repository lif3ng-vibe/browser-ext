# features/

每个子目录是一个自包含的 Feature:entrypoint、逻辑、样式全在自己目录内。

- Feature 之间默认禁止互相 import;共享代码下沉到 `src/shared/`。
- 浏览器差异只允许消化在 Feature 内部。
- 删除目录 = 干净移除该功能。

见 [ADR-0002](../../../docs/adr/0002-feature-isolation.md)。

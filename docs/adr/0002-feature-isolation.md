---
status: accepted
---

# 功能隔离:目录即边界

N 个彼此独立的 Feature 共存于一个插件。架构形状:`src/features/<名>/` 目录即边界,entrypoint、逻辑、样式全在自己目录内,Feature 之间默认禁止互相 import;共享代码只放 `src/shared/` 且必须浏览器无关,浏览器差异只允许消化在 Feature 内部。这样"删除目录 = 干净移除功能"始终成立。真需要 Feature 间交互时,拷问该功能时单独放行并另记 ADR。权限取全功能并集、单插件分发,不做构建期裁剪;但每个功能的敏感权限(如 `host_permissions`)拷问时必须显式过一遍。

## Consequences

- 加新功能 = 加新目录,不碰旧功能。
- shared/ 里出现浏览器分支即是违规信号。
- 留痕:https://github.com/lif3ng-vibe/browser-ext/issues/2

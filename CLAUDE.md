# browser-ext

个人浏览器插件工具箱。自嗨型功能,只为一个人(我)做。
跨浏览器支持靠框架层磨平(选型待定)。需求持续到达,先落成 GitHub issue——所有决定必须在那里留痕。

## 文档语言(强制)

所有给我阅读的文档一律使用**中文**,保证我可以顺畅阅读:

- `README.md`、`CONTEXT.md`、`docs/` 下所有文档(含 ADR)
- **GitHub issues 的标题与正文**——决定留痕的地方,必须可读
- commit message 也用中文(保留 `chore:`/`docs:` 这类 conventional 前缀)
- 例外:代码、命令、标识符(标签名、文件路径、CLI 调用、API 名)保持英文原样

## 项目事实

- 每个决定都记录在 GitHub Issues(`lif3ng-vibe/browser-ext`);难逆转的决定另写 ADR 存 `docs/adr/`。
- 功能彼此独立设计;新想法先打 `idea` 标签落成 issue,再拷问细化。

## Agent skills

### Issue tracker

Issues 存放在 GitHub Issues(`lif3ng-vibe/browser-ext`),经 `gh` CLI 操作。见 `docs/agents/issue-tracker.md`。

### Triage labels

五个标准 triage 角色标签,外加 `idea` 原始 backlog 标签。见 `docs/agents/triage-labels.md`。

### Domain docs

单上下文:根目录一份 `CONTEXT.md` + `docs/adr/`。见 `docs/agents/domain.md`。

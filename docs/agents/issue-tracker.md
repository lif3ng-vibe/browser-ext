# Issue tracker:GitHub

本仓库的 issues 和规格文档存放在 `lif3ng-vibe/browser-ext` 的 GitHub Issues 里。所有操作使用 `gh` CLI。

## 惯例

- **创建 issue**:`gh issue create --title "..." --body "..."`。多行正文用 heredoc。
- **读 issue**:`gh issue view <number> --comments`,用 `jq` 过滤评论,同时取标签。
- **列 issues**:`gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'`,按需加 `--label` 和 `--state` 过滤。
- **评论**:`gh issue comment <number> --body "..."`
- **加/去标签**:`gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **关闭**:`gh issue close <number> --comment "..."`

从 `git remote -v` 推断仓库;在 clone 里运行时 `gh` 会自动识别。

## Pull request 作为 triage 面

**外部 PR 作为请求入口:否。** _(如果本仓库开始把外部 PR 当功能请求处理,改为 `yes`;`/triage` 会读这个标志。)_

设为 `yes` 时,PR 走和 issue 相同的标签与状态体系,用 `gh pr` 等价命令:

- **读 PR**:`gh pr view <number> --comments`,看 diff 用 `gh pr diff <number>`。
- **列待 triage 的外部 PR**:`gh pr list --state open --json number,title,body,labels,author,authorAssociation,comments`,只保留 `authorAssociation` 为 `CONTRIBUTOR`、`FIRST_TIME_CONTRIBUTOR` 或 `NONE` 的(丢掉 `OWNER`/`MEMBER`/`COLLABORATOR`)。
- **评论/打标/关闭**:`gh pr comment`、`gh pr edit --add-label`/`--remove-label`、`gh pr close`。

GitHub 的 issue 和 PR 共用一个编号空间,所以 `#42` 可能是两者之一:先 `gh pr view 42`,失败再 `gh issue view 42`。

## 当技能说"发布到 issue tracker"

创建一个 GitHub issue。

## 当技能说"取相关工单"

运行 `gh issue view <number> --comments`。

## Wayfinder 操作

供 `/wayfinder` 使用。**地图(map)**是一个 issue,**子** issue 作为工单。

- **Map**:一个带 `wayfinder:map` 标签的 issue,正文承载 Notes / Decisions-so-far / Fog。`gh issue create --label wayfinder:map`。
- **子工单**:作为 GitHub sub-issue 挂到 map 下(`gh api` 调 sub-issues 端点)。若 sub-issues 不可用,把子工单加进 map 正文的 task list,并在子工单正文顶部写 `Part of #<map>`。标签用 `wayfinder:<type>`(`research`/`prototype`/`grilling`/`task`)。被认领后,工单 assign 给驱动的 dev。
- **Blocking(阻塞关系)**:用 GitHub **原生 issue dependencies**,这是 UI 可见的权威表示。加边:`gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`,其中 `<blocker-db-id>` 是阻塞方的数字 **database id**(`gh api repos/<owner>/<repo>/issues/<n> --jq .id`,_不是_ `#number` 也不是 `node_id`)。GitHub 在 `issue_dependencies_summary.blocked_by` 里报告(只算未关闭的阻塞方,这是实时的门)。若 dependencies 不可用,退而在子工单正文顶部写 `Blocked by: #<n>, #<n>`。所有阻塞方都关闭后工单才算解锁。
- **前沿查询(frontier)**:列出 map 的未关闭子工单(`gh issue list --state open`,限定在 map 的 sub-issues / task list 内),丢掉有未关闭阻塞方(`issue_dependencies_summary.blocked_by > 0`,或 `Blocked by` 行里有未关闭 issue)或已有 assignee 的;按 map 顺序取第一个。
- **认领**:`gh issue edit <n> --add-assignee @me`,这是会话的第一个写操作。
- **解决**:`gh issue comment <n> --body "<答案>"`,然后 `gh issue close <n>`,最后把上下文指针(gist + 链接)追加到 map 的 Decisions-so-far。

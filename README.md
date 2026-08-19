# pi-claude-plan-mode

在 Pi 中复刻 Claude Code 风格的 Plan Mode：先用可配置的 Plan 工具白名单探索代码库，把方案写入独立的 canonical plan 文件，显式交给用户审批，再选择保留上下文执行，或清空上下文并创建一个新的 execution session。

本插件面向 Pi `0.84.2+`，尤其适合常规工作流只启用以下两个工具的环境：

- `shell_command`
- `apply_patch`

进入 Plan Mode 后，插件会临时切换到用户配置的工具白名单。默认仍使用 Pi 官方的结构化只读工具，但也可以在配置界面中加入搜索、GitHub、MCP 或其他已注册工具。

## 核心行为

普通阶段通常保留用户当前的工具，例如：

```text
shell_command
apply_patch
EnterPlanMode
ask_user_question（若已安装）
```

Plan Mode 的默认白名单为：

```text
read
grep
find
ls
ask_user_question（若已安装）
```

此外，以下 workflow 工具由插件固定管理，不需要在配置界面中选择：

```text
plan_write
ExitPlanMode
```

其中：

- 未进入白名单的工具在 Plan Mode 中不可见，并在 `tool_call` 阶段再次阻断；
- `plan_write` 没有路径参数，只能完整替换当前 canonical plan 文件；
- `EnterPlanMode` 在 Plan Mode 内不会再次暴露；
- `EnterPlanMode` 与 `ExitPlanMode` 必须单独出现在一个 tool-call turn 中；
- 即使白名单包含 `shell_command`、`apply_patch` 等能力，Plan 提示词仍明确禁止实现修改和副作用。允许此类工具意味着用户接受其内部操作无法由插件进一步沙箱化。

Plan 文件默认保存到：

```text
~/.pi/agent/plans/<uuid>.md
```

如果设置了 `PI_CODING_AGENT_DIR`，则遵循 Pi 的 agent directory。

## 安装

从 GitHub 全局安装：

```bash
pi install git:github.com/CoderDoubleflower/pi-claude-plan-mode
```

项目级安装：

```bash
pi install -l git:github.com/CoderDoubleflower/pi-claude-plan-mode
```

安装或升级后重启 Pi，或执行：

```text
/reload
```

## 前置条件

默认配置使用 Pi 内置的 `read/grep/find/ls`，因此这些工具需要保留在运行时注册表中；它们可以在普通模式保持 inactive。若启动参数或工具管理插件彻底移除了默认工具，可以先通过 `/plan config` 改用当前实际注册的其他工具。

配置中选中的工具如果当前未注册，进入或恢复 Plan Mode 时会显示 warning，并跳过该工具；`plan_write` 与 `ExitPlanMode` 始终由插件注册和保留。

## 使用方式

### 用户主动进入

```text
/plan
```

也可以直接附带任务并立即开始规划：

```text
/plan 为编辑框增加上下方向键历史记录
```

等价的显式形式：

```text
/plan on 为编辑框增加上下方向键历史记录
```

### 模型主动进入

插件注册 `EnterPlanMode`。模型遇到多文件功能、架构调整或需要先探索的任务时，可以请求进入 Plan Mode；TUI 会要求用户确认。确认后，当前 agent run 会以 terminating tool result 正常结束，插件再自动发起一个隐藏的 planning continuation，使下一次模型调用从一开始就只看到配置的 Plan 工具白名单和 workflow 工具。

### 规划完成

模型必须：

1. 用配置的 Plan 工具探索代码，并主动寻找可以复用的既有实现；
2. 解决会影响实现方案的关键歧义；
3. 用 `plan_write` 写入完整计划；
4. 单独调用 `ExitPlanMode`。

内部提示词采用五阶段工作流：Initial Understanding、Design、Review、Final Plan、Finish。这些阶段只约束模型行为，不会显示在 TUI 中。

最终 Plan 采用明确的内容契约：

```markdown
## Context
用一段简洁文字说明为什么要改、解决什么问题，以及预期结果。

## Implementation Steps
1. `path/to/file.ts`
   - 说明具体修改；
   - 指出要复用的既有函数、类型或 utility 及其来源路径；
   - 必要时注明步骤顺序和依赖。

## Verification
- 列出仓库真实支持的验证命令；
- 说明需要确认的端到端行为或回归场景。
```

Plan 只保留推荐方案，不堆叠备选方案、未决选项、探索笔记或占位文本；整体应便于快速浏览，同时详细到 execution agent 无需重新发现设计。

TUI 的常驻 UI 只显示一个稳定的 `Plan Mode` 状态，用来告知当前处于只读规划约束中。它不会显示 planning/ready 等内部阶段、revision、Plan 路径或额外的 above-editor widget；批准计划并进入执行后，该状态会立即清除。`/plan status` 同样只报告 Plan Mode 是否 active。

`ExitPlanMode` 会结束当前 planning run，把完整计划展示出来，并把以下命令放入空闲编辑框：

```text
/plan-approve
```

本插件仅使用 stock Pi 的公开扩展 API，不尝试给 Pi 打补丁，也不检测或启用任何隐藏的新 session API。因此审批与 session 切换正式由 `/plan-approve` 完成。

## `/plan-approve`

无参数调用会显示以下选项：

```text
Execute plan (keep context)
Clear context and execute in a new session
Edit plan
Give feedback and continue planning
Stay in Plan Mode
```

也可以直接指定：

```text
/plan-approve keep
/plan-approve clear
/plan-approve edit
/plan-approve feedback
/plan-approve stay
```

### Keep context

在原 Plan session 内：

1. 固化 approved plan 的 revision、SHA-256 和完整正文；
2. 恢复进入 Plan Mode 前的工具集；
3. 应用 execution 模型和思考强度；
4. 注入 approved plan handoff；
5. 自动开始实现。

### Clear context

创建真正的新 execution session，而不是在原 session 中过滤消息：

```text
Planning session S1
        │
        ├─ 保存 approved plan snapshot
        ├─ 标记为 handed_off
        │
        ▼
Execution session S2
        ├─ parentSession = S1 transcript
        ├─ 新 session ID 与 transcript
        ├─ setup 写入 execution state 与 session name
        ├─ 只注入 approved plan handoff
        ├─ 应用 execution profile
        ├─ 恢复 execution 工具
        └─ 自动开始实现
```

S2 的 handoff 中会包含：

- approved plan 全文；
- revision；
- SHA-256；
- canonical plan 路径；
- planning session ID；
- planning transcript 路径。

如果创建新 session 被其他扩展取消，原 Plan session 会恢复为 ready 状态，不会丢失计划。

## Plan 配置界面

执行以下命令会打开交互式配置界面：

```text
/plan config
```

界面可以分别编辑全局配置和受信任项目的项目配置，并提供：

- Plan Mode 允许使用的工具白名单，多次选择即可勾选或取消；
- Plan 模型；
- Plan 思考强度；
- Execute 模型；
- Execute 思考强度；
- 当前 scope 的重置、JSON 预览和 effective configuration 预览。

模型列表来自当前 session 的 scoped models；未配置 model scope 时使用 `modelRegistry.getAvailable()` 返回的真实可用模型。项目配置按字段覆盖全局配置，工具白名单则以完整数组覆盖；选择 inherit 会继续使用上一级配置或内置默认值。

在 planning/ready 状态保存配置后，新的工具白名单、Plan profile 和 Execute profile 会立即应用到当前规划 session。已进入 execution 的 approved snapshot 不会被中途修改，新配置会在下一次 Plan workflow 生效。

### 配置文件

全局配置：

```text
~/.pi/agent/claude-plan-mode.json
```

项目配置：

```text
<project>/.pi/claude-plan-mode.json
```

项目配置按字段覆盖全局配置。项目尚未被 Pi 信任时，插件只读取全局配置，不读取项目目录中的配置文件。

示例：

```json
{
  "tools": [
    "read",
    "grep",
    "find",
    "ls",
    "ask_user_question"
  ],
  "planning": {
    "provider": "openai-codex",
    "model": "gpt-5.2-codex",
    "thinkingLevel": "xhigh"
  },
  "execution": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-5",
    "thinkingLevel": "high"
  }
}
```

也可以只配置思考强度：

```json
{
  "planning": {
    "thinkingLevel": "xhigh"
  },
  "execution": {
    "thinkingLevel": "high"
  }
}
```

支持的思考强度：

```text
off
minimal
low
medium
high
xhigh
max
```

`provider` 和 `model` 必须成对配置。只配置其中一个时，这两个字段会被忽略并显示 warning。

### 回退语义

进入 Plan Mode 前会保存 baseline profile：

```text
当前 provider/model
当前 thinking level
当前 active tools
```

随后：

- planning 未配置的字段回退到 baseline；
- execution 未配置的字段也回退到 baseline；
- execution 不会意外继承 planning 专属模型；
- 目标模型不存在或无凭据时，回退到 baseline 并显示 warning；
- 用户在 planning/execution 阶段手动切换模型或思考强度后，新的阶段 profile 会写入 session state，resume 时继续使用。

## 命令

```text
/plan                         进入 Plan Mode，或显示当前状态
/plan <task>                  进入 Plan Mode 并立即提交规划任务
/plan on [task]               显式进入 Plan Mode
/plan status                  查看 Plan Mode 是否 active
/plan edit                    编辑 canonical plan
/plan path                    显示 plan 文件路径
/plan approve [action]        /plan-approve 的别名
/plan off                     取消 Plan workflow 并恢复 baseline
/plan finish                  结束 execution profile 并恢复 baseline
/plan config                  打开工具、Plan/Execute 模型与思考强度配置界面
/plan-approve [action]        审批 ready plan
```

也可用启动参数让初始 session 直接进入 Plan Mode：

```bash
pi --plan
```

## Session 持久化

插件通过 custom session entry 保存：

- workflow stage；
- plan 文件、revision 和 hash；
- baseline profile 和工具快照；
- 当前 Plan session 固化的工具白名单；
- planning/execution profile；
- ready/approved snapshot；
- planning session 与 execution session 的来源关系。

恢复 session 或切换 branch 时，插件从当前 branch 的最新有效状态重建工具、模型、思考强度和 UI。

## Plan 一致性

- `plan_write` 支持 `expected_revision`，用于乐观并发检查；
- 外部编辑 Plan 文件会被检测，并自动生成新 revision；
- `ExitPlanMode` 后如果 Plan 文件发生变化，旧 ready snapshot 立即失效；
- execution handoff 使用审批时固化的完整正文，不会在执行时重新读取一个可能已变化的 draft；
- session 恢复时只接受与 `<agentDir>/plans/<plan-id>.md` 精确匹配的 managed Plan 路径；
- Plan 目录和文件拒绝符号链接替换，原子写入使用私有临时文件；
- 新 Plan 必须完整替换初始模板，并包含非空的 `## Context`、带编号步骤的 `## Implementation Steps` 和非空的 `## Verification`；为恢复旧 session，早期的 `Objective`/`Validation` 标题仍可兼容读取。

## 开发

```bash
npm install
npm run typecheck
npm test
```

测试覆盖：

- 全局/项目配置合并；
- 模型配置回退；
- Plan revision 与外部修改检测；
- stale write 拒绝；
- 状态恢复；
- Plan 工具集边界；
- approved snapshot handoff；
- `/plan-approve clear` 通过 stock Pi `newSession({ setup, withSession })` 创建 child session；
- 模型主动调用 `EnterPlanMode` 后的 terminating continuation；
- Claude 风格的五阶段内部规划提示与最终 Plan 内容契约；
- planning/ready 只显示统一 `Plan Mode` 状态，execution 清除该状态且不创建常驻 widget；
- session replacement 取消后的 ready-state 恢复；
- keep-context execution 与 `/plan finish` baseline 恢复；
- session tree 工具状态恢复；
- handoff 中断后的 approved snapshot 重建。

## 安全边界

Plan Mode 的主要不变量是：

```text
只有配置白名单中的工具会在 Plan Mode 暴露
plan_write 与 ExitPlanMode 由插件固定管理
提示词始终禁止进入实现和执行副作用
```

工具切换本身不是操作系统沙箱；Pi extension 与被允许的工具仍运行在当前用户权限下。默认 `read/grep/find/ls` 提供最强的结构化只读边界。用户主动把 Shell、编辑、网络写入或其他有副作用的工具加入白名单后，插件只能限制“是否可调用该工具”，无法分析和沙箱化工具内部的每一种操作，因此应只选择自己信任且确实需要用于规划的工具。

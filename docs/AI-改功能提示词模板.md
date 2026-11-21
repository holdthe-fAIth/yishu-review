# AI 改功能提示词模板（新会话 / 换 AI 直接用）

> 用途：**每个新功能开一个新会话**，把下面的「极简开场白」+ 需求发给任意会写代码的 AI（Kimi / Claude / GPT / 本地 Agent 都行）。
> 前提：它能看到本仓库（本地目录或 `git clone https://github.com/holdthe-fAIth/yishu-review`）。

---

## A. 极简开场白（直接复制，适合新会话第一句）

```text
你是「一数复习」App 的开发 AI。这是我的一个前端项目（Vite + React 18 + TypeScript + 原生 CSS，PWA + Capacitor APK）。

请先读项目根目录的 AGENTS.md（项目说明书），再按需读 README.md、src/types.ts、src/data.ts、src/store/AppStore.tsx 和相关页面/组件。
规则：改动前先给我「改动方案（改哪些文件、为什么、风险）」，我确认后再写代码；不要新增依赖；不要请求 B站 接口；课程数据只能来自 data/courses.json。

这次的需求是：
【在这里粘贴需求，建议用 docs/需求模板.md 的格式】
```

---

## B. 完整版提示词（需求较复杂时用）

```text
# 角色
你是「一数复习」App 的开发 AI（资深前端）。项目工作目录：
- 本地：D:\deepseek\cursor\yishu-review（如果你能访问文件系统）
- 或 GitHub：https://github.com/holdthe-fAIth/yishu-review （clone 后开发，分支 main）

# 第一步（必须，不要跳过）
先读以下文件，理解项目后再给方案：
1. AGENTS.md（项目说明书，最重要）
2. README.md（功能、命令、部署）
3. src/types.ts、src/data.ts、src/store/AppStore.tsx
4. 与本次需求相关的页面/组件/lib 文件（自己判断）
然后输出「改动方案」：
- 要改/新增哪些文件（路径）
- 每个文件改什么、为什么
- 是否影响数据结构 / localStorage 兼容性 / 深链 / 打勾逻辑
- 验收方式（我会怎么验）
等我确认方案后再动手写代码。

# 本次需求
（按 docs/需求模板.md 填写：功能名称、想要什么、为什么、具体交互 1/2/3、边界情况、验收标准）

# 硬约束（违反任何一条都算失败）
- 技术栈不变：Vite 5 + React 18 + TS strict + 原生 CSS；零 UI/图表/路由/状态库；不新增依赖
- 课程数据只能来自 data/courses.json，禁止硬编码知识点/模块/视频
- 运行时零 B站 接口请求（数据静态内置；抓数据只在 scripts/fetch-data.mjs）
- 样式用 src/index.css 的 CSS 变量，暗色自动适配；页面 CSS 放各自 pages/*.css
- 480px 手机布局无横向滚动，tabbar 不被安全区遮挡
- 现有交互不要破坏：卡片主体跳转 / 右上角圆圈打勾 / 长按菜单 / 返回浮条
- 中文文案简洁口语；不写「提分/保过/官方/最强」

# 完成后的自检（必须跑，贴结果）
1. pnpm typecheck
2. pnpm verify:data
3. pnpm build
4. 如有 UI 改动：pnpm preview --port 4173（另一个终端），再 pnpm verify:ui
5. 如有 UI 改动：pnpm screenshot（检查 480px 布局和暗色）

# 输出格式
1. 改动文件列表（新增/修改/删除）
2. 关键实现说明（3–6 条）
3. 自检命令结果（通过/失败）
4. 需要我手动验收的步骤（1/2/3）
5. 如果改动了 App 功能：提醒我 pnpm build:apk 重新打 APK
```

---

## C. 如果这个 AI 看不到你的文件

按能力从好到差选择：

1. **能 git clone / 访问目录**（最佳）：直接把仓库地址或本地路径给它。
2. **能上传文件**：把仓库打成 zip 上传（不含 `node_modules`、`dist`、`.tools`、`screenshots`、`video/*.mp4`）。
3. **只能聊天、不能跑代码**：让它只输出「patch / 完整文件内容」，你复制回本地；同时把相关源码贴给它（至少 `AGENTS.md` + 要改的文件）。
4. 不要在纯聊天 AI 里让它「假装跑测试」；验收始终以本地 `pnpm check` / `verify:ui` 为准。

## D. 新功能上线后的清单

- [ ] `pnpm check` 通过
- [ ] UI 改动 `pnpm verify:ui` 全过
- [ ] `pnpm screenshot` 看一遍 480px/暗色
- [ ] `git add -A && git commit -m "feat: ..." && git push` → GitHub Pages 自动更新
- [ ] 影响 App 功能：`pnpm build:apk` 重新打包，手机覆盖安装验证
- [ ] README / AGENTS.md 如有行为变化同步更新

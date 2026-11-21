# AGENTS.md · 「数理复习」项目说明书

> 给**任何接手本项目的 AI / 开发者**：先读这个文件，再动手。它包含项目结构、核心机制、开发命令、验收方式、发布流程和踩过的坑。
> 项目不依赖任何特定 AI 或对话——仓库是唯一事实来源。换电脑、换 AI、开新会话，读完这份 + README + 相关源码即可继续开发。

---

## 1. 项目是什么

- **名称**：数理复习（v3.1.0）
- **定位**：把 B站 UP 主「一数」（数学，mid `14229967`）和「黄夫人」（物理，mid `23630128`）的高中视频，整理成「知识体系 + 打勾进度本」的 App；**不是播放器**，App 内不放视频。
- **核心循环**：选科目 → 点知识点 → 深链唤起 B站 App 播放对应视频 → 看完切回 → 浮条「看完了？」→ 一键打勾 → 卡片/模块/科目进度/学习日历联动。
- **线上**：<https://holdthe-faith.github.io/yishu-review/>（GitHub Pages，自动部署）
- **仓库**：<https://github.com/holdthe-fAIth/yishu-review>
- **形态**：PWA（可安装、可离线）+ Android APK（Capacitor 6，debug 签名，`pnpm build:apk` 打包）

## 2. 技术栈（不要随意更换/加依赖）

- Vite 5 + React 18 + TypeScript + **原生 CSS**（CSS 变量主题）
- `vite-plugin-pwa`：PWA / 离线 / 运行时封面缓存
- Capacitor 6 + `@capacitor/app` + `@capacitor/app-launcher`：APK / 原生深链 / 前后台监听
- **零** UI 组件库、图表库、路由库、状态管理库、请求库
- 数据：`data/courses.json`（v3 多科目，静态 import，**运行时不请求 B站 接口**）
- 持久化：`localStorage` 单 key（读写全部收口在 `src/store/AppStore.tsx`）

## 3. 目录速览

```
data/courses.json          # v3 多科目：数学 24 模块/194 知识点 + 7 合集/320 视频
                           #            物理 36 模块/444 知识点 + 2 合集/89 视频（含发布时间）
public/data/courses.json   # 构建时由 data 复制（同源内容更新用，git 忽略）
src/
├─ data.ts                 # 多科目接入 / 派生结构 / key / 远程覆盖 / 主题色
├─ types.ts                # 所有类型（科目/课程数据/State/Settings/PlayTarget）
├─ config.ts               # APP_VERSION、默认更新源、阈值常量
├─ store/AppStore.tsx      # useReducer + Context + localStorage（唯一状态入口 + 旧 key 迁移）
├─ lib/
│  ├─ bilibili.ts          # 深链 / intent / APK AppLauncher / 跳转诊断 / PAGE_OFFSET
│  ├─ jump.tsx             # 跳转 + pending + 确认弹窗
│  ├─ updates.ts           # 检查内容更新 / 应用远程数据
│  ├─ history.ts           # 学习日历 / 每日记录 / 热力统计（带科目）
│  ├─ sort.ts              # 已学内容排到最后（按科目 key）
│  ├─ progress.ts          # 科目/模块进度、连续打卡
│  └─ format.ts            # 时长/日期/百分比格式化
├─ components/             # SubjectSwitch/Cover/ProgressRing/CheckButton/Sheet/Toast/TabBar/ReturnPromptBar/UpdateBanner/Icons/Segmented/LevelTag
├─ pages/                  # CoursePage / KnowledgePage / MinePage / SearchPage（各自 CSS）
├─ App.tsx                 # 3 tab 壳 + Providers（按科目 key 重挂载课程/知识体系页）
├─ index.css               # 设计 token + 全局/共享组件样式（暗色变量）
└─ main.tsx                # 入口（浏览器注册 SW；APK 内跳过）
scripts/                   # 数据抓取/校验、e2e、截图、APK 打包、图标生成
android/                   # Capacitor Android 工程（build/ 等已 gitignore）
.github/workflows/         # deploy-pages.yml（Pages 部署）、refresh-data.yml（每周刷数据）、verify.yml（CI 检查）
```

## 4. 开发命令

```bash
pnpm install
pnpm dev                 # 开发（局域网可手机真机调试）
pnpm typecheck           # tsc --noEmit（strict + noUnusedLocals/Parameters）
pnpm verify:data         # 双科目数据校验（数学 194 / 物理 444 / 合集 / 发布时间 / key 唯一）
pnpm build               # 复制数据 + tsc + vite build（PWA 产物）
pnpm check               # copy-data + tsc + verify:data + vite build（提交前一键）
pnpm preview             # 预览 dist
# UI 功能验收（需要先起 preview，且本机有 Edge）：
pnpm preview --port 4173
pnpm verify:ui           # Edge headless 100 项功能验收（CDP 脚本 scripts/e2e-check.mjs）
pnpm screenshot          # 480×900@2x + 1024×768 平板视觉验收图 → screenshots/
pnpm fetch:data          # 从 B站 刷新数学数据（仅开发/CI；保留物理）
pnpm fetch:physics       # 从 B站 刷新黄夫人物理数据（仅开发/CI；保留数学）
pnpm build:apk           # 打 Android APK（需要 .tools 便携 JDK/SDK，见 README）
```

## 5. 核心机制（改代码前必须知道）

1. **深链（B站）**：`src/lib/bilibili.ts`
   - 数学：`bilibili://video/{bvid}?page={p}`（同一 BV 下按分P）；物理/专题：`bilibili://video/{bvid}`（独立 BV，不带 page）。
   - Android 浏览器/PWA：`intent://…browser_fallback_url=…`；iOS：scheme → 1.2s 兜底；桌面：新标签页网页版。
   - **APK**：`@capacitor/app-launcher` 的 `canOpenUrl()` 只接受**包名**（内部 `getPackageInfo`），不能传 URL；必须直接 `openUrl(deep)` 并按返回的 `completed` 判断，失败再降级。详细见文件注释与「跳转诊断」。
   - `PAGE_OFFSET` 是分P起算点唯一校准点（默认 0；真机若 0 基改 -1，只影响数学分P）。
2. **pending + 返回浮条**：跳转前写 `pending{key,name,at}`；`ReturnPromptBar` 监听 `visibilitychange/focus/pageshow`（APK 加 `appStateChange`），离开 ≥30s 弹浮条；打勾/忽略都会清 pending。
3. **本地状态**：`yishu-review:state:v1`（唯一 key）；`done` 的 key：数学系统课 `math:s:{p}`、物理系统课 `physics:s:{bvid}`、专题 `${subjectId}:t:{seasonId}:{bvid}`；`at` 是完成时间（学习日历用）。`settings.activeSubject` 记住当前科目。旧 `s:` / `t:` 会在 `normalizeState` 里自动迁移为 `math:`，导入旧 JSON 也兼容。所有进度/进度条/连续打卡都是派生态，不落库。
4. **内容更新**：`src/lib/updates.ts`。PWA 默认拉同源 `data/courses.json`；APK 默认拉 `src/config.ts` 里的 Pages 数据地址（`raw.githubusercontent.com` 国内不可用）。远程数据校验通过后写入 `localStorage` 的 `yishu-review:courses:v3` 并刷新；旧 `:v2` 覆盖会被清掉，回退内置 v3；「恢复内置数据」清除覆盖。
5. **学习日历**：`src/lib/history.ts`（月历网格、按天记录、热力统计），记录带 `math` / `physics` 科目标签。
6. **已学排后**：`src/lib/sort.ts`，由设置 `sortCompletedLast` 控制；学完的模块排到列表末尾后由 `CoursePage` 自动收起（只处理「未完成 → 完成」的瞬间，手动展开不误关）。
7. **进度展示**：课程页只保留紧凑「继续复习」入口，不显示总进度卡；知识体系页保留当前科目的总进度大环。
8. **响应式布局**：手机 480px 为单列底部 tab；≥720px 放宽框架、卡片 3 列；≥900×600 横屏时底部 tab 变左侧导航栏、内容 1120px、卡片最多 4 列。相关规则在 `src/index.css` 和各页面 CSS 的 media query 里。
9. **发布**：`git push origin main` → GitHub Actions 自动部署 Pages（工作流里 `VITE_BASE=/仓库名/`）；APK 用 `pnpm build:apk`。

## 6. 代码约定

- TypeScript strict + `noUnusedLocals`/`noUnusedParameters` 必须通过；不要新增 `any` 滥用。
- 样式只用 `src/index.css` 里的 CSS 变量（`--card/--text/--text-2/--line/--pink/--bg/--radius/--shadow` 等），保证暗色自动适配；页面样式放各自 `pages/*.css`。
- 纯逻辑放 `src/lib`，纯 UI 放 `src/components`，页面只做组合与交互。
- **不要新增依赖**（尤其 UI/图表/路由/请求库）；确需新增先在需求里说明理由。
- 课程数据只来自 `data/courses.json`，**绝不硬编码**知识点/模块/视频；科目数据通过 `getSubject()` / `SUBJECT_VIEWS` 读取，不要在页面里写死数学或物理。
- 运行时**不请求任何 B站 接口**；抓数据只允许在 `scripts/fetch-data.mjs` / `scripts/fetch-physics.mjs`。
- 中文文案保持简洁口语；不写「提分/保过/官方/最强」等承诺。
- 现有 3 个 tab 的交互约定（卡片主体跳转 / 右上角圆圈打勾 / 长按菜单）不要破坏；科目切换是课程页/知识体系页的一级切换。

## 7. 加一个新功能的标准流程（7 步）

1. **写需求**：复制 `docs/需求模板.md`，把「想要什么 / 为什么 / 具体交互 / 验收标准」写清楚。
2. **拉最新代码**：`git pull origin main`；新环境先 `git clone`。
3. **让 AI 先出方案**：新会话把 `docs/AI-改功能提示词模板.md` + 需求发给它，要求「先读 AGENTS.md / README / 相关源码，先给改动方案，不要直接写代码」。
4. **小步实现**：只改必要文件；保持现有接口与行为；涉及数据结构先改 `types.ts` 并保持向后兼容。
5. **本地验证**：`pnpm check`；UI 改动再 `pnpm preview` + `pnpm verify:ui`；必要时 `pnpm screenshot` 检查 480px 布局/暗色。
6. **验收**：对照需求逐条自查；确认无 console 报错、无横向滚动、tabbar 不被安全区遮挡。
7. **发布**：`git add -A && git commit -m "feat: ..." && git push`（线上自动部署）；**只要影响 App 功能，重新 `pnpm build:apk`** 并安装验证；数据改动用对应 fetch 脚本并跑 `pnpm verify:data`。

> 建议：**一个功能 = 一个新会话/一个新分支**，不要把所有功能堆在同一个长对话里。

## 8. 常见坑（都踩过）

- PowerShell 5.1 读无 BOM 的 `.ps1` 中文会乱码/解析失败 → 脚本内容用 ASCII，或存 UTF-8 with BOM。
- `pnpm` 与 `npm` 不要混用；仓库带 `pnpm-lock.yaml`，CI 用 pnpm 9。某些环境 `npm.ps1` 被执行策略拦截 → 用 `npm.cmd`。
- GitHub Pages 部署是**子路径**：必须 `VITE_BASE=/仓库名/`（`deploy-pages.yml` 已处理）；本地构建默认根路径。
- `raw.githubusercontent.com` 在国内常不可达 → 默认内容更新源用 GitHub Pages 地址。
- APK 深链：`canOpenUrl` 只能传包名；Android 11+ 需要 `AndroidManifest.xml` 的 `<queries>`（已配 tv.danmaku.bili / HD / 国际版 + bilibili scheme）。
- PWA 的 SW 注册改成手写（不 import `virtual:pwa-register`），避免 GitHub Actions 缺 `workbox-window` 构建失败。
- 物理知识点是独立 BV、没有分P：`SystemItem.p` 可省略，key 用 `physics:s:{bvid}`；不要给物理视频强行加 `?page=`。
- 旧数学 key 迁移在 `normalizeState` 完成；改 key 规则时必须继续兼容 `s:` / `t:`。
- `public/data/`、`android/build/`、`screenshots/`、`.tools/` 都是生成物，已 gitignore，不要提交。

## 9. 验收清单（提交/交付前自查）

- [ ] `pnpm check` 通过（tsc + 双科目数据校验 + build）
- [ ] 数学 194 个知识点一个不少，物理 444 个知识点一个不少，模块顺序与 `data/courses.json` 一致
- [ ] 数学卡片带正确 `page`；物理卡片带自己的 BV 且没有错误 `page`
- [ ] 旧 `s:` / `t:` 进度迁移为 `math:` 后不丢；数学/物理切换后互不污染
- [ ] 课程页不显示总进度卡，知识体系页总进度正常
- [ ] 从 B站 切回弹「看完了？」浮条，打勾后四处进度同步
- [ ] 刷新/重开数据不丢；导出/导入/重置正常
- [ ] 480px 无横向滚动、tabbar 安全区正常、暗色正常
- [ ] 平板 1024×768：左侧导航栏、内容不横向滚动、课程卡片 3 列；1280×800：4 列
- [ ] UI 改动：`pnpm verify:ui` 全过（本机 Edge）
- [ ] README / 版本号 / 验收记录同步更新

## 10. 发布与版本

- 版本号：`package.json`、`src/config.ts`（`APP_VERSION`）、`android/app/build.gradle`（versionCode/versionName）保持一致。
- 线上：push `main` 自动部署 Pages（约 1–2 分钟）。
- APK：`pnpm build:apk` → `yishu-review-x.y.z-debug.apk`（同 debug 签名可覆盖安装，进度保留）。
- 数据：`pnpm fetch:data` 更新数学、`pnpm fetch:physics` 更新物理（都会写入 `data/courses.json` 和 `public/data/`）；`refresh-data.yml` 也支持每周自动刷新。
- 提交信息用 `feat/fix/docs/chore/refactor` 前缀，一条 commit 一件事。

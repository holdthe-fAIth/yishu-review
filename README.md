# 一数复习 · 高中数学知识体系（A 版 · 目录型）

> B 站风格的「一数」高中数学视频**复习进度本**：点知识点 → 深链跳 B站 App 播放对应那一集（带分P）→ 看完切回来 → 底部浮条一键打勾 → 卡片点亮、模块进度与总进度实时联动。
>
> **这不是播放器**：App 自己不放视频，只当「知识体系 + 打勾进度本」。没有 iframe、没有解析、没有第三方接口。

- 数据：`data/courses.json`（静态 import）—— 一数（B站 mid `14229967`）系统课 **24 个模块 / 194 个知识点**（都在合集 `BV147411K7xu` 下，1 个知识点 = 1 个分P）+ **6 个专题合集 / 134 条独立视频**
- 技术栈：**Vite 5 + React 18 + TypeScript + 原生 CSS（CSS 变量主题）**，零 UI 库、零图表库
- 安装形态：**PWA**（手机桌面安装 + 离线打开），可平滑升级 Capacitor APK
- 数据全部在本地 `localStorage`，无后端、无登录、无云同步

---

## 快速开始

```bash
# 1. 安装依赖（仓库带 pnpm-lock.yaml，推荐 pnpm；没有 pnpm 时用 npm run 等价命令）
pnpm install        # 或 npm install

# 2. 开发（手机同一 WiFi 下可用局域网 IP 访问，便于真机联调深链）
pnpm dev            # 或 npm run dev

# 3. 类型检查 / 生产构建
pnpm typecheck      # tsc --noEmit
pnpm build          # tsc --noEmit && vite build
pnpm preview        # 预览 dist（默认 http://localhost:4173）

# 4. 课程数据完整性校验（194 个知识点 / 24 模块 / 6 专题 134 视频 / 分P唯一）
pnpm verify:data    # 或 node scripts/verify-data.mjs

# 5. 重新生成 PWA 图标（需要 Python + Pillow）
python scripts/generate-icons.py
```

> 本机若 `pnpm` 未在 PATH，可用 npm 等价命令 `npm run dev` / `npm run build`，脚本完全相同。

### 自动化验收（可选，需要本机 Edge 浏览器）

```bash
pnpm build
pnpm preview --port 4173      # 终端 1：先起预览服务
node scripts/e2e-check.mjs    # 终端 2：49 项功能验收（数据/打勾/深链/pending/浮条/搜索/PWA 离线）
node scripts/screenshot.mjs   # 终端 2：生成 screenshots/*.png 视觉验收图（480×900@2x）
```

两个脚本都是零第三方依赖的 Edge headless + CDP 自动化，不影响 App 运行时依赖。

---

## 部署 PWA

1. `pnpm build` 得到 `dist/`（内含 `manifest.webmanifest`、`sw.js`、192/512 图标）。
2. 把 `dist/` 整个目录部署到任意静态服务器 / Nginx / GitHub Pages / Vercel / Netlify。
   - **必须 HTTPS**（`localhost` 除外），否则 Service Worker 不生效、不能安装。
   - 部署到**子路径**（如 `https://example.com/yishu-review/`）时，把 `vite.config.ts` 的 `base` 改成 `/yishu-review/` 后重新 build。
3. 手机浏览器打开 → 菜单「添加到主屏幕/安装应用」→ 桌面图标启动（standalone 全屏、适配刘海和底部手势条）。
4. 离线：首次打开后核心资源与已浏览的 B站封面会被 Service Worker 缓存，断网也能打开并看进度（封面首次未缓存时用渐变兜底）。

---

## 功能清单

### 页面 1 · 课程（首页）
- 顶部大标题「一数复习」+ 右上角搜索入口。
- Hero 卡：194 个知识点总进度圆环 +「继续复习」按钮（自动跳到按模块顺序第一个没打勾的知识点）。
- Segmented 切换「系统课 / 专题课」。
- 系统课：24 个模块折叠分组（顺序 = 复习顺序，不重排）。模块行 = 模块名 + `3/6` + 4px 粉色细进度条；展开后 2 列卡片。
  - 卡片封面：系统课没有封面图，用**模块主题色渐变 + 模块名首字**实时生成（不抓 B站封面）。
  - 卡片 = 封面 + 时长角标 + 标题 2 行省略 + 难度标签。
- 专题课：顶部横滑 6 个合集 tab + 2 列真实封面卡片。

### 卡片交互（A 版关键）
- **点卡片主体** → 深链跳 B站 App，同时记录一条 `pending`。
- **点封面右上角小圆圈 ✓** → 就地打勾 / 取消，**不跳转**（独立热区，互不抢事件）。
- **长按 500ms（桌面右键）** → 操作菜单：标记完成 / 取消完成 / 复制 BV 号 / 在浏览器打开。
- 已完成状态：右上角 18px 粉色圆 + 白勾、标题变灰 `#9499A0`、卡片底部一条满格粉色进度线。

### 页面 2 · 知识体系
- 顶部大进度环 +「已完成 X / 194 个知识点 · 约 Y 小时」。
- 24 个模块列表：24px SVG 小圆环 + 模块名 + 已看/总数 + 展开箭头。
- 展开显示知识点 chip：已点亮 = 粉底白字 + ✓，未点亮 = 灰边框；点 chip 直接跳 B站。
- 底部「最弱模块」：完成率最低 3 个，建议先复习。

### 页面 3 · 我的
- 统计：已看视频数 / 累计视频时长 / 连续打卡天数。
- 24 个模块完成率横向条形图（纯 CSS，无图表库）。
- 数据管理：导出 JSON / 导入 JSON / 重置（二次确认）。
- 设置：跳转前是否确认、是否开启返回打勾提醒、主题（浅色 / 深色 / 跟随系统）。

### 搜索（首页右上角）
- 跨系统课 194 个知识点 + 专题 134 条视频搜索，支持难度筛选（全部 / 基础 / 中档 / 拔高）。
- 结果行内也能直接打勾，不跳转。

---

## 核心机制

### 1）B站深链（带分P）

```ts
// 系统课：同一个 BV 下 194 个分P，必须带 page，否则永远打开第一集
bilibili://video/BV147411K7xu?page={p}
// 专题课：独立 BV 号，不带 page
bilibili://video/{bvid}
```

网页端按 UA 分流（`src/lib/bilibili.ts`）：

- **Android**：`intent://video/{bvid}?page={p}#Intent;scheme=bilibili;package=tv.danmaku.bili;S.browser_fallback_url={webUrl};end`
  （未安装 App 时自动回退到网页版）
- **iOS / HarmonyOS**：先试 `bilibili://` scheme，1.2s 内没切走则回退网页版
- **桌面浏览器**：直接新标签页打开网页版（方便验收 `?p=` 参数）
- **Capacitor APK**：改 `@capacitor/app-launcher`（见文末）

> ⚠️ **分P 起算点校准（PAGE_OFFSET）**：数据里的 `p` 从 1 开始。
> 拿真机点 `page=1` 和 `page=2` 各一次，确认打开的分别是第几集：
> - `page=1` 是第一集 → 保持 `PAGE_OFFSET = 0`（默认）
> - `page=0` 是第一集 → 把 `src/lib/bilibili.ts` 的 `PAGE_OFFSET` 改成 `-1`
>
> 全站只有这一个常量，改一处生效。验收时至少用 3 个不同模块的知识点确认 `page` 正确。

### 2）跳转 → 回来打勾（A 版灵魂）

1. 跳转前把 `{ key, name, at }` 写入 `localStorage` 的 `pending`（只保留一条）。
2. 从 B站 切回 App / 网页时（`document.visibilitychange`、`focus`、`pageshow`），如果 `pending` 存在且**离开超过 30 秒** → 底部弹出浮条：
   「看完了《集合的概念》？ [✓ 打勾] [× 忽略]」
3. 点「打勾」→ 立刻标记完成并清掉 `pending`；点「忽略」→ 只清掉 `pending`。
4. 设置里可关闭「返回打勾提醒」；关闭后回到 App 会静默清掉 `pending`。

> 桌面调试技巧：点一个知识点后切到别的标签页停留 30 秒以上再切回来，浮条就会出现。
> 想快速验证可临时把 `src/components/ReturnPromptBar.tsx` 里的 `RETURN_THRESHOLD_MS` 改小。

### 3）本地数据模型（localStorage 单 key：`yishu-review:state:v1`）

```ts
type State = {
  v: 1
  done: Record<string, { at: number }>   // 系统课 key=`s:${p}`；专题 key=`t:${seasonId}:${bvid}`
  pending?: { key: string; name: string; at: number }
  settings: {
    confirmBeforeJump: boolean
    returnPrompt: boolean
    theme: 'light' | 'dark' | 'auto'
  }
}
```

- **派生值不存**，每次实时计算：知识点完成 = `done['s:'+p]`；模块进度 = 已完成 / count；总进度 = /194；连续打卡 = 按 `done.at` 的本地日期去重后从今天（或昨天）往前数。
- 所有读写收口在 `src/store/AppStore.tsx`（`useReducer` + Context + 持久化 effect），组件不直接碰 `localStorage`。
- 导出/导入使用同一份 JSON 结构，导入前会 `normalizeState()` 校验并二次确认。

---

## 项目结构

```
yishu-review/
├─ data/courses.json          # 课程数据（静态 import，运行时零请求）
├─ docs/A版-目录型.md          # 原始需求提示词（备查）
├─ public/
│  ├─ favicon.svg
│  └─ icons/                  # PWA 图标 192/512/maskable/apple-touch
├─ scripts/
│  ├─ verify-data.mjs         # 数据完整性校验（194/24/6/134、分P唯一）
│  └─ generate-icons.py       # 图标生成（Pillow）
├─ src/
│  ├─ data.ts                 # 数据接入 + 派生（模块渐变/拍平/时长索引）
│  ├─ types.ts                # 数据结构与 State 类型
│  ├─ store/AppStore.tsx      # useReducer + Context + localStorage 持久化
│  ├─ lib/
│  │  ├─ bilibili.ts          # 深链 / intent / PAGE_OFFSET / 浏览器兜底
│  │  ├─ jump.tsx             # 跳转 + pending + 确认弹窗
│  │  ├─ progress.ts          # 模块/总进度、最弱模块、连续打卡等派生
│  │  └─ format.ts            # 时长/日期/百分比格式化
│  ├─ components/             # ProgressRing / CheckButton / Cover / Sheet / Toast / TabBar / ReturnPromptBar / Icons / Segmented / LevelTag
│  ├─ pages/                  # CoursePage / KnowledgePage / MinePage / SearchPage（各自 CSS）
│  ├─ App.tsx                 # 3 tab 壳 + 全局 Provider
│  ├─ index.css               # 设计 token + 全局/共享组件样式（暗色变量）
│  └─ main.tsx
├─ index.html
├─ vite.config.ts             # vite-plugin-pwa（manifest / 离线缓存 / 封面运行时缓存）
└─ tsconfig.json
```

---

## 分阶段完成情况（对应提示词 Phase 0–6）

| Phase | 内容 | 状态 |
| --- | --- | --- |
| 0 | Vite+React+TS 骨架、3 页面 + tabbar + 主题变量 + 空态 | ✅ |
| 1 | 接入 courses.json，首页 24 模块 / 194 知识点 + 6 专题 134 条 | ✅ |
| 2 | store + 持久化 + 勾选态 + 模块/总进度 rollup + 导出导入重置 | ✅ |
| 3 | 深链 + page 参数 + pending + 返回浮条一键打勾（A 版核心） | ✅ |
| 4 | 知识体系页：进度环 + chip + 点击跳转 + 最弱模块 | ✅ |
| 5 | 「我的」+ 搜索 + 难度筛选 + 暗色模式 | ✅ |
| 6 | PWA（vite-plugin-pwa + manifest + 192/512 图标，可安装、可离线） | ✅ |
| 6+ | Capacitor 打包 APK | ⏳ 可选（本机无 Android SDK，只交 PWA + 构建说明） |

## 验收自查清单

- [x] `tsc --noEmit` 与 `vite build` 通过，无 console 报错
- [x] 194 个知识点一个不少，模块顺序与 `courses.json` 一致（`pnpm verify:data` 校验）
- [x] 点卡片跳 B站 能到对应那一集（page 参数正确，至少验 3 个不同模块的 page 值）
- [x] 勾选不跳转、跳转不误触（卡身 / 右上角圆圈两个热区分开）
- [x] 从 B站 回来能弹「看完了？」浮条并一键打勾
- [x] 勾一个知识点 → 卡片、模块进度、知识体系页、总进度环四处同时变
- [x] 刷新 / 重开浏览器数据不丢（localStorage 单 key）
- [x] 480px 下无横向滚动，tabbar 不被安全区挡住（`env(safe-area-inset-*)`）
- [x] 能装到手机桌面（PWA）并离线打开
- [x] README 写明：怎么 dev、怎么 build、怎么部署 PWA、怎么导出导入数据

### 自动化验收结果（本机实测）

- `pnpm typecheck` → 通过（strict + noUnusedLocals/noUnusedParameters，退出码 0）
- `pnpm build` → 通过（tsc + vite build + PWA 产物，56 modules，precache 16 entries）
- `pnpm verify:data` → 17 项数据校验全部通过（24 模块 / 194 知识点 / 6 专题 / 134 视频 / 分P 唯一）
- `node scripts/e2e-check.mjs` → **49 项功能验收全部通过，0 失败**，覆盖：480px 无横滚、模块顺序、打勾热区、深链 `?p=` 参数、pending、30s 返回浮条、刷新持久化、知识体系 chip、专题课、搜索与难度筛选、我的页统计、主题切换、重置二次确认、194 张卡片、PWA manifest/SW、**离线打开**、**运行时零 B站 接口请求**、无 console 报错
- `node scripts/screenshot.mjs` → 生成 10 张 480×900@2x 视觉验收图（`screenshots/`，含浅色/深色/返回浮条/搜索/专题课）

---

## 可选升级：Capacitor 打包 APK

```bash
pnpm add @capacitor/core @capacitor/cli @capacitor/app @capacitor/app-launcher
npx cap init 一数复习 com.yishu.review --web-dir=dist
npx cap add android
pnpm build && npx cap sync android
```

`src/lib/bilibili.ts` 中把 `openInBilibili()` 的移动端分支替换为：

```ts
import { AppLauncher } from '@capacitor/app-launcher'

const { value } = await AppLauncher.canOpenUrl({ url: deep })
if (value) await AppLauncher.openUrl({ url: deep })
else window.open(web, '_system')
```

Android 11+ 必须在 `android/app/src/main/AndroidManifest.xml` 增加包可见性，否则 `canOpenUrl` 永远 `false`（表现为点了没反应）：

```xml
<queries>
  <package android:name="tv.danmaku.bili" />
  <intent>
    <action android:name="android.intent.action.VIEW" />
    <data android:scheme="bilibili" />
  </intent>
</queries>
```

`@capacitor/app` 的 `appStateChange` 可以替换 web 的 `visibilitychange`（`ReturnPromptBar` 里判断逻辑不变）。

> 之后的升级路径：想加「边看边打勾」的内嵌播放器，用 B 版提示词在**同一个项目**里继续，只加一个播放页即可，A 版的卡片、进度、知识体系全部复用。

---

## 常见问题

| 现象 | 排查 |
| --- | --- |
| 点卡片没反应 | 桌面端会新开标签页打网页版，检查弹窗拦截；手机端确认已安装 B站 App；Android 11+ 检查包可见性（仅 Capacitor） |
| 跳到 B站 但集数不对 | 校准 `PAGE_OFFSET`（见上），并用 3 个不同模块验收 |
| 切回 App 没弹浮条 | 需离开 ≥30 秒且设置里「返回打勾提醒」开启；Safari 后台标签可能不触发 visibilitychange，用 focus 兜底 |
| 封面不显示 | 首次加载需要网络；B站图床对部分网络不可达时自动退化为渐变封面。离线时仅缓存过的封面可见 |
| PWA 无法安装 | 必须 HTTPS（或 localhost），且浏览器支持 Service Worker |
| 数据丢了 | 检查是否清过站点数据 / 无痕模式；可在「我的 → 数据管理」里定期导出 JSON 备份 |

---

## 依赖说明（刻意保持极简）

- 运行时：`react`、`react-dom`
- 开发/构建：`vite`、`@vitejs/plugin-react`、`typescript`、`vite-plugin-pwa`
- 无 UI 组件库、无路由库、无状态管理库、无图表库、无请求库。

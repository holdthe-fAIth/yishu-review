# 一数复习 · 高中数学知识体系（v2）

> B 站风格的「一数」高中数学视频**复习进度本**：点知识点 → 深链跳 B站 App 播放对应那一集（带分P）→ 看完切回来 → 底部浮条一键打勾 → 卡片点亮、模块进度与总进度实时联动。
>
> **这不是播放器**：App 自己不放视频，只当「知识体系 + 打勾进度本」。没有 iframe、没有解析、没有第三方接口。

- 数据：`data/courses.json`（静态 import，**运行时不请求 B站接口**）—— 一数（B站 mid `14229967`）系统课 **24 个模块 / 194 个知识点**（合集 `BV147411K7xu` 的 198 个分P，1 知识点 = 1 分P）+ **7 个专题合集 / 320 条独立视频**
- 每条视频都带**发布时间**（系统课来自分P `ctime`，专题来自合集接口），卡片左下角显示，老视频（>2 年）黄色提示，方便判断是否适合当前高考趋势
- v2 新增：**学习日历（月历打卡 + 点日期看当天学习内容）/ 内容更新检查（每天自动 + 手动）/ 已学内容自动排到最后 / B站跳转诊断**
- 技术栈：**Vite 5 + React 18 + TypeScript + 原生 CSS（CSS 变量主题）**，零 UI 库、零图表库；PWA + Capacitor Android APK
- 🌐 **线上版（GitHub Pages）**：<https://yiweiima.github.io/yishu-review/> · **GitHub 仓库**：<https://github.com/YiweiiMa/yishu-review>

---

## 快速开始

```bash
pnpm install        # 或 npm install

pnpm dev            # 开发（局域网 IP 可手机真机联调深链）
pnpm build          # tsc + vite build（自动把 data/courses.json 拷贝到 public/data/）
pnpm preview        # 预览 dist → http://localhost:4173

pnpm fetch:data     # 重新抓取一数主页数据（B站接口，仅开发时运行）
pnpm verify:data    # 数据完整性校验（194 知识点 / 7 合集 / 320 视频 / 发布时间齐全）
pnpm check          # 一键：复制数据 + tsc + 数据校验 + build（提交前跑这个）
pnpm verify:ui      # 77 项 Edge headless 功能验收（需先 build + preview）
pnpm screenshot     # 480×900@2x 视觉验收截图 → screenshots/
pnpm build:apk      # 打包 Android APK（需要 .tools 里的 JDK/SDK，见「APK」章节）
```

> 本机没有 `pnpm` 时用 `npm run dev` / `npm run build` 等价；仓库自带 `pnpm-lock.yaml`。

---

## 接手开发：换 AI / 换电脑 / 新会话

这个项目**不依赖某个对话或某个 AI**——仓库就是唯一事实来源，代码、数据、脚本、验收、发布流程都在仓库里。

- **新 AI / 新会话**：先让它读 [AGENTS.md](AGENTS.md)（项目说明书：结构、核心机制、命令、约定、常见坑），再把需求按 [docs/需求模板.md](docs/需求模板.md) 写清楚，粘贴 [docs/AI-改功能提示词模板.md](docs/AI-改功能提示词模板.md) 里的模板即可。
- **每个功能开一个新会话/新分支**，不要把功能都堆在同一个长对话里；上下文不够换会话完全不影响项目。
- **一键自检**：`pnpm check`（tsc + 数据校验 + 构建）；UI 改动再 `pnpm preview` + `pnpm verify:ui`。
- **提交发布**：`git add -A && git commit -m "feat: ..." && git push` → GitHub Actions 自动部署线上；影响 App 功能就重新 `pnpm build:apk`。
- **CI**：`.github/workflows/verify.yml` 在 push/PR 时自动跑类型检查 + 数据校验 + 构建，改坏了会直接标红。

> 一句话：以后加功能不用回到这个对话框——把仓库交给任意一个会写代码的 AI，按上面三个文件走即可。

---

## 一、装到手机

### 1）PWA（推荐日常用，打开即更新）

关键前提：**PWA 安装 / 离线缓存必须 HTTPS**（`localhost` 除外）。

**方式 A：临时 HTTPS 隧道（最快、无账号）**

```bash
# 终端 1
pnpm build && pnpm preview --host
# 终端 2（需要 ssh）
ssh -tt -o StrictHostKeyChecking=no -R 80:localhost:4173 serveo.net
# 输出形如：Forwarding HTTP traffic from https://xxxx.serveousercontent.com
```

手机浏览器打开该 https 地址 →（Serveo 免费隧道首次会显示安全提示，点 **Continue to Site**）→ 菜单「安装应用 / 添加到主屏幕」。隧道是临时的（约 10 分钟寿命），长期使用请用方式 B。

**方式 B：正式部署（推荐长期，见「二、GitHub 上传与部署」）**

部署后手机打开 `https://yiweiima.github.io/yishu-review/` → 安装 PWA。之后每次 push 自动更新，App 内「检查内容更新」可拉取最新课程数据。

**方式 C：同一 WiFi 局域网**：`pnpm dev --host` / `pnpm preview --host`，手机开 `http://<电脑IP>:5173`。非 HTTPS 只能当网页用（不能安装/离线），需放行 Windows 防火墙。

### 2）APK（完全离线，不依赖电脑）

已产出：**`yishu-review-2.1.2-debug.apk`**（项目根目录，约 4 MB）

| 项 | 值 |
| --- | --- |
| 包名 / 版本 | `com.yishu.review` / versionCode 5, versionName **2.1.2** |
| 兼容 | Android 5.1+（minSdk 22，targetSdk 34） |
| 签名 | Android Debug（v1+v2，可安装，不可上架应用商店） |
| 能力 | Web 资源全部内置、断网可用；**点知识点直接唤起 B站 App**（`@capacitor/app-launcher`）；从 B站 切回来弹打勾浮条；支持学习时间表等全部 v2 功能 |

**安装**：电脑微信「文件传输助手」发送 APK → 手机微信打开 → 用其他应用打开 → 安装；首次允许「安装未知来源应用」，小米/华为等可能需临时关闭「纯净模式」。

> v2 APK 与 v1 使用同一台机器生成的 debug 签名，**可直接覆盖安装，原有 localStorage 进度保留**。

**APK 内更新内容**：APK 内置的是打包时快照。**默认更新源已内置**为 GitHub Pages 的数据地址（带 `CORS: *`），App 每天自动检查一次，也可以在「我的 → 检查内容更新」手动拉取——不用重装 APK 就能更新课程数据；只有功能更新才需要重新打包。默认地址：

```text
https://yiweiima.github.io/yishu-review/data/courses.json
# 备用镜像（Pages 打不开时）：https://cdn.jsdelivr.net/gh/YiweiiMa/yishu-review@main/data/courses.json
```

> 注：`raw.githubusercontent.com` 在国内经常无法访问，所以不用它做更新源。

**重新打包**：

```bash
pnpm build:apk   # = scripts/build-apk.ps1：vite build → cap sync → gradlew assembleDebug → 复制到根目录
```
首次打包需要 JDK 17 + Android SDK（本项目用便携版放在 `.tools/`，已被 gitignore）：
- JDK：<https://aka.ms/download-jdk/microsoft-jdk-17.0.13-windows-x64.zip> 解压到 `.tools/jdk/`
- Android cmdline-tools：<https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip> 解压到 `.tools/android-sdk/cmdline-tools/latest/`
- 然后 `sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"`

---

## 二、GitHub 上传与部署（PWA 永久在线）

> 前提：有 GitHub 账号；仓库建议设为 **Public**（私有仓库的 Pages 需要付费）。

```bash
# 0. 在 GitHub 网页上新建一个空仓库，例如 yishu-review
#    （不要勾选 Add README / .gitignore，直接 Create repository）

cd D:\deepseek\cursor\yishu-review
git branch -M main                      # 统一用 main 分支
git remote add origin https://github.com/YiweiiMa/yishu-review.git
git push -u origin main
```

推送后：

1. 打开仓库 **Settings → Pages → Build and deployment**；
2. **Source** 选择 **GitHub Actions**；
3. 仓库自带的 [.github/workflows/deploy-pages.yml](.github/workflows/deploy-pages.yml) 会在每次 push main 时自动构建并部署（约 1–2 分钟）；
4. 部署完成后地址是：`https://yiweiima.github.io/yishu-review/`（Actions 页面 / Pages 设置页会显示）。

手机打开该地址 → 安装 PWA。**每次 `git push` 后线上自动更新**；App 打开时 Service Worker 自动更新版本。

### 定时更新课程数据（可选）

仓库自带 [.github/workflows/refresh-data.yml](.github/workflows/refresh-data.yml)：

- 每周一 10:00（北京时间）自动运行 `pnpm fetch:data`，把 B站 最新视频写回 `data/courses.json` 并提交；
- 也可以在 GitHub → Actions → Refresh course data → Run workflow 手动触发；
- 若 GitHub 服务器访问 B站 接口被风控，可只在本地运行 `pnpm fetch:data` 后手动提交（效果相同）；
- 提交后 Pages 会自动重新部署，App 内「检查内容更新」即可拿到新数据。

### 用 SSH 推送（可选）

```bash
git remote set-url origin git@github.com:YiweiiMa/yishu-review.git
git push -u origin main
```

### 只想让别人也能安装（不部署 PWA）

也可以只把 `data/courses.json` 放到 GitHub，作为 APK 的「内容更新源」；或把 `dist/` 上传到任意 HTTPS 静态托管（Cloudflare Pages / Vercel / Netlify）。

---

## 三、功能清单（v2）

### 页面 1 · 课程
- Hero：194 个知识点总进度圆环 +「继续复习」（按模块顺序第一个未打勾）+「内容更新于 YYYY-MM-DD」。
- Segmented：系统课 / 专题课。
- 系统课：24 个模块折叠分组；模块行 = 模块名 + `3/6` + 4px 粉色进度条；展开 2 列卡片。
  - 卡片：模块渐变自绘封面 + 时长 + **发布时间角标（左下角，老视频黄色）** + 标题 2 行 + 难度标签。
  - **已学内容自动排到最后**：完全学完的模块移到列表末尾并自动收起；模块内已打勾的知识点移到本模块末尾（设置可关）。
- 专题课：**7 个合集**横滑 tab（按最新发布时间排序），320 条真实封面卡片；合集内已看视频自动排后，全部刷完的合集 tab 排到最后。
  - 教辅类「一本书 / 100 讲」是单个多P视频，封面角标显示「**N 讲**」而不是几百小时的总时长。
  - **点卡片主体** → 记录 pending + 深链跳 B站 App；**点右上角圆圈** → 就地打勾不跳转；**长按/右键** → 菜单（标记完成、复制 BV、浏览器打开）。
  - 已完成：粉色圆 + 白勾、标题变灰、底部满格粉线。

### 页面 2 · 知识体系
- 顶部大进度环 +「已完成 X / 194 · 约 Y 小时」。
- 24 个模块列表：24px 小环 + 名称 + 已看/总数 + 展开箭头；展开显示知识点 chip（已点亮粉底白字 ✓）。
- **已学模块 / 知识点自动排到最后**；点 chip 直接跳 B站。
- ~~最弱模块~~（v2 已按需求移除）。

### 页面 3 · 我的
- 统计：已看视频数 / 累计时长 / 连续打卡天数。
- **学习日历**：月历形式（可切换月份），有学习的日期会点亮（颜色越深完成越多，今天有描边）；**点某一天**即可在下方查看当天学习内容（时间、知识点/视频、所属模块、时长、系统/专题标签）；下方「全部记录」可展开全部历史记录。
- 模块完成率横向条形图（纯 CSS）。
- 数据管理：**检查内容更新 / 内容更新源 / 恢复内置数据**、导出 JSON、导入 JSON、重置（二次确认）。
- 设置：跳转前确认、返回打勾提醒、**已学内容自动排到最后**、**启动时自动检查内容更新**、主题（浅/深/跟随系统）、**测试 B站 跳转**（诊断环境与深链）。

### 搜索（首页右上角）
- 跨 194 个知识点 + 320 条专题视频搜索，难度筛选（全部/基础/中档/拔高），结果行内可直接打勾。

---

## 四、内容更新机制

```text
B站 接口（仅开发/CI 时）
   ↓ scripts/fetch-data.mjs
data/courses.json（v2，含发布时间）
   ↓ 构建时复制
public/data/courses.json → dist/data/courses.json（同源，PWA 可直接 fetch）
   ↓
App：设置里「内容更新源」（留空 = PWA 同源 / APK 默认 Pages 数据地址；也可自定义 jsDelivr 镜像）
   ↓
启动自动检查（每天最多一次）+ 我的页「检查内容更新」
   ↓ 发现 generatedAt 更新 → 写 localStorage 覆盖数据 → 刷新
```

- 数据校验：`src/data.ts` 的 `isValidCoursesData()` 会拒绝结构不对的远程数据；
- 覆盖数据存 `localStorage` 的 `yishu-review:courses:v2`，优先于内置 JSON；
- 我的页可「恢复内置数据」一键清掉覆盖；
- 抓取脚本只保留人工整理的 24 模块复习顺序，用 B站 分P 刷新标题/时长/**发布时间**；专题会按最新发布时间排序并排除重复/预告片。

---

## 五、核心机制

### 1）B站深链（带分P）

```ts
bilibili://video/BV147411K7xu?page={p}   // 系统课：同一 BV 下 194 个分P，必须带 page
bilibili://video/{bvid}                  // 专题课：独立 BV
```

- **APK（Capacitor）**：`@capacitor/app-launcher` 直接 `openUrl(深链)`，按返回的 `completed` 判断；失败依次尝试简化深链 → 网页版。
  > 注意：该插件 v6 的 `canOpenUrl()` 内部是 `getPackageInfo(url)`，**只接受包名**，传 URL 永远 false——v2 已修复为直接 `openUrl`。Android 11+ 包可见性在 `AndroidManifest.xml` 的 `<queries>` 声明（B站手机版/HD/国际版 + bilibili scheme）。
- **Android 浏览器 / PWA**：`intent://…#Intent;scheme=bilibili;package=tv.danmaku.bili;S.browser_fallback_url=…`（未装 App 自动回退网页版）。
- **iOS**：先 `bilibili://`，1.2s 未切走则回退网页版。
- **桌面**：新标签页打开网页版（方便验收 `?p=`）。
- **校准 PAGE_OFFSET**：真机点 `page=1` / `page=2` 确认是第一集还是第二集，若是 0 基就改 [src/lib/bilibili.ts](src/lib/bilibili.ts) 的 `PAGE_OFFSET = -1`（全站唯一常量）。
- 排查入口：**我的 → 测试 B站 跳转**，会显示当前环境、B站 App 是否安装、深链 URL。

### 2）跳转 → 回来打勾

1. 跳转前把 `{ key, name, at }` 写入 `localStorage` 的 `pending`（只保留一条）；
2. 切回 App / 网页（`visibilitychange`、`focus`、`pageshow`；APK 额外监听 `@capacitor/app` 的 `appStateChange`），`pending` 存在且离开 ≥30 秒 → 底部浮条「看完了《…》？ [✓ 打勾] [× 忽略]」；
3. 打勾立即生效并清 pending；忽略只清 pending；设置里可关闭提醒。

### 3）本地状态（`yishu-review:state:v1`）

```ts
{
  v: 1,
  done: { [key]: { at } },        // 系统课 s:{p}；专题 t:{seasonId}:{bvid}；at = 完成时间（学习时间表用）
  pending?: { key, name, at },
  settings: {
    confirmBeforeJump, returnPrompt, theme,
    sortCompletedLast,            // v2：已学内容排到最后
    autoCheckUpdate, updateUrl    // v2：自动检查更新 / 内容更新源
  }
}
```

---

## 六、项目结构

```
yishu-review/
├─ data/courses.json           # v2 课程数据（含发布时间；194 知识点 + 7 合集 320 视频）
├─ public/data/courses.json    # 构建时由 data 拷贝（同源内容更新用，git 忽略）
├─ scripts/
│  ├─ fetch-data.mjs           # 从 B站 重新抓取并生成 courses.json（pnpm fetch:data）
│  ├─ enrich-part-counts.mjs   # 补全省略的多P合集分P数（显示「N 讲」，pnpm enrich:data）
│  ├─ verify-data.mjs          # 数据校验（pnpm verify:data）
│  ├─ e2e-check.mjs            # Edge headless 功能验收（pnpm verify:ui）
│  ├─ screenshot.mjs           # 480px@2x 截图（pnpm screenshot）
│  ├─ cdp.mjs                  # 零依赖 CDP 客户端
│  ├─ build-apk.ps1            # 一键打包 APK（pnpm build:apk）
│  └─ generate-icons.py        # PWA 图标生成
├─ src/
│  ├─ data.ts                  # 数据 + 远程覆盖 + 发布时间/主题色工具
│  ├─ types.ts
│  ├─ config.ts                # APP_VERSION / 常量
│  ├─ store/AppStore.tsx       # useReducer + Context + localStorage 单 key
│  ├─ lib/
│  │  ├─ bilibili.ts           # 深链 / APK AppLauncher / 跳转诊断 / PAGE_OFFSET
│  │  ├─ jump.tsx              # 跳转 + pending 确认
│  │  ├─ updates.ts            # 检查内容更新 / 应用覆盖数据
│  │  ├─ history.ts            # 学习时间表 / 打卡热力图数据
│  │  ├─ sort.ts               # 已学内容排到最后
│  │  ├─ progress.ts           # 进度 / 连续打卡
│  │  └─ format.ts
│  ├─ components/              # Cover(含发布时间角标)/ProgressRing/CheckButton/Sheet/Toast/TabBar/ReturnPromptBar/UpdateBanner/Icons/Segmented/LevelTag
│  └─ pages/                   # CoursePage / KnowledgePage / MinePage / SearchPage（各自 CSS）
├─ android/                    # Capacitor Android 工程（APK）
├─ .github/workflows/          # deploy-pages.yml（Pages 部署）/ refresh-data.yml（定时刷数据）
├─ capacitor.config.ts
├─ vite.config.ts              # PWA / 离线缓存 / VITE_BASE 子路径部署
└─ README.md
```

---

## 七、版本历史与验收

| 版本 | 内容 |
| --- | --- |
| v1.0.0 | A 版目录型 PWA + APK：课程/知识体系/我的、打勾进度、B站深链 + 返回浮条、搜索、暗色、离线 |
| **v2.0.0** | 内容更新检查（手动 + 每日自动）、学习时间表 + 打卡热力图、卡片发布时间、已学内容自动排后（可关）、移除最弱模块、修复 APK 跳转 B站 App、重新抓取一数主页（7 合集/320 视频/发布时间/教辅多P 显示「N 讲」）、GitHub Pages 部署 + 每周数据刷新工作流 |
| **v2.1.0** | 把「打卡热力图 + 学习时间表」合并为**学习日历**：月历标出有学习的日期，点日期查看当天学习内容，可切换月份 / 回到今天，全部记录可展开 |
| **v2.1.1** | 上线 GitHub（仓库 + Pages）：线上 PWA 可安装；APK 默认内容更新源改为 Pages 数据地址（国内可访问）；修复 GitHub Actions 构建（PWA SW 改为手动注册） |
| **v2.1.2** | 课程页系统课模块学完后自动排到列表末尾并收起；手动展开不误关；全部完成时默认全部收起 |

### 验收结果（本机实测）

- `pnpm typecheck` / `pnpm build` 通过
- `pnpm verify:data`：版本/知识点/合集/视频/分P唯一/发布时间齐全/合集排序/public 副本一致等 20+ 项通过
- `pnpm verify:ui`：Edge headless 功能验收全部通过（课程/知识体系/我的/搜索/深链 pending/返回浮条/排序/发布时间/学习日历/日期详情/内容更新/跳转诊断/PWA 离线/零 B站接口请求）
- `pnpm screenshot`：视觉验收图
- **APK**：`com.yishu.review` v2.1.2（versionCode 5），debug 签名验证通过，内置全部资源（约 4 MB）
- **线上 PWA**：<https://yiweiima.github.io/yishu-review/>（manifest / Service Worker / 离线可用）

---

## 八、常见问题

| 现象 | 排查 |
| --- | --- |
| 点知识点没打开 B站 App，跳了浏览器 | 我的 → **测试 B站 跳转**：看「B站 App 是否检测到」。若显示未检测到，确认装了哔哩哔哩/HD/国际版；v2 已改为直接 `openUrl` 深链，若仍异常请把诊断页截图发来 |
| 跳到 B站 但集数不对 | 校准 `PAGE_OFFSET`（见上），并用 3 个不同模块验收 |
| 切回 App 没弹浮条 | 需离开 ≥30 秒且设置里「返回打勾提醒」开启 |
| 检查内容更新失败 | APK 默认用 GitHub Pages 数据地址（`https://yiweiima.github.io/yishu-review/data/courses.json`），确认手机能打开该地址；打不开可在「内容更新源」换 jsDelivr 镜像；PWA 需同源部署 `data/courses.json` |
| 封面不显示 | 首次需要网络；B站图床不可达时自动退化为渐变封面（会重试） |
| 数据丢了 | 检查是否清站点数据；「我的 → 导出 JSON」定期备份 |
| 页面空白/安装失败 | PWA 必须 HTTPS；GitHub Pages 子路径部署要用 `VITE_BASE`（工作流已处理） |

---

## 九、依赖说明（刻意保持极简）

- 运行时：`react`、`react-dom`、`@capacitor/core`、`@capacitor/app`、`@capacitor/app-launcher`
- 开发/构建：`vite`、`@vitejs/plugin-react`、`typescript`、`vite-plugin-pwa`、`@capacitor/cli`、`@capacitor/android`
- 无 UI 组件库、无路由库、无状态管理库、无图表库、无请求库。

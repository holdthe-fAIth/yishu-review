# 一数复习 · 高中数学 + 高中物理（v3）

> B 站风格的「一数数学 + 黄夫人物理」高中复习进度本：点知识点 → 深链跳 B站 App 播放对应视频 → 看完切回来 → 底部浮条一键打勾 → 卡片、模块、科目进度与学习日历实时联动。
>
> **这不是播放器**：App 自己不放视频，只当「知识体系 + 打勾进度本」。没有 iframe、没有解析、没有第三方接口。

- 数据：`data/courses.json`（v3 多科目，静态 import，**运行时不请求 B站接口**）
  - **数学**：一数（B站 mid `14229967`）24 个模块 / 194 个知识点 + 7 个专题合集 / 320 条视频
  - **物理**：黄夫人（B站 mid `23630128`）36 个模块 / 444 个知识点 + 2 个专题合集 / 89 条视频
- 所有视频都带**发布时间**，卡片左下角显示，老视频（>2 年）黄色提示，方便判断是否适合当前高考趋势
- v3 新增：**物理科目（黄夫人）/ 数学物理一键切换 / 旧数学进度自动迁移 / 跨科目搜索、日历与统计**
- v2 新增：学习日历（月历打卡 + 点日期看当天学习内容）/ 内容更新检查（每天自动 + 手动）/ 已学内容自动排到最后 / B站跳转诊断
- 技术栈：**Vite 5 + React 18 + TypeScript + 原生 CSS（CSS 变量主题）**，零 UI 库、零图表库；PWA + Capacitor Android APK
- 🌐 **线上版（GitHub Pages）**：<https://holdthe-faith.github.io/yishu-review/> · **GitHub 仓库**：<https://github.com/holdthe-fAIth/yishu-review>

---

## 快速开始

```bash
pnpm install        # 或 npm install

pnpm dev            # 开发（局域网 IP 可手机真机联调深链）
pnpm build          # tsc + vite build（自动把 data/courses.json 拷贝到 public/data/）
pnpm preview        # 预览 dist → http://localhost:4173

pnpm fetch:data     # 重新抓取一数的数学数据（B站接口，仅开发时运行；保留物理数据）
pnpm fetch:physics  # 重新抓取黄夫人的物理数据（B站接口，仅开发时运行；保留数学数据）
pnpm verify:data    # 数据完整性校验（数学 194 / 物理 444 / 发布时间 / key 唯一）
pnpm check          # 一键：复制数据 + tsc + 数据校验 + build（提交前跑这个）
pnpm verify:ui      # 92 项 Edge headless 功能验收（需先 build + preview）
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

部署后手机打开 `https://holdthe-faith.github.io/yishu-review/` → 安装 PWA。之后每次 push 自动更新，App 内「检查内容更新」可拉取最新课程数据。

**方式 C：同一 WiFi 局域网**：`pnpm dev --host` / `pnpm preview --host`，手机开 `http://<电脑IP>:5173`。非 HTTPS 只能当网页用（不能安装/离线），需放行 Windows 防火墙。

### 2）APK（完全离线，不依赖电脑）

已产出：**`yishu-review-3.0.0-debug.apk`**（项目根目录，约 4 MB）

| 项 | 值 |
| --- | --- |
| 包名 / 版本 | `com.yishu.review` / versionCode 6, versionName **3.0.0** |
| 兼容 | Android 5.1+（minSdk 22，targetSdk 34） |
| 签名 | Android Debug（v1+v2，可安装，不可上架应用商店） |
| 能力 | Web 资源全部内置、断网可用；**点知识点直接唤起 B站 App**（`@capacitor/app-launcher`）；从 B站 切回来弹打勾浮条；支持数学/物理双科目与全部 v3 功能 |

**安装**：电脑微信「文件传输助手」发送 APK → 手机微信打开 → 用其他应用打开 → 安装；首次允许「安装未知来源应用」，小米/华为等可能需临时关闭「纯净模式」。

> v3 与 v2 使用同一台机器生成的 debug 签名，**可直接覆盖安装，原有 localStorage 进度保留**；旧 `s:` / `t:` key 会自动迁移为 `math:` 前缀。

**APK 内更新内容**：APK 内置的是打包时快照。**默认更新源已内置**为 GitHub Pages 的数据地址（带 `CORS: *`），App 每天自动检查一次，也可以在「我的 → 检查内容更新」手动拉取——不用重装 APK 就能更新课程数据；只有功能更新才需要重新打包。默认地址：

```text
https://holdthe-faith.github.io/yishu-review/data/courses.json
# 备用镜像（Pages 打不开时）：https://cdn.jsdelivr.net/gh/holdthe-fAIth/yishu-review@main/data/courses.json
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

cd D:\learn coding\yishu-review
git branch -M main                      # 统一用 main 分支
git remote add origin https://github.com/holdthe-fAIth/yishu-review.git
git push -u origin main
```

推送后：

1. 打开仓库 **Settings → Pages → Build and deployment**；
2. **Source** 选择 **GitHub Actions**；
3. 仓库自带的 [.github/workflows/deploy-pages.yml](.github/workflows/deploy-pages.yml) 会在每次 push main 时自动构建并部署（约 1–2 分钟）；
4. 部署完成后地址是：`https://holdthe-faith.github.io/yishu-review/`（Actions 页面 / Pages 设置页会显示）。

手机打开该地址 → 安装 PWA。**每次 `git push` 后线上自动更新**；App 打开时 Service Worker 自动更新版本。

### 定时更新课程数据（可选）

仓库自带 [.github/workflows/refresh-data.yml](.github/workflows/refresh-data.yml)：

- 每周一 10:00（北京时间）自动运行 `pnpm fetch:data` + `pnpm fetch:physics`，把 B站 最新视频写回 `data/courses.json` 并提交；
- 也可以在 GitHub → Actions → Refresh course data → Run workflow 手动触发；
- 若 GitHub 服务器访问 B站 接口被风控，可只在本地运行两个 fetch 脚本后手动提交（效果相同）；
- 提交后 Pages 会自动重新部署，App 内「检查内容更新」即可拿到新数据。

### 用 SSH 推送（可选）

```bash
git remote set-url origin git@github.com:holdthe-fAIth/yishu-review.git
git push -u origin main
```

### 只想让别人也能安装（不部署 PWA）

也可以只把 `data/courses.json` 放到 GitHub，作为 APK 的「内容更新源」；或把 `dist/` 上传到任意 HTTPS 静态托管（Cloudflare Pages / Vercel / Netlify）。

---

## 三、功能清单（v3）

### 页面 1 · 课程
- **科目切换：数学 / 物理**，选择记忆在本机；Hero 显示当前科目的知识点总进度 +「继续复习」（按模块顺序第一个未打勾）+「内容更新于 YYYY-MM-DD」。
- 二级 Segmented：系统课 / 专题课（没有专题的科目会自动隐藏）。
- 数学系统课：24 个模块；物理系统课：36 个模块（运动的描述 → 电磁感应 → 选修/原子物理）。模块行 = 模块名 + `3/6` + 4px 粉色进度条；展开 2 列卡片。
  - 卡片：模块渐变自绘封面 + 时长 + **发布时间角标（左下角，老视频黄色）** + 标题 2 行 + 难度标签（物理暂无难度数据时自动隐藏）。
  - **已学内容自动排到最后**：完全学完的模块移到列表末尾并自动收起；模块内已打勾的知识点移到本模块末尾（设置可关）。
- 专题课：数学 7 个合集 / 320 条视频；物理 2 个合集 / 89 条视频（试卷讲解、补充合集）。合集内已看视频自动排后，全部刷完的合集 tab 排到最后。
  - 教辅类「一本书 / 100 讲」是单个多P视频，封面角标显示「**N 讲**」而不是几百小时的总时长。
  - **点卡片主体** → 记录 pending + 深链跳 B站 App；**点右上角圆圈** → 就地打勾不跳转；**长按/右键** → 菜单（标记完成、复制 BV、浏览器打开）。
  - 已完成：粉色圆 + 白勾、标题变灰、底部满格粉线。
- **旧版数学进度无损迁移**：`s:` / `t:` key 自动变成 `math:` 前缀；物理使用 `physics:` 前缀，互不干扰。

### 页面 2 · 知识体系
- 顶部大进度环 +「已完成 X / 194（数学）或 444（物理）· 约 Y 小时」。
- 当前科目模块列表：24/36 个模块；24px 小环 + 名称 + 已看/总数 + 展开箭头；展开显示知识点 chip（已点亮粉底白字 ✓）。
- **已学模块 / 知识点自动排到最后**；点 chip 直接跳 B站对应分P/视频。
- ~~最弱模块~~（v2 已按需求移除）。

### 页面 3 · 我的
- 统计：已看视频数 / 累计时长 / 连续打卡天数（数学 + 物理合计）。
- **学习日历**：月历形式（可切换月份），有学习的日期会点亮（颜色越深完成越多，今天有描边）；**点某一天**即可在下方查看当天学习内容（时间、知识点/视频、所属模块、数学/物理标签、时长、系统/专题标签）；下方「全部记录」可展开全部历史记录。
- 模块完成率横向条形图（纯 CSS），支持切换数学/物理。
- 数据管理：**检查内容更新 / 内容更新源 / 恢复内置数据**、导出 JSON、导入 JSON、重置（二次确认）。
- 设置：跳转前确认、返回打勾提醒、**已学内容自动排到最后**、**启动时自动检查内容更新**、主题（浅/深/跟随系统）、**测试 B站 跳转**（按当前科目诊断环境与深链）。

### 搜索（首页右上角）
- 跨 638 个知识点 + 409 条专题视频搜索，结果显示「数学/物理 · 模块」标签；难度筛选（全部/基础/中档/拔高），结果行内可直接打勾。

---

## 四、内容更新机制

```text
B站 接口（仅开发/CI 时）
   ↓ scripts/fetch-data.mjs（数学，保留物理）
   ↓ scripts/fetch-physics.mjs（物理，保留数学）
data/courses.json（v3，多科目，含发布时间）
   ↓ 构建时复制
public/data/courses.json → dist/data/courses.json（同源，PWA 可直接 fetch）
   ↓
App：设置里「内容更新源」（留空 = PWA 同源 / APK 默认 Pages 数据地址；也可自定义 jsDelivr 镜像）
   ↓
启动自动检查（每天最多一次）+ 我的页「检查内容更新」
   ↓ 发现 generatedAt 更新 → 写 localStorage 覆盖数据 → 刷新
```

- 数据校验：`src/data.ts` 的 `isValidCoursesData()` 会拒绝结构不对的远程数据（v3 多科目）；
- 覆盖数据存 `localStorage` 的 `yishu-review:courses:v3`，优先于内置 JSON；旧 v2 覆盖会被清掉并回退内置 v3；
- 我的页可「恢复内置数据」一键清掉覆盖；
- 抓取脚本保留人工整理的模块顺序，用 B站 接口刷新标题/时长/**发布时间**；数学专题按最新发布时间排序，物理系统课按「上篇 → 下篇 → 选修」章节顺序。

---

## 五、核心机制

### 1）B站深链（带分P / 独立 BV）

```ts
bilibili://video/BV147411K7xu?page={p}   // 数学：同一 BV 下按分P跳转
bilibili://video/{bvid}                  // 物理知识点 / 专题视频：独立 BV，不带 page
```

- **APK（Capacitor）**：`@capacitor/app-launcher` 直接 `openUrl(深链)`，按返回的 `completed` 判断；失败依次尝试简化深链 → 网页版。
  > 注意：该插件 v6 的 `canOpenUrl()` 内部是 `getPackageInfo(url)`，**只接受包名**，传 URL 永远 false——v2 已修复为直接 `openUrl`。Android 11+ 包可见性在 `AndroidManifest.xml` 的 `<queries>` 声明（B站手机版/HD/国际版 + bilibili scheme）。
- **Android 浏览器 / PWA**：`intent://…#Intent;scheme=bilibili;package=tv.danmaku.bili;S.browser_fallback_url=…`（未装 App 自动回退网页版）。
- **iOS**：先 `bilibili://`，1.2s 未切走则回退网页版。
- **桌面**：新标签页打开网页版（方便验收 `?p=`）。
- **校准 PAGE_OFFSET**：真机点 `page=1` / `page=2` 确认是第一集还是第二集，若是 0 基就改 [src/lib/bilibili.ts](src/lib/bilibili.ts) 的 `PAGE_OFFSET = -1`（全站唯一常量，只影响带分P的数学视频）。
- 排查入口：**我的 → 测试 B站 跳转**，会按当前科目显示环境、B站 App 是否安装、深链 URL。

### 2）跳转 → 回来打勾

1. 跳转前把 `{ key, name, at }` 写入 `localStorage` 的 `pending`（只保留一条）；
2. 切回 App / 网页（`visibilitychange`、`focus`、`pageshow`；APK 额外监听 `@capacitor/app` 的 `appStateChange`），`pending` 存在且离开 ≥30 秒 → 底部浮条「看完了《…》？ [✓ 打勾] [× 忽略]」；
3. 打勾立即生效并清 pending；忽略只清 pending；设置里可关闭提醒。

### 3）本地状态（`yishu-review:state:v1`）

```ts
{
  v: 1,
  done: {
    'math:s:5': { at },                  // 数学系统课：math:s:{p}
    'math:t:8397438:BV...': { at },      // 数学专题：math:t:{seasonId}:{bvid}
    'physics:s:BV...': { at }            // 物理：physics:s:{bvid}
  },
  pending?: { key, name, at },
  settings: {
    confirmBeforeJump, returnPrompt, theme,
    sortCompletedLast,            // 已学内容排到最后
    autoCheckUpdate, updateUrl,   // 自动检查更新 / 内容更新源
    activeSubject                 // 当前科目：math / physics
  }
}
```

> 旧版 `s:{p}` / `t:{seasonId}:{bvid}` 会在启动或导入时自动补 `math:` 前缀，完成时间和日历记录都不丢。

---

## 六、项目结构

```
yishu-review/
├─ data/courses.json           # v3 多科目数据（数学 194 + 物理 444 知识点；9 合集 409 视频）
├─ public/data/courses.json    # 构建时由 data 拷贝（同源内容更新用，git 忽略）
├─ scripts/
│  ├─ fetch-data.mjs           # 刷新数学数据，保留物理（pnpm fetch:data）
│  ├─ fetch-physics.mjs        # 刷新黄夫人物理数据，保留数学（pnpm fetch:physics）
│  ├─ enrich-part-counts.mjs   # 补全省略的多P合集分P数（显示「N 讲」，pnpm enrich:data）
│  ├─ verify-data.mjs          # 双科目数据校验（pnpm verify:data）
│  ├─ e2e-check.mjs            # Edge headless 功能验收（pnpm verify:ui）
│  ├─ screenshot.mjs           # 480px@2x 截图（pnpm screenshot）
│  ├─ cdp.mjs                  # 零依赖 CDP 客户端
│  ├─ build-apk.ps1            # 一键打包 APK（pnpm build:apk）
│  └─ generate-icons.py        # PWA 图标生成
├─ src/
│  ├─ data.ts                  # 多科目数据 / 派生结构 / key / 远程覆盖 / 主题色
│  ├─ types.ts
│  ├─ config.ts                # APP_VERSION / 常量
│  ├─ store/AppStore.tsx       # useReducer + Context + localStorage 单 key + 旧 key 迁移
│  ├─ lib/
│  │  ├─ bilibili.ts           # 深链 / APK AppLauncher / 跳转诊断 / PAGE_OFFSET
│  │  ├─ jump.tsx              # 跳转 + pending 确认
│  │  ├─ updates.ts            # 检查内容更新 / 应用覆盖数据
│  │  ├─ history.ts            # 学习时间表 / 打卡热力图数据（带科目）
│  │  ├─ sort.ts               # 已学内容排到最后（按科目 key）
│  │  ├─ progress.ts           # 科目进度 / 连续打卡
│  │  └─ format.ts
│  ├─ components/              # SubjectSwitch / Cover(含发布时间角标)/ProgressRing/CheckButton/Sheet/Toast/TabBar/ReturnPromptBar/UpdateBanner/Icons/Segmented/LevelTag
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
| **v3.0.0** | 新增**物理科目（黄夫人）**：36 模块 / 444 知识点 + 2 专题合集 / 89 视频；数学/物理一级切换；旧数学进度自动迁移；跨科目搜索、学习日历、统计与模块完成率；数据升级 v3 多科目结构；黄夫人物理抓取脚本 |

### 验收结果（本机实测）

- `pnpm typecheck` / `pnpm build` 通过
- `pnpm verify:data`：数学 194 / 物理 444 / 9 合集 409 视频 / 分P唯一 / 发布时间齐全 / 双科目 key 唯一 / public 副本一致等 60+ 项通过
- `pnpm verify:ui`：**92 项** Edge headless 功能验收全部通过（双科目切换 / 旧进度迁移 / 物理深链 / 跨科目搜索 / 学习日历 / 排序 / PWA 离线 / 零 B站接口请求）
- `pnpm screenshot`：视觉验收图（含物理首页）
- **APK**：`com.yishu.review` v3.0.0（versionCode 6），debug 签名验证通过，内置全部资源（约 4 MB）
- **线上 PWA**：<https://holdthe-faith.github.io/yishu-review/>（manifest / Service Worker / 离线可用）

---

## 八、常见问题

| 现象 | 排查 |
| --- | --- |
| 点知识点没打开 B站 App，跳了浏览器 | 我的 → **测试 B站 跳转**：看「B站 App 是否检测到」。若显示未检测到，确认装了哔哩哔哩/HD/国际版；v2 已改为直接 `openUrl` 深链，若仍异常请把诊断页截图发来 |
| 跳到 B站 但集数不对 | 校准 `PAGE_OFFSET`（见上），并用 3 个不同模块验收 |
| 切回 App 没弹浮条 | 需离开 ≥30 秒且设置里「返回打勾提醒」开启 |
| 检查内容更新失败 | APK 默认用 GitHub Pages 数据地址（`https://holdthe-faith.github.io/yishu-review/data/courses.json`），确认手机能打开该地址；打不开可在「内容更新源」换 jsDelivr 镜像；PWA 需同源部署 `data/courses.json` |
| 封面不显示 | 首次需要网络；B站图床不可达时自动退化为渐变封面（会重试） |
| 数据丢了 | 检查是否清站点数据；「我的 → 导出 JSON」定期备份 |
| 页面空白/安装失败 | PWA 必须 HTTPS；GitHub Pages 子路径部署要用 `VITE_BASE`（工作流已处理） |

---

## 九、依赖说明（刻意保持极简）

- 运行时：`react`、`react-dom`、`@capacitor/core`、`@capacitor/app`、`@capacitor/app-launcher`
- 开发/构建：`vite`、`@vitejs/plugin-react`、`typescript`、`vite-plugin-pwa`、`@capacitor/cli`、`@capacitor/android`
- 无 UI 组件库、无路由库、无状态管理库、无图表库、无请求库。

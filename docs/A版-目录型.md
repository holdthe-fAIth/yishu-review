# A 版 · 目录型（推荐先做这个）

> **一句话**：App 只当「知识体系 + 打勾进度本」，点视频直接跳 B站 App 对应那一集，看完回来一键打勾。
> **不需要**内嵌播放器——所以没有 iframe 画质、跨域、黑屏这些麻烦。

---

## 怎么用

1. 电脑新建空目录（例如 `D:\code\yishu-review`），把本文件夹的 `data/` 拷进去。
2. 把下面「主提示词」整段（`# 角色` 到最后的 `# 不要做的事`）粘贴成 Harness 的第一条消息。
3. 它先出计划 → 你回「开始 Phase 0」→ 每个 Phase 结束验收，再「继续 Phase N」。

---

## 主提示词（整段复制）

```
# 角色
你是一名资深前端 + Android 独立开发者。在这个目录里从零做一个「一数数学复习」App：
B 站风格的界面，内容是一数（B站 UP 主，mid 14229967）的高中数学视频，按知识体系拆好。
用户点一个知识点 → 直接跳转到手机上 B站 App 播这一集；看完切回来 → 一键打勾 →
该知识点点亮 → 模块进度和总进度实时联动。

这是个「复习进度本 / 目录」，不是播放器。App 自己不放视频。

# 第一步：只出计划，不要写代码
先输出：技术方案、目录结构、数据模型、页面清单、分阶段任务表、每阶段的验收方式。
我确认之后你再动手写代码。

# 硬约束
1. 纯前端，全部数据存本地（localStorage），不要后端、不要登录、不要云同步。
2. 不做内嵌播放器！点视频用深链唤起 B站 App：
   bilibili://video/{bvid}?page={p}
   没装 App 就退化成浏览器打开 https://www.bilibili.com/video/{bvid}?p={p}。
   绝对不下载、不解析、不转存任何视频流，也不接第三方解析接口。
3. 技术栈固定：Vite + React 18 + TypeScript + 原生 CSS（CSS 变量做主题）。
   不要引入 antd / MUI / Vant 等 UI 组件库 —— B 站风格自己写更好看。依赖越少越好。
   先产出可安装的 PWA（当天就能加到手机桌面用）；Phase 6 再考虑 Capacitor 打包 APK。
4. 课程数据用 data/courses.json，静态 import 进前端；运行时不请求任何 B 站接口。
5. 手机竖屏优先，100% 宽度；桌面浏览器下居中一个 480px 宽的容器。

# 数据（已备好，不要再抓，直接用）
data/courses.json：
{
  "up": { "mid": 14229967, "name": "一数" },
  "systemCourse": {
    "bvid": "BV147411K7xu",              // 大合集，198 个分P 都在这个 BV 下
    "title": "高中数学基础与解法全集",
    "kpCount": 194,
    "modules": [                          // 24 个模块，顺序已按复习顺序排好
      { "id": "m5", "name": "集合", "count": 6, "durationMin": 146,
        "items": [                        // 一个 item = 一个知识点 = 一个分P
          { "p": 5, "no": 1, "name": "集合的概念", "difficulty": "易",
            "level": "基础", "duration": 1509, "durationText": "25:09" }
        ] }
    ]
  },
  "topics": [                             // 6 个专题合集，134 条独立视频，自带封面
    { "id": "t8397438", "title": "新高考一轮复习", "count": 13,
      "videos": [ { "bvid": "BV...", "title": "...", "cover": "https://i0.hdslb.com/...",
                    "duration": 1234, "durationText": "20:34" } ] }
  ]
}
关键点：
- 系统课每个 (bvid=BV147411K7xu, p=N) 唯一对应一个知识点，1:1，所以「看完 → 知识点点亮」
  不需要任何额外映射。
- 模块顺序就是复习顺序，别自己重排。
- 跳转必须带 page 参数，否则永远打开第一集（198 个分P 都在同一个 BV 下）。

# 产品设计（3 个 tab：课程 / 知识体系 / 我的，没有播放页）

## 页面 1 课程（首页）
- 顶部大标题「一数复习」+ 右上角搜索。
- hero 卡：总进度圆环（194 个知识点）+「继续复习」按钮 → 跳到按模块顺序第一个没打勾的知识点。
- Segmented：系统课 / 专题课。
- 系统课：模块折叠分组。模块标题行 = 模块名 + 右侧「3/6」+ 4px 粉色细进度条；展开后 2 列卡片。
  卡片 = 16:9 封面（系统课没有封面图，用模块主题色渐变 + 模块名首字自己生成，不要去抓
  B站封面）+ 标题 2 行省略 + 时长。
- 专题课：顶部横滑合集 tab（新高考一轮复习 / 120+拔高 / 最后十课 / 进阶小专题 / 教辅 /
  旧版一轮），下面带真实封面的 2 列卡片。

## 卡片交互（A 版的关键，别做错）
- **点卡片主体** → 深链跳 B站，同时记录一条 pending（见下）
- **点卡片右上角那个小圆圈 ✓** → 就地打勾 / 取消，不跳转（单独热区，别跟跳转抢）
- **长按** → 操作菜单：标记完成 / 取消完成 / 复制 BV 号 / 在浏览器打开
- 已完成状态：右上角 18px 粉色圆 + 白勾，标题变灰 #9499A0，底部一条满格进度线

## 页面 2 知识体系
- 顶部大进度环 + 「已完成 82 / 194 个知识点 · 约 48 小时」。
- 24 个模块列表，每行：24px SVG 圆环进度 + 模块名 + 已看/总数 + 展开箭头。
- 展开显示知识点 chip：已点亮粉底白字 + ✓，未点亮灰边框；点 chip 直接跳 B站。
- 底部「最弱模块」：完成率最低的 3 个，建议先复习。

## 页面 3 我的
- 已看视频数、累计视频时长（已完成视频时长之和）、连续打卡天数。
- 模块完成率横向条形图（纯 CSS/SVG，不引图表库）。
- 数据管理：导出 JSON / 导入 JSON / 重置（二次确认）。
- 设置：跳转前是否确认 / 是否开启返回打勾提醒 / 主题。

# 视觉规格（照这个来，别自由发挥）
- 主色 #FB7299，辅色 #00AEEC，成功绿 #2AC864，警告橙 #FFA726，危险红 #FF5C5C
- 背景 #F6F7F8，卡片 #FFFFFF，圆角 12px，阴影 0 1px 3px rgba(0,0,0,.06)
- 封面圆角 8px；2 列网格，gap 10px，左右 padding 12px
- 文字主色 #18191C，次级 #9499A0；标题 15px/600，正文 13px
- 难度标签：基础=绿 / 中档=橙 / 拔高=红，圆角 4px、11px
- 时长标签在封面右下角：黑色 60% 底 + 白字 11px
- 点击态 scale(.97) 120ms；进度条数值变化 300ms 过渡
- 暗色：背景 #17181A，卡片 #212226，文字 #E3E5E7
- 字体：-apple-system, "PingFang SC", "Noto Sans SC", sans-serif
- 必须处理 safe-area-inset（刘海 + 底部手势条），底部 tabbar 不能被挡

# 跳转与「回来打勾」（A 版灵魂，必须做）
跳转前把 { key, name, at } 存进 localStorage 的 pending（只留一条）。
从 B站 切回 App 时（web 用 document.visibilitychange，Capacitor 用 @capacitor/app 的
appStateChange），如果 pending 存在且离开超过 30 秒 → 底部弹一条浮条：
「看完了《集合的概念》？ [✓ 打勾] [× 忽略]」，点打勾就完成，忽略就清掉 pending。

web / PWA 端的深链（Android Chrome 里 intent:// 最稳）：
  const intent = `intent://video/${bvid}?page=${p}#Intent;scheme=bilibili;` +
                 `package=tv.danmaku.bili;` +
                 `S.browser_fallback_url=${encodeURIComponent(webUrl)};end`;
  location.href = intent;          // 失败会自动走 browser_fallback_url
打包成 Capacitor 后改用 @capacitor/app-launcher（见文末附录）。

⚠️ 分P 的 page 起算点要真机试：有的版本 0 是第一集、有的 1 是第一集。
   拿 page=1 和 page=2 各点一次看打开的是第几集，然后把偏移定死成一个常量 PAGE_OFFSET
   （数据里的 p 从 1 开始）。

# 数据模型（localStorage，一个 key 就够）
type State = {
  v: 1;
  done: Record<string, { at: number }>;  // 系统课 key=`s:${p}`；专题 key=`t:${seasonId}:${bvid}`
  pending?: { key: string; name: string; at: number };
  settings: { confirmBeforeJump: boolean; returnPrompt: boolean; theme: 'light'|'dark'|'auto' };
};
派生值不要存，每次算：知识点完成 = done[`s:${p}`]；模块进度 = 已完成/ count；
总进度 = /194；连续打卡 = 按 done.at 的本地日期去重算连续天数。
所有状态读写收口到一个 store（zustand 或 useReducer+Context），组件不准直接碰 localStorage。

# 分阶段（每阶段结束：能跑 + 我截图验收 + git commit）
Phase 0 骨架：Vite+React+TS 起项目，3 个页面 + 底部 tabbar + 主题变量 + 空态。
         验收：pnpm dev 起来，480px 宽度下三个页面点得通，不报错。
Phase 1 数据：接入 courses.json，首页渲染 24 模块 / 194 知识点 + 6 个专题 134 条。
         验收：模块分组、卡片网格、时长难度都对，滚动流畅。
Phase 2 打勾：store + 持久化 + 卡片勾选态 + 模块/总进度 rollup + 导出导入重置。
         验收：勾几个刷新不丢；进度数字和模块进度条同步；导出能再导回来。
Phase 3 跳转（A 版核心）：深链 + page 参数 + pending + 返回浮条一键打勾。
         验收：点 3 个不同模块的知识点都跳到对应那一集（重点验 page）；从 B站 切回来
               浮条能弹出来，点打勾后卡片和进度立刻变。
Phase 4 知识体系页：进度环 + chip + 点击跳转 + 最弱模块。
         验收：勾一个知识点这里立刻变粉；模块环百分比正确。
Phase 5 「我的」+ 搜索 + 难度筛选 + 暗色模式。
Phase 6 PWA 化：vite-plugin-pwa + manifest + 192/512 图标，能加到手机桌面并离线打开。
         然后（可选）Capacitor 打包 APK；没有 Android SDK 就只交 PWA + 构建说明。

# 验收清单（最后逐条自查并回报）
- [ ] pnpm build 和 tsc 类型检查通过，无 console 报错
- [ ] 194 个知识点一个不少，模块顺序和 courses.json 一致
- [ ] 点卡片跳 B站 能到对应那一集（page 参数正确，至少验 3 个不同模块）
- [ ] 勾选不跳转、跳转不误触（两个热区分开）
- [ ] 从 B站 回来能弹「看完了？」浮条并一键打勾
- [ ] 勾一个知识点 → 卡片、模块进度、知识体系页、总进度环四处同时变
- [ ] 刷新 / 重开浏览器数据不丢
- [ ] 480px 下无横向滚动，tabbar 不被安全区挡住
- [ ] 能装到手机桌面（PWA）并离线打开
- [ ] README 写明：怎么 dev、怎么 build、怎么部署 PWA、怎么导出导入数据

# 不要做的事（踩了就是白干）
1. 不要做内嵌播放器 —— A 版的产品定义就是没有播放页。
2. 不要下载 / 解析 / 转存 B 站视频流，不要接第三方解析接口。
3. 不要把 194 条知识点硬编码进组件，一定走 courses.json + TS 类型。
4. 不要在运行时请求 B 站接口（有风控，会 -352 挂掉）。
5. 不要用「点击整张卡片」既跳转又打勾 —— 一定是卡片主体跳转、右上角圆圈打勾。
6. 不要引入图表库 / UI 库 / 重型依赖。
```

---

## 附录：打包成 APK 后的深链写法

```ts
// npm i @capacitor/app-launcher
import { AppLauncher } from '@capacitor/app-launcher';

const deep = `bilibili://video/${bvid}?page=${p}`;
const web  = `https://www.bilibili.com/video/${bvid}?p=${p}`;

const { value } = await AppLauncher.canOpenUrl({ url: deep });
if (value) await AppLauncher.openUrl({ url: deep });
else window.open(web, '_system');
```

Android 11+ 必须在 `android/app/src/main/AndroidManifest.xml` 加包可见性，否则
`canOpenUrl` 永远返回 false（表现为「点了没反应」）：

```xml
<queries>
  <package android:name="tv.danmaku.bili" />
  <intent>
    <action android:name="android.intent.action.VIEW" />
    <data android:scheme="bilibili" />
  </intent>
</queries>
```

---

## 之后的升级路径

A 版做完、想加「边看边打勾」的内嵌播放 → 用 **B 版提示词**，但**在同一个项目里继续**，
让 agent 只加一个播放页（A 版的卡片、进度、知识体系全部复用），大约只需 1 个 Phase。

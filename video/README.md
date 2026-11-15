# 「一数复习」介绍视频

90 秒 App 介绍片（1920×1080 / 30fps / 中文旁白 + 字幕 + 背景音乐），8 个镜头：

| # | 章节 | 时间 | 内容 |
| --- | --- | --- | --- |
| 01 | 问题 | 0:00–0:09 | 收藏了几百个视频，却总不知道看到哪了 |
| 02 | 产品 | 0:09–0:18 | 一数复习是什么 + 真实首页截图 |
| 03 | 内容 | 0:18–0:30 | 194 个知识点 / 7 个合集 / 320 条视频（数字滚动） |
| 04 | 玩法 | 0:30–0:43 | 点知识点 → 跳 B站；切回来 → 一键打勾 |
| 05 | 创作 · 开始 | 0:43–0:55 | 主提示词 / 定方案 / 搭骨架 / 接数据 / 打通核心 |
| 06 | 创作 · 发展 | 0:55–1:09 | 11/14 v2 迭代、修复与重抓；11/15 上线；提交/代码统计 |
| 07 | 结果 | 1:09–1:22 | GitHub Pages、Android APK、62 项验收通过 |
| 08 | 尾声 | 1:22–1:30 | 口号 + 线上二维码（扫码安装 PWA） |

## 文件

- `一数复习-介绍.mp4` —— 成片
- `一数复习-介绍-v1-横屏1080p.mp4` —— 同一成片的备份命名
- `cover.png` / `封面.png` —— 视频封面（1920×1080）
- `make_intro.py` —— 生成脚本（配音、音乐、逐帧渲染、ffmpeg 合成）

## 重新生成

```bash
# 依赖：Python 3 + Pillow + numpy；ffmpeg 二进制放在 ../_videotools/node_modules/@ffmpeg-installer/win32-x64/ffmpeg.exe
#      中文语音使用 Windows SAPI「Microsoft Huihui Desktop」
python video/make_intro.py tts      # 只生成旁白（检查时长）
python video/make_intro.py stills   # 每个镜头渲染静帧，检查排版
python video/make_intro.py render   # 渲染成片（约 2–4 分钟）
python video/make_intro.py all      # 旁白 + 成片
```

- 旁白/字幕文案在 `make_intro.py` 顶部的 `SCENES` 里改（`speech` 是语音，`subtitle` 是字幕）；
- 分辨率/帧率在 `W, H, FPS`；
- 截图素材来自 `../screenshots/`（需先跑 `pnpm screenshot`）；
- 二维码指向 <https://yiweiima.github.io/yishu-review/>。

## 如果想换成「真人/实机素材」

不需要额外素材也能用现在这版。若想更真实，可以补录 2–3 段（横屏 1920×1080 或竖屏 1080×1920，30fps，每段 5–10 秒，发我即可替换对应镜头）：

1. 手机上点一个知识点 → 直接跳进 B站 App 对应分集的实拍；
2. 从 B站 切回 App → 底部「看完了？」浮条 → 点「打勾」；
3. 把 PWA 安装到手机桌面 / 打开 APK 的过程。

## 可选版本

- 竖屏 9:16（朋友圈 / 视频号 / 抖音）
- 30 秒快剪版
- 真人配音 / 更换背景音乐

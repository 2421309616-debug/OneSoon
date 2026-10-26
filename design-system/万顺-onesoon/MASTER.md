# Design System Master File

**Project:** 万顺 OneSoon
**Surface:** 用户端 H5（uni-app / Vue 3）

自动生成的暗色落地页配色已弃用。下面这些值是已确认的界面规则。

## Color Palette

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Primary / logo / button | `#D0121A` | `--color-primary` |
| On Primary | `#FFFFFF` | `--color-on-primary` |
| Background | `#FFFFFF` | `--color-background` |
| Canvas outside the phone column | `#F2F2F2` | `--color-canvas` |
| Foreground | `#1A1A1A` | `--color-foreground` |
| Muted text | `#3C4149` | `--color-muted` |
| Placeholder | `#5C6370` | `--color-placeholder` |
| Map slot | `#E8EAED` | `--color-map` |
| Border | `#ECE7E7` | `--color-border` |

## Typography

- 中文界面用系统字体：PingFang SC、Noto Sans SC、Microsoft YaHei。
- 正文不小于 16px（32rpx）。底部导航标签 12px（24rpx）。
- 字重：标题 700，正文 500。

## Layout

- 手机宽度，页面最大 375px，居中。
- 首页顶部地图预留区约 40vh，浅灰，不画假地图。
- 白色内容区叠在地图预留区下沿。
- 底部固定导航只有「首页」「我的」。
- 小应用宫格一行 5 个。没有挂入应用时保留两行高度。

## Avoid

- 暗色背景、蓝色主色、营销落地页结构。
- 用 emoji 当图标。
- 在地图预留区里画道路或写大字占位。

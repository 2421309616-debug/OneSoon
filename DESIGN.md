# Design

万顺用户端。白底，红色只用于字标、输入框、选中导航和头像。

## Tokens

- 红 `#D0121A`
- 页面 `#FFFFFF`
- 全局页面底 `#F2F3F5`
- 正文 `#1A1A1A`
- 次要文字 `#3C4149`
- 地图预留 `#E8EAED`
- 分割线 `#ECE7E7`
- 字体：PingFang SC、Noto Sans SC、Microsoft YaHei
- 页面始终铺满窗口；手机、平板、桌面断点及安全区规则统一维护在 `apps/passenger/src/styles/layout.css`，参见 `docs/responsive-layout.md`

## Home

顶部约 40vh 是空的地图区。左上角是「万顺 / OneSoon」。白色内容区盖住地图下沿，里面是上车点、红色描边的目的地输入框，以及一行五个的小应用宫格。没有挂入应用时宫格仍留出两行高度。底部固定「首页」「我的」。

## Profile

红色圆形头像「万」，昵称「万顺用户」，英文名 OneSoon。同一套底部导航。

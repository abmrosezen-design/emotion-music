# Emotion Music 部署说明

## 推荐配置

- Node.js 20 或更新版本
- 安装命令：`pnpm install --frozen-lockfile`
- 构建命令：`pnpm build`
- 发布目录：`dist`
- 当前版本没有后端、数据库或必填环境变量

`vite.config.ts` 使用相对资源路径，因此独立域名、二级目录和 GitHub Pages 仓库路径均可加载构建资源。

## 托管平台

Cloudflare Pages 或 Netlify 可直接使用以上构建参数，并会读取 `public/_headers` 中的缓存和安全响应头。带哈希的 JS/CSS 会缓存一年，HTML 保持重新验证。

GitHub Pages 也能托管当前静态构建，但不会读取 `_headers`。如需要 CSP、Permissions-Policy 等安全响应头，建议使用 Cloudflare Pages、Netlify，或在反向代理中配置同等规则。

## 上线前必须替换的域名信息

获得正式域名后，在 `index.html` 中补充：

- `link rel="canonical"`
- `og:url`
- `og:image` 与 `twitter:image`（建议使用 1200 × 630 的分享图）

在 `public/robots.txt` 同级增加带正式域名的 `sitemap.xml`。域名未确定前不要写入猜测地址。

## 外部资源与隐私

- 首页视频来自 CloudFront；正式上线前应确认该资源长期可用、允许生产流量，并监控带宽与首屏加载时间。
- 字体来自 Google Fonts 与 CDNFonts，安全策略已只放行必要域名。
- 用户文字分析在浏览器本地完成；“此刻想对你说”最多保留最近 100 条匿名记录，仅保存于当前浏览器。
- 推荐曝光、符合/不符合原因、换歌和首次站外搜索最多保留最近 200 条本地事件，用于当前浏览器内的即时推荐调权。
- 音乐按钮跳转第三方搜索页，不会把用户填写的情绪文字传给第三方。

## 发布后检查

1. 使用手机网络检查首页视频首次加载与循环衔接。
2. 逐一测试 6 个音乐平台的搜索链接。
3. 检查正式域名的 HTTPS、CSP 和缓存响应头。
4. 用 Lighthouse 检查 Performance、Accessibility、Best Practices 与 SEO。
5. 从普通话、粤语、英语、法语、日语、韩语和其他语言各完成一次推荐，确认语言硬约束仍生效。

# Emotion Music Prototype

基于 React、TypeScript、Vite、Tailwind CSS、GSAP 和 lucide-react 制作的情绪音乐推荐网页原型。

## 本地运行

```bash
pnpm install
pnpm dev
```

## 构建

```bash
pnpm build
pnpm preview
```

生产构建输出到 `dist/`。项目使用相对资源路径，可部署在独立域名根目录，也可部署在 GitHub Pages 这类仓库子路径。

详细的上线检查、静态托管参数与安全响应头说明见 [`DEPLOYMENT.md`](./DEPLOYMENT.md)。

产品范围、网站层级、推荐逻辑与后续技术路线见 [`docs/MVP_TOP_LEVEL_DESIGN.zh-CN.md`](./docs/MVP_TOP_LEVEL_DESIGN.zh-CN.md)。

## 原型范围

- 全屏电影感视频首页与鼠标视差。
- 基于 OGL/WebGL 的全站光迹光标，并为触屏和减少动态效果模式自动降级。
- 当前情绪、歌曲语言、歌曲类型三步问答。
- 首页文字描述的本地情绪分析入口。
- 本地规则推荐与换一首。
- “符合 / 不太符合”原因反馈与当前浏览器内的实时偏好学习。
- 原创情绪寄语和歌曲推荐理由。
- 网易云音乐、QQ 音乐、酷狗音乐、哔哩哔哩、抖音和 Spotify 搜索跳转。
- “此刻想对你说”输入框与本地匿名保存模拟。

## 曲库结构

- `src/data.ts`：类型、选项、精编歌曲以及统一曲库出口。
- `src/catalog/expanded.ts`：紧凑的批量曲目种子；推荐理由、情绪参数和视觉配色由统一规则生成。
- `src/catalog/validation.ts`：重复 ID、语言、曲风、情绪及最低语言曲目数校验。

当前曲库共 224 首，普通话、粤语、英语、法语、日语、韩语和其他语言各 32 首。新增歌曲优先选择热门或经典曲目。

本原型不上传用户数据，也不在站内播放完整音乐。

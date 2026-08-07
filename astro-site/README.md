# OS 档案馆 · Astro 重构版

这是旧站旁路重构后的生产版本。旧站根目录保持不变，所有实现、生成内容和测试都位于 `astro-site`。

## 已实现

- Astro Content Collections 管理 29 篇文章，schema 校验标题、日期、品牌、路由、封面、媒体和旧地址。
- 13 篇普通图文文章独立静态生成；16 篇富交互文章通过 sandbox 兼容页恢复原 HTML、SVG、横向滚动、脚本和动图。
- 编辑型档案馆首页、ColorOS/OriginOS 双入口、独立 16:9 AVIF/WebP 封面和近期档案卡片。
- 960px 以下无障碍抽屉目录，支持遮罩、焦点循环、Escape、页面滚动锁定、搜索结果统计和 `/` 快捷键。
- ColorOS 16 媒体清单共 59 个视频引用；本地确认 30 个可用、29 个缺失。缺失资源使用明确占位，不再静默黑屏。
- 旧 `articles/*.html` 和首页 hash 地址兼容跳转。
- 页面切换、渐入动画、懒加载、减少动态效果支持，以及逐路由性能预算。
- 内容完整性、29 路由爬行、移动目录、搜索、交互 iframe 和四档响应式自动化测试。

## 开发与验证

```bash
npm install
npm run migrate
npm run dev
```

旧站文章或资源更新后重新运行 `npm run migrate`。迁移不会修改根目录旧站，只会重建 `astro-site` 内的内容、兼容页和媒体清单。

完整验收：

```bash
npm run verify
```

它依次检查内容完整性、Astro 类型、生产构建、性能预算和真实浏览器交互。浏览器测试默认使用 macOS Chrome，也可通过 `PUPPETEER_EXECUTABLE_PATH` 指定浏览器。

## 部署配置

主站保持静态输出。根域部署无需额外配置；GitHub Pages 项目路径部署示例：

```bash
PUBLIC_SITE_URL=https://ricky2036.github.io/ColorOS_Updates_Web \
PUBLIC_BASE_PATH=/ColorOS_Updates_Web/ \
npm run build
```

大型视频和完整 ColorOS 16 微站不进入主站产物。配置媒体 CDN 后，文章页会自动开放完整体验和已归档视频：

```bash
PUBLIC_MEDIA_BASE_URL=https://media.example.com/coloros16 npm run build
```

媒体域名应保留 `video/...` 路径和 `coloros16/` 体验入口，并支持 MP4 字节范围请求、正确 MIME、CORS 与不可变缓存。未配置媒体域名时主站保持轻量，同时显示已归档和缺失数量。

迁移中的缺失或零字节资源记录在 `public/manifests/migration-report.json`，不得通过空异常处理忽略。

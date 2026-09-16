# 构件云踪

构件云踪是一个面向生产制造与施工现场的构件进度管理 Web 应用。项目包含 PC 管理工作台和手机 H5 扫码录入端，数据使用 Cloudflare D1 持久化，照片与 GLB 模型使用 R2 存储。

## 已实现能力

- 项目创建、项目成员角色与项目级数据隔离；
- 构件单条建档、CSV 批量导入、查询、筛选和导出；
- 每个构件自动生成不可枚举的唯一二维码；
- “未录入 → 加工中 → 现场施工 → 安装完成”状态机；
- 出厂、进场里程碑；
- 状态并发版本校验、提交幂等和管理员回退接口；
- 手机拍照/相册上传，图片元数据写入 D1、文件写入 R2；
- GLB 上传、模型版本留档和 Three.js 在线查看；
- 项目进度看板、构件档案、照片和历史时间轴；
- 二维码轮换、照片软删除、项目归档及审计日志接口；
- ChatGPT/Sites 登录身份与项目成员权限；
- 微信开放平台扫码登录、哈希会话与一次性 OAuth state 校验；
- WebMCP 构件查询和进度推进工具。

## 本地运行

环境要求：Node.js 22.13 或更高版本。

```bash
npm install
npm run build
```

首次本地运行前，将已有迁移应用到 D1；`dist/server/wrangler.json` 由上一步构建生成：

```bash
npx wrangler d1 execute site-creator-d1 --local --persist-to .wrangler/state --file=drizzle/0000_public_morgan_stark.sql --config dist/server/wrangler.json
npx wrangler d1 execute site-creator-d1 --local --persist-to .wrangler/state --file=drizzle/0001_hard_cargill.sql --config dist/server/wrangler.json
npm run dev
```

只有在修改 `db/schema.ts` 后，才运行 `npm run db:generate` 生成新的迁移；不要改写已经应用过的迁移文件。

## 微信扫码登录配置

在微信开放平台创建并审核通过“网站应用”，开通微信登录后配置以下服务端环境变量：

- `WECHAT_APP_ID`：网站应用 AppID；
- `WECHAT_APP_SECRET`：网站应用 AppSecret，必须作为密钥保存；
- `WECHAT_REDIRECT_URI`：授权回调完整地址，本项目生产地址为 `https://component-flow.xbohos.chatgpt.site/auth/wechat/callback`。

微信开放平台填写的授权回调域必须与生产域名一致。电脑端使用 `snsapi_login` 展示微信授权二维码，回调成功后创建 30 天的 HttpOnly 安全会话。微信成员首次登录后可以复制自己的成员 ID，由项目管理员分配工厂、现场、查看、审计或管理员角色。

生产构建与代码检查：

```bash
npm run lint
npm run build
```

## 目录

- `app/`：页面、工作台、手机扫码端与 API 路由；
- `db/`：Drizzle 数据结构；
- `drizzle/`：D1 迁移文件；
- `lib/`：领域类型、权限和数据库辅助函数；
- `public/component-import-template.csv`：构件导入模板；
- `.openai/hosting.json`：Sites、D1 和 R2 逻辑绑定。

## 部署说明

项目按照 Cloudflare Worker ESM 运行时构建。生产环境由 Sites 注入 D1、R2 与登录身份，不要将本地数据库文件、令牌或写入凭证提交到 Git。

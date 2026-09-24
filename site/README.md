# 构件云踪

构件云踪是面向构件生产、进场、施工与安装全过程的进度管理应用。项目使用标准 Next.js App Router，部署到腾讯云 CloudBase 云托管；业务数据存储在 CloudBase PostgreSQL，照片和 GLB 模型存储在私有 PG Storage Bucket `goujianyunzong-files`。

## 技术栈

- Next.js App Router，standalone 生产输出
- PostgreSQL + `pg` 统一连接池
- Drizzle ORM PostgreSQL schema 与 migration
- CloudBase JS SDK v3 PG Storage
- React 19、Tailwind CSS 4、Three.js

## 本地运行

需要 Node.js 22.13 或更高版本，以及一个可访问的 PostgreSQL 数据库。

```bash
cp .env.example .env.local
npm install
npm run db:migrate
npm run dev
```

在 `.env.local` 中填写 PostgreSQL、微信登录和 `CLOUDBASE_APIKEY` 服务端配置。CloudBase HTTP 云函数与本地 Storage 测试都使用该 CloudBase API Key 鉴权。任何凭证都不得使用 `NEXT_PUBLIC_` 前缀或提交到 Git。

## 校验

```bash
npm run build
npm run lint
```

生产启动命令为：

```bash
npm start
```

## 数据库 migration

`drizzle/` 只包含 PostgreSQL migration，不复用旧 SQLite migration。修改 `db/schema.ts` 后执行：

```bash
npm run db:generate
npm run db:migrate
```

## CloudBase 云托管部署

1. 在环境 `goujianyunzong-pg-d8d7fzcb258b4d` 的 PostgreSQL 实例创建数据库和用户，并为云托管服务配置网络访问。
2. 在 PG Storage 中确认私有 Bucket `goujianyunzong-files` 已存在，并为云托管工作负载配置所需 Storage 权限。
3. 在同一网络环境中设置 `PGHOST`、`PGPORT`、`PGDATABASE`、`PGUSER`、`PGPASSWORD`，执行 `npm run db:migrate`。
4. 在云托管服务中配置 `.env.example` 所列环境变量与微信回调地址；密码和密钥使用控制台的加密变量。
5. 使用项目根目录的 `Dockerfile` 构建并部署，容器监听 `0.0.0.0:3000`，以 `node server.js` 启动。
6. 部署后验证登录、项目/构件 CRUD、进度事务、照片上传/查看/删除、GLB 上传/查看与二维码入口。

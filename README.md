# NanoMQ Admin Panel

一个基于 Next.js App Router 的 NanoMQ 管理面板，覆盖 Broker 监控、客户端与订阅管理、消息发布、规则/桥接管理、访问控制与配置操作。

## 功能概览

- 仪表板：运行状态、关键指标总览
- 客户端管理：连接客户端查询
- 订阅管理：主题订阅查询
- 消息发布：支持 `publish` 与批量参数
- 实时监控 / 统计分析：基于真实 API 数据
- 系统配置：`/reload` 热更新与 `config_update` 文件更新
- 访问控制：`nanomq_pwd.conf` / `nanomq_acl.conf` 可视化编辑
- 规则引擎：Rules CRUD
- 桥接管理：Bridge 查看与更新

## 技术栈

- Next.js 15
- React 19 + TypeScript
- Tailwind CSS v4
- Axios
- Lucide React

## 快速开始

### 1) 安装依赖

```bash
npm install
```

### 2) 配置环境变量

在项目根目录创建 `.env.local`（或 `.env`）：

```env
NANOMQ_API_URL=http://localhost:8081
NANOMQ_USERNAME=admin
NANOMQ_PASSWORD=public
```

> 页面登录后会把连接配置存储到本地；代理层请求会带 `x-nanomq-auth` 透传认证。

### 3) 开发运行

```bash
npm run dev
```

访问：`http://localhost:3000`

### 4) 构建生产

```bash
npm run build
npm run start
```

## Docker 运行

项目根目录已提供 `Dockerfile`（多阶段构建）：

```bash
docker build -t nanomq-admin:latest .
docker run --rm -p 3000:3000 nanomq-admin:latest
```

## 关键目录

```text
src/
  app/
    (admin)/
      access/          # 访问控制（pwd/acl 文件管理）
      bridges/         # 桥接管理
      clients/         # 客户端
      configuration/   # 配置管理
      monitoring/      # 实时监控
      publish/         # 消息发布
      rules/           # 规则引擎
      statistics/      # 统计分析
      subscriptions/   # 订阅管理
    api/nanomq/        # Next 代理层，转发到 /api/v4/*
  api/
    nanomq.ts          # NanoMQ 前端 API 客户端
    access.ts          # pwd/acl 配置序列化与解析
  layout/
    NanoMQSidebar.tsx  # 左侧导航
```

## 与 NanoMQ API 的关系

本项目通过 Next API 代理访问 NanoMQ v4 接口：

- 代理入口：`/api/nanomq/*`
- 上游入口：`<NANOMQ_API_URL>/api/v4/*`

常用上游接口：

- `GET /brokers`、`GET /nodes`
- `GET /clients`、`GET /subscriptions`
- `POST /mqtt/publish`
- `GET/POST /reload`
- `POST /ctrl/restart`
- `POST /write_file`、`GET /get_file`
- `POST /config_update`

## 访问控制说明（重要）

### 推荐流程

对于 `nanomq_pwd.conf` / `nanomq_acl.conf`：

1. 先 `write_file` 写入文件
2. 再触发重启（或按你当前部署策略使配置重载）

### 已知注意事项

- `config_update` 是**整文件替换**主配置，不是增量 patch。
- 直接提交片段（例如只有 `auth { ... }`）可能导致 Broker 启动异常。
- 某些 NanoMQ 版本在 `auth include` 动态应用路径上存在兼容差异；页面已做了降噪与保护。

## CI/CD 说明

仓库含 `.github/workflows/deploy.yaml`。若用于镜像发布，请确保：

- 存在可用 `Dockerfile`
- 镜像 tag 与仓库 owner 一致
- 登录凭据（PAT 或 `GITHUB_TOKEN`）权限完整

## 开发建议

- 新增管理页：在 `src/app/(admin)/<module>/page.tsx` 添加页面并更新 `NanoMQSidebar.tsx`
- 新增 API：优先在 `src/api/nanomq.ts` 增加方法，再由页面调用
- 涉及配置文件写入时，优先走 `write_file`，慎用 `config_update`

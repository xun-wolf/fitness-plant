# 05 · 部署与运行

## 1. 环境要求

| 组件 | 版本 |
|---|---|
| JDK | 17 |
| Maven | 3.9+ |
| MySQL | 8.0+ |
| Redis | 5.0+（本机 `D:\Redis` 为 5.0.14.1；生产建议 7.x） |
| Node.js | 20.19+ 或 22.12+（仅前端构建需要） |

## 2. 端口约定

| 服务 | 端口 |
|---|---|
| 前端开发服务器 | 5173 |
| 后端 API | 8787 |
| MySQL | 3306 |
| Redis | 6379 |

## 3. 目录

```text
backend/           Spring Boot API
frontend/          前端根目录（Vite root，dist 为构建产物）
docs/              01~05 文档
start.bat          后端启动脚本
server/schema.sql  建表脚本
server/.env        后端环境变量（本地开发配置，不提交）
```

## 4. 环境变量

后端优先读系统环境变量，其次读 `server/.env`（可用 `FITPLAN_ENV_FILE` 指定路径）。

| 变量 | 默认值 | 说明 |
|---|---|---|
| `FITPLAN_API_PORT` | 8787 | 后端端口 |
| `MYSQL_HOST` | 127.0.0.1 | MySQL 地址 |
| `MYSQL_PORT` | 3306 | MySQL 端口 |
| `MYSQL_DATABASE` | fitplan | 数据库名 |
| `MYSQL_USER` | root | 数据库用户 |
| `MYSQL_PASSWORD` | 空 | 数据库密码 |
| `FITPLAN_FRONT` | http://localhost:5173 | 登录成功后跳回的前端地址 |
| `FITPLAN_PUBLIC_BASE` | 空 | 公网访问地址；留空则不能收款 |
| `FITPLAN_ORIGINS` | 空 | CORS 白名单，逗号分隔；留空用默认值 |
| `FITPLAN_SESSION_DAYS` | 30 | 旧会话表清理参考值 |
| `REDIS_HOST` | 127.0.0.1 | Redis 地址 |
| `REDIS_PORT` | 6379 | Redis 端口 |
| `JWT_SECRET` | 本地开发默认值 | JWT 签名密钥，至少 32 位；生产必须覆盖 |
| `JWT_EXPIRE_MINUTES` | 120 | JWT 有效期（分钟） |
| `ADMIN_USERNAME` | 空 | 初始管理员账号；已有管理员时不会覆盖 |
| `ADMIN_PASSWORD` | 空 | 初始管理员密码；首次登录后尽快修改 |
| `ADMIN_NICKNAME` | 管理员 | 初始管理员昵称 |
| `ALIPAY_APP_ID` | 空 | 支付宝应用 ID |
| `ALIPAY_GATEWAY` | 正式网关 | 可切沙箱 |
| `ALIPAY_APP_PRIVATE_KEY` | 空 | 应用私钥（PKCS8） |
| `ALIPAY_APP_PRIVATE_KEY_FILE` | 空 | 应用私钥 PEM 路径 |
| `ALIPAY_PUBLIC_KEY` | 空 | 支付宝公钥 |
| `ALIPAY_PUBLIC_KEY_FILE` | 空 | 支付宝公钥 PEM 路径 |
| `FITPLAN_PRO_PRICE_YUAN` | 8 | Pro 价格（元） |
| `FITPLAN_PRO_DAYS` | 30 | Pro 天数 |
| `FITPLAN_PRO_SUBJECT` | 练 · Pro 会员 | 支付标题 |
| `FITPLAN_SCHEMA_FILE` | 空 | 指定 `schema.sql` 路径 |
| `FITPLAN_ENV_FILE` | 空 | 指定 `.env` 路径 |

> 密钥不要提交到仓库；前后端分离部署时 `FITPLAN_PUBLIC_BASE` 必须是支付宝能访问的 HTTPS 公网地址。

## 5. 启动后端

### 方式一：脚本

```bat
start.bat
```

脚本会先检测 Redis，未启动时拉起 `D:\Redis\redis-server.exe`，然后进入 `backend/` 执行 `mvn -s settings.xml spring-boot:run`。

### 方式二：手动

```bat
D:\Redis\redis-server.exe D:\Redis\redis.windows.conf
cd backend
mvn -s settings.xml clean package
java -jar target\fitplan-api.jar
```

Redis 不可用时后端仍能启动，登录限流会退回单机内存，登出黑名单暂时失效。

首次启动时，如果 `users` 表里没有 `role = 'ADMIN'` 的账号，会按 `ADMIN_USERNAME` / `ADMIN_PASSWORD` 创建一个管理员；已有管理员时不会覆盖。管理员入口在「设置 → 管理后台」，可以停用账号、手填天数开通 VIP、查看操作日志。首次登录后请尽快修改默认管理员密码。

启动后访问 `http://localhost:8787/api/health` 验证：

- `db` 应为 `up`
- `alipay` / `pay` 为 `configured` 才能使用登录和收款

建表流程：`SchemaInitializer` 读取 `server/schema.sql`，先 `CREATE DATABASE IF NOT EXISTS`，再逐条执行建表语句。

## 6. 前端

```bat
cd frontend
npm install
npm run dev
```

- 开发地址：`http://127.0.0.1:5173`
- `/api` 由 Vite 代理到 `http://127.0.0.1:8787`
- 构建：`npm run build`，产物在 `frontend/dist/`

部署时：

1. 将 `frontend/dist/` 作为静态站点根目录
2. 将 `/api` 反向代理到 `http://127.0.0.1:8787`
3. 保证 `index.html`、`assets/`、`icons/`、`manifest.webmanifest`、`sw.js` 可通过根路径访问

前端 API 基地址存于 localStorage 的 `fitplan.api`，默认 `/api`，生产环境建议保持同源反向代理。

## 7. 支付宝配置

1. 在支付宝开放平台创建应用，开通「获取会员信息」和「手机网站支付 / 电脑网站支付」
2. 配置授权回调地址：`{FITPLAN_PUBLIC_BASE}/api/auth/alipay/callback`
3. 配置异步通知地址：`{FITPLAN_PUBLIC_BASE}/api/pay/notify`
4. 将应用私钥和支付宝公钥写入环境变量或 PEM 文件
5. `FITPLAN_FRONT` 指向用户登录后要回到的前端地址
6. `FITPLAN_ORIGINS` 加入前端正式域名，避免 CORS 拒绝

## 8. 反向代理示例（Nginx）

```nginx
server {
    listen 443 ssl;
    server_name example.com;

    root /var/www/fitness-planner/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8787;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 9. 已知阻断项

| 问题 | 影响 | 处理 |
|---|---|---|
| 支付宝凭据未配置 | 支付宝登录与支付不可用 | 配置 `ALIPAY_*` 与 `FITPLAN_PUBLIC_BASE` |
| 本机 Redis 为 5.0.14.1 | 与文档目标 7.x 版本不一致 | 当前登录功能足够；生产建议换 7.x |
| 旧会话失效 | 升级前登录的用户需要重新登录 | 属于预期行为，JWT 取代旧 sessions |
| 无 Docker/CI | 部署依赖手工操作 | 后续补充 |
| 无自动化测试 | 支付、权限、同步逻辑无回归保障 | 后续补充 |

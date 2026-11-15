# 健身计划 FitPlan

本地优先的健身训练与饮食规划应用：按身体档案生成周训练框架和每日清单，记录逐组训练、饮食、体重与腰围；登录后支持云端备份、Pro 订阅和账号管理。

## 功能

- **训练计划**：档案问卷 → 周框架 → 今日训练清单，支持动作替换、跳过与载重调整
- **训练记录**：逐组记录重量、次数、RPE，支持力竭标记和历史回顾
- **动作库**：64 个动作，含部位、器械、难度、要点与替代动作
- **饮食记录**：65 种食物库，按早餐/午餐/晚餐/加餐记录热量与三大营养素
- **目标参考**：TDEE、热量区间、蛋白质目标、体重变化趋势
- **本地优先**：不登录也能使用全部记录功能，数据存本机 `localStorage`
- **账号体系**：账号密码注册/登录、支付宝登录、修改密码、注销账号
- **隐私合规**：注册前必须勾选隐私政策与服务条款
- **云端备份**：整份记录上传/拉回/删除，支持多设备
- **管理后台**：账号搜索、停用/启用、手填天数开通 VIP、订单管理与退款、操作日志
- **操作留痕**：登录、登录失败、退出、注册、改密和管理操作均写入日志
- **PWA**：可安装到主屏，断网可用

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 19、Vite 8、手写 CSS、hash 路由、原生 fetch |
| 后端 | Java 17、Spring Boot 3.3.5、Spring Security 6、JJWT、MyBatis-Plus、SpringDoc |
| 数据库 | MySQL 8（`utf8mb4`，`Asia/Shanghai`） |
| 缓存 | Redis（JWT 黑名单、登录/注册限流） |
| 工具 | Hutool、Lombok、Maven |

## 目录结构

```text
fitness-planner/
├─ backend/          Spring Boot 后端（Maven）
│  ├─ src/main/java/com/fitplan/
│  │  ├─ auth/       认证、JWT、限流
│  │  ├─ admin/      管理后台、审计日志
│  │  ├─ config/     安全、跨域、数据库初始化
│  │  ├─ service/    账号、记录、支付、支付宝
│  │  └─ web/        记录/支付/会话接口
│  └─ settings.xml   Maven 阿里云镜像
├─ frontend/         React 前端（Vite）
│  └─ src/
│     ├─ pages/      页面
│     ├─ lib/        存储、接口、计划与营养算法
│     └─ components/ 通用组件
├─ server/
│  ├─ schema.sql     数据库 DDL（启动时自动执行）
│  └─ .env.example   环境变量模板
├─ docs/             PRD、技术栈、数据库、API、部署文档
└─ start.bat         Windows 一键启动
```

## 本地运行

### 1. 环境要求

- JDK 17+
- Maven 3.9+
- Node.js 18+
- MySQL 8（本机 3306）
- Redis 5+（本机 6379，可选；不可用时登录限流退回内存计数）

### 2. 配置环境变量

```powershell
Copy-Item server\.env.example server\.env
```

编辑 `server/.env`，至少填写 `MYSQL_PASSWORD`，并把 `JWT_SECRET`、`ADMIN_PASSWORD` 换成自己的值。`server/.env` 已被 `.gitignore` 排除，不会进入仓库。

### 3. 启动

Windows 下可直接双击 `start.bat`（会尝试启动 `D:\Redis` 和后端）。

手动启动：

```powershell
# 后端
cd backend
mvn -s settings.xml spring-boot:run

# 前端（另开终端）
cd frontend
npm install
npm run dev
```

数据库和表由后端启动时自动创建（读取 `server/schema.sql`），已有库会自动补列，不需要手工删表。

### 4. 初始管理员

后端首次启动时，如果数据库里还没有 `ADMIN` 账号，会用 `ADMIN_USERNAME` / `ADMIN_PASSWORD` / `ADMIN_NICKNAME` 创建一个；已有管理员不会被覆盖。登录后请尽快在「设置 → 账号」修改默认密码。

## 访问地址

| 服务 | 地址 |
|---|---|
| 前端 | http://127.0.0.1:5173 |
| 后端 | http://127.0.0.1:8787 |
| 健康检查 | http://127.0.0.1:8787/api/health |
| OpenAPI | http://127.0.0.1:8787/swagger-ui/index.html |
| 管理后台 | 管理员登录后进入 `#/admin` |

## 主要配置项

| 变量 | 说明 |
|---|---|
| `MYSQL_*` | 数据库连接 |
| `REDIS_HOST` / `REDIS_PORT` | Redis 地址 |
| `JWT_SECRET` | JWT 签名密钥，生产必须更换 |
| `JWT_EXPIRE_MINUTES` | JWT 有效期，默认 120 分钟 |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` / `ADMIN_NICKNAME` | 初始管理员 |
| `FITPLAN_FRONT` | 支付宝授权后跳回的前端地址 |
| `FITPLAN_ORIGINS` | 允许跨域的来源，逗号分隔 |
| `FITPLAN_PUBLIC_BASE` | 支付宝异步通知的公网地址 |
| `ALIPAY_*` | 支付宝应用凭据，不配置则无法收款与退款 |

完整说明见 [部署文档](docs/05_Deployment.md)。

## 文档

- [01 · 产品需求](docs/01_PRD.md)
- [02 · 技术栈](docs/02_Tech_Stack.md)
- [03 · 数据库设计](docs/03_Database.md)
- [04 · API 接口](docs/04_API.md)
- [05 · 部署说明](docs/05_Deployment.md)

## 安全说明

- 不提交 `server/.env`、构建产物和依赖目录
- 生产环境务必更换 `JWT_SECRET` 与管理员密码
- 密码使用 BCrypt 存储；JWT 登出后进入 Redis 黑名单
- 退款走支付宝真实退款接口，未配置支付宝时会拒绝，不会产生“假退款”

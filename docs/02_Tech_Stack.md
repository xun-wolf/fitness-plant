# 02 · 技术栈与工程结构

## 1. 总览

| 层 | 选型 |
|---|---|
| 前端 | React 19 + Vite 8 + 手写 CSS + 自研 hash 路由 |
| 后端 | Java 17 + Spring Boot 3.3 + Spring Security 6 + JJWT |
| 数据访问 | JdbcTemplate（记录/支付）+ MyBatis-Plus（认证） |
| 数据库 | MySQL 8（utf8mb4，Asia/Shanghai） |
| 缓存 | Redis（JWT 黑名单、登录限流） |
| 登录 | 账号密码 + JWT；支付宝 OAuth 保留 |
| 支付 | 支付宝手机/电脑网站支付 + 异步通知 |
| AI | 浏览器直连 OpenAI 兼容接口（用户自填 Key） |
| 部署 | 前端静态站点 + 独立 Java API（默认 8787） |

## 2. 前端

| 项目 | 版本/说明 |
|---|---|
| React / React DOM | 19.3.0 |
| 构建 | Vite 8.3.4（rolldown 内核）+ @vitejs/plugin-react 6.1.2 |
| 语言 | JavaScript + JSX；有 `jsconfig.json`，未使用 tsconfig |
| 样式 | 单文件手写 CSS，无 UI 框架 |
| 路由 | 自研 hash 路由（`#/train`、`#/settings/...`） |
| 状态 | React Hooks + localStorage，无 Redux/Zustand |
| 请求 | 原生 `fetch`，无 axios |
| PWA | 手写 `manifest.webmanifest` + `sw.js`，无 Workbox |
| 图表/组件库 | 无 |

本地存储键：

- 业务数据：localStorage 主键（由前端状态模块维护）
- `fitplan.api`：API 基地址，默认 `/api`
- `fitplan.token`：登录会话令牌
- `fitplan.contentOpen`：内容展开偏好

## 3. 后端

| 项目 | 版本/说明 |
|---|---|
| Java | 17 |
| Spring Boot | 3.3.5 |
| Web | spring-boot-starter-web（内嵌 Tomcat + Jackson） |
| 安全 | Spring Security 6 + JJWT 0.12.6 |
| 数据访问 | JdbcTemplate（记录/支付）；MyBatis-Plus 3.5.7（认证） |
| 缓存 | Spring Data Redis + StringRedisTemplate |
| 参数校验 | spring-boot-starter-validation |
| 工具库 | Hutool 5.8.32（字符串、ID 生成） |
| 简化样板 | Lombok 1.18.34（实体 Getter/Setter、日志） |
| 接口文档 | SpringDoc OpenAPI 2.6.0 |
| 数据库驱动 | mysql-connector-j |
| 连接池 | HikariCP（maximum-pool-size=5） |
| 定时任务 | `@Scheduled` 每小时清理过期会话与 OAuth state |
| 构建 | Maven，`backend/settings.xml` 配置阿里云镜像 |

包结构：

```text
backend/src/main/java/com/fitplan
├─ FitplanApiApplication.java   # 启动入口，先加载 .env
├─ admin/                       # 管理员初始化、账号停用/VIP、操作日志
├─ auth/                        # 账号密码注册/登录、JWT、Security、限流
│  ├─ common/                   # Result、错误码、认证异常
│  ├─ config/                   # SecurityConfig、MyBatis-Plus、OpenAPI
│  ├─ dto/ entity/ mapper/
│  ├─ security/                 # JwtService、过滤器、Redis 黑名单
│  └─ web/                      # /api/v1/auth/**
├─ config/                      # 配置、CORS、异常、建表、迁移、环境变量
├─ service/                     # 账号、支付、支付宝、记录、JSON 工具
└─ web/                         # AlipayAuth / Session / Plan / Pay / Data / Health
```

## 4. 外部集成

### 4.1 账号密码登录

1. `POST /api/v1/auth/register`：用户名 + 密码 + 昵称，BCrypt 哈希后写 `users`
2. `POST /api/v1/auth/login`：校验密码，签发 2 小时 JWT
3. `GET /api/v1/auth/me`：返回当前账号
4. `POST /api/v1/auth/logout`：把 JWT 的 `jti` 写入 Redis 黑名单
5. 登录限流：同一 IP + 账号每分钟最多 5 次；Redis 不可用时退回单机内存计数

### 4.2 支付宝登录

1. `GET /api/auth/alipay/start` 生成 state 并 302 到支付宝授权页
2. 回调 `GET /api/auth/alipay/callback` 校验 state，用 auth_code 换 token 和 user_id
3. 用户落库，按 `user_id` 签发同一套 JWT
4. 令牌以 `#token=` 片段跳回前端，前端沿用原来的令牌接收逻辑

### 4.3 支付宝支付

- 手机 UA 走 `alipay.trade.wap.pay`，桌面走 `alipay.trade.page.pay`
- RSA2 签名，订单号 = 本机时间 + 随机后缀
- 异步通知先验签、再校验 app_id、金额和订单状态，最后条件更新发货
- 发货幂等：`UPDATE ... WHERE status='created'` 只允许成功一次

### 4.4 大模型

- 协议：OpenAI 兼容的 `/chat/completions`
- 配置：baseURL、apiKey、model 全部存 localStorage
- 调用方：浏览器直接请求，后端不代理、不存储 Key
- 风险：部分模型服务不支持浏览器 CORS，设置页只提供连通性测试

## 5. 目录结构

```text
fitness-planner(1)/
├─ backend/                 # Spring Boot API
│  ├─ src/main/java/com/fitplan/
│  ├─ src/main/resources/application.yml
│  ├─ pom.xml
│  └─ settings.xml
├─ frontend/                # 前端根目录（Vite root）
│  ├─ src/
│  │  ├─ main.jsx           # 入口
│  │  ├─ App.jsx            # hash 路由与全局状态
│  │  ├─ pages/             # 训练、动作、记录、饮食、设置
│  │  ├─ components/        # 通用 UI 与档案表单
│  │  ├─ lib/               # 存储、API、计划、营养、AI
│  │  ├─ data/              # 动作库与食物库
│  │  └─ styles.css         # 手写样式
│  ├─ public/               # manifest、sw.js、图片与图标
│  ├─ dist/                 # 构建产物
│  ├─ package.json
│  └─ vite.config.js        # 开发代理 /api -> 8787
├─ server/
│  └─ schema.sql            # 建表脚本
├─ docs/                    # 01~05 编号文档
└─ start.bat                # 后端启动脚本
```

## 6. 开发约定

- 前后端分离：前端默认请求同源 `/api`，开发时由 Vite 代理到 `http://localhost:8787`
- 端口：前端 5173，后端 8787，MySQL 3306
- 环境变量：后端通过 `server/.env` 或系统环境变量注入，不写死密钥
- 错误格式：所有接口错误统一返回 `{ "error": "..." }`
- 时间：数据库连接时区 Asia/Shanghai；业务日期统一 `YYYY-MM-DD`
- 记录上传：整份覆盖语义，不做字段级合并

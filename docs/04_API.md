# 04 · API 接口说明

## 1. 通用约定

- Base URL：`/api`
- 认证：需要登录的接口带 `Authorization: Bearer <JWT>`
- JWT 有效期：默认 2 小时；登出后 `jti` 进入 Redis 黑名单
- 请求/响应：JSON（支付异步通知为表单）
- 认证接口（`/api/v1/auth/**`）统一返回 `{ code, message, data }`
- 记录/支付等原有接口错误仍返回 `{ "error": "可直接展示给用户的中文说明" }`
- 时间：ISO 8601 字符串；业务日期 `YYYY-MM-DD`
- 跨域：仅白名单 Origin 返回 CORS 头；`OPTIONS` 在白名单内回 204，否则 403

| 状态码 | 含义 |
|---|---|
| 400 | 参数/校验失败 |
| 401 | 未登录或会话失效 |
| 403 | 资源不属于当前用户 |
| 404 | 资源不存在 |
| 413 | 上传体积超限 |
| 500 | 数据库或服务异常 |
| 502 | 支付宝网关异常 |

## 1.4 账号密码认证

| 方法 | 路径 | 说明 | 鉴权 |
|---|---|---|---|
| POST | `/api/v1/auth/register` | 自助注册，注册成功直接返回 JWT | 否 |
| POST | `/api/v1/auth/login` | 账号密码登录 | 否 |
| GET | `/api/v1/auth/me` | 当前登录账号 | 是 |
| POST | `/api/v1/auth/logout` | 登出，JWT 的 `jti` 写入 Redis 黑名单 | 是 |
| POST | `/api/v1/auth/change-password` | 修改密码，同时换发新 JWT | 是 |
| GET | `/api/v1/auth/operation-logs` | 查看自己的最近操作 | 是 |

### POST /api/v1/auth/register

```json
{
  "username": "fituser",
  "password": "Test12345",
  "nickname": "小练",
  "acceptedTerms": true
}
```

- 账号：3-32 位字母、数字或下划线
- 密码：8-64 位
- 昵称可空，默认等于账号
- `acceptedTerms` 必须为 `true`，否则返回 400001「请先阅读并同意隐私政策和服务条款」
- 成功：

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiJ9...",
    "expiresIn": 7200,
    "user": {
      "id": 1,
      "username": "fituser",
      "nickname": "小练",
      "role": "USER",
      "plan": "free",
      "alipayBound": false
    }
  }
}
```

### POST /api/v1/auth/login

```json
{ "username": "fituser", "password": "Test12345" }
```

- 成功结构同上
- 同一 IP + 账号每分钟最多 5 次尝试，超出返回 429001

### GET /api/v1/auth/me

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": 1,
    "username": "fituser",
    "nickname": "小练",
    "role": "USER",
    "plan": "free",
    "alipayBound": false
  }
}
```

### POST /api/v1/auth/logout

```json
{ "code": 200, "message": "success", "data": null }
```

### POST /api/v1/auth/change-password

需要登录。只适用于有本地密码的账号。

```json
{
  "oldPassword": "Test12345",
  "newPassword": "NewPass123",
  "confirmPassword": "NewPass123"
}
```

- 新密码 8-64 位
- 新密码不能与原密码相同
- 当前 JWT 会立即进入 Redis 黑名单，同时返回一枚新 JWT
- 成功响应结构与登录一致，前端直接用返回的 `token` 替换本地令牌
- 支付宝-only 账号没有本地密码，返回 400002「这个账号还没有设置密码」

### 认证错误码

| 错误码 | 含义 |
|---|---|
| 400001 | 参数校验失败 |
| 401001 | 未登录或 JWT 已失效 |
| 401002 | 账号或密码错误 |
| 401003 | 账号已被禁用 |
| 409001 | 账号已被占用 |
| 429001 | 请求过于频繁 |
| 500001 | 服务端异常 |

## 2. 健康检查

### GET /api/health

无需登录。

```json
{
  "ok": true,
  "db": "up",
  "alipay": "configured",
  "pay": "missing:FITPLAN_PUBLIC_BASE（支付宝异步通知要打得到的公网地址）",
  "origins": ["http://localhost:5173"]
}
```

## 3. 登录

### GET /api/auth/alipay/start

- 生成一次性 state，302 跳转支付宝授权页
- 未配置支付宝时返回 400，并列出缺少的配置项

### GET /api/auth/alipay/callback?auth_code=xxx&state=xxx

- 校验 state、换取 `access_token`、读取 `user_id`
- upsert 用户，并按 `user_id` 签发 JWT
- 302 跳回 `{FITPLAN_FRONT}/#token=<JWT>`
- 失败：400（缺 auth_code / state 不匹配）、502（支付宝未返回 user_id）

## 4. 会话

### GET /api/session

需要登录。

```json
{
  "uidTail": "user",
  "username": "fituser",
  "nickname": "小练",
  "alipayUid": null,
  "displayName": "小练",
  "plan": "free",
  "planExpiresAt": null,
  "createdAt": "2026-11-13T10:00:00+08:00",
  "lastLoginAt": "2026-11-13T10:00:00+08:00"
}
```

> 账号密码用户返回 username；支付宝用户返回 alipayUid 尾号。完整 uid 不回前端。

### DELETE /api/session

退出当前设备。

```json
{ "ok": true, "dropped": "session" }
```

### DELETE /api/account

注销账号，级联删除会话、订单和云端记录。

```json
{ "ok": true, "dropped": "account" }
```

## 5. 订阅与支付

### GET /api/plan

需要登录。

```json
{
  "plan": "free",
  "expiresAt": null,
  "price": { "yuan": 8, "days": 30 },
  "payReady": false
}
```

### POST /api/pay/order

需要登录。创建订单并返回收银台跳转地址。

```json
{
  "url": "https://openapi.alipay.com/gateway.do?...&sign=...",
  "outTradeNo": "20261113103000a1b2c3d4",
  "amountYuan": "8.00",
  "days": 30
}
```

- 收款未配置时返回 400
- 手机 UA 走 `alipay.trade.wap.pay`，桌面走 `alipay.trade.page.pay`

### GET /api/pay/order?out_trade_no=xxx

需要登录。从收银台返回后查询订单状态。

```json
{ "status": "paid", "plan": "pro", "expiresAt": "2026-12-13T10:00:00+08:00" }
```

- `status`：`none` / `created` / `paid` / `closed`
- 订单不属于当前用户时返回 403

### POST /api/pay/notify

支付宝服务器异步通知，表单提交，无需会话令牌。

- 验签（RSA2）+ 校验 `app_id` + 校验金额（与 `amount_cent` 比对）+ 校验交易状态
- 成功发货返回纯文本 `success`，否则 `failure`
- 幂等：同一订单只发货一次；重复通知返回 `success`

## 6. 云端记录

### POST /api/data/sync

需要登录。**整份覆盖**：上传的内容就是该用户云端记录的全集。

请求体：

```json
{
  "profile": { "sex": "male", "age": 28, "heightCm": 178 },
  "onboarded": true,
  "favorites": ["front-squat"],
  "framework": { "id": "fw-1", "startDate": "2026-11-13", "weeksTotal": 4 },
  "sheets": [],
  "setLogs": [],
  "activityLogs": [],
  "mealLogs": [],
  "measureLogs": []
}
```

响应：

```json
{
  "ok": true,
  "saved": {
    "profiles": 1,
    "frameworks": 1,
    "day_sheets": 0,
    "set_logs": 0,
    "activity_logs": 0,
    "meal_logs": 0,
    "measure_logs": 0
  },
  "syncedAt": "2026-11-13T10:30:00+08:00"
}
```

限制与校验：

- 请求体 ≤ 8 MB，否则 413
- `profile` 必填且必须是对象
- 五类列表必须是数组，每类 ≤ 20000 行
- `activityLogs[].kind`：`cardio` / `sport` / `lift` / `walk` / `other`
- `mealLogs[].slot`：`breakfast` / `lunch` / `dinner` / `snack`
- `measureLogs[]` 的体重和腰围至少填一个
- 日期必须是 `YYYY-MM-DD`；ID 仅允许字母、数字、`_ : . -`

### GET /api/data

需要登录。返回上传时的完整结构，额外带 `syncedAt`。

- 云端没有记录时返回 404
- 各列表按日期正序返回

### DELETE /api/data

需要登录。清空该用户云端记录。

```json
{ "ok": true, "dropped": "records" }
```

## 7. 调用示例

```bash
# 注册并拿到 JWT
curl -X POST http://localhost:8787/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"fituser","password":"Test12345","nickname":"小练"}'

# 登录
curl -X POST http://localhost:8787/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"fituser","password":"Test12345"}'

# 当前账号
curl -H "Authorization: Bearer <token>" http://localhost:8787/api/session

# 上传整份记录
curl -X POST http://localhost:8787/api/data/sync \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  --data-binary @records.json

# 拉回云端记录
curl -H "Authorization: Bearer <token>" http://localhost:8787/api/data
```

OpenAPI 文档：`http://localhost:8787/swagger-ui/index.html`

## 8. 管理后台

所有接口要求 `role = ADMIN`，非管理员返回 403。

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/admin/users` | 账号分页，支持 `keyword`、`pageNum`、`pageSize` |
| GET | `/api/v1/admin/users/{id}` | 账号详情 |
| PATCH | `/api/v1/admin/users/{id}/status` | 停用/启用，body `{ "status": 0 }` |
| POST | `/api/v1/admin/users/{id}/vip` | 手填天数开通 VIP，body `{ "days": 30 }` |
| GET | `/api/v1/admin/operation-logs` | 全量操作日志分页 |
| GET | `/api/v1/admin/orders` | 订单分页，支持 `keyword`、`status`、`pageNum`、`pageSize` |
| POST | `/api/v1/admin/orders/{outTradeNo}/close` | 关闭待支付订单 |
| POST | `/api/v1/admin/orders/{outTradeNo}/refund` | 已支付订单全额退款 |

订单状态：`created`（待支付）、`paid`（已支付）、`closed`（已关闭）、`refunded`（已退款）。

约束：

- 管理员不能停用自己
- 至少保留一个启用中的管理员
- 停用账号保留用户名，不允许同用户名重新注册
- VIP 从「当前到期时间」和「现在」中较晚的那个开始顺延
- 仅 `created` 状态可关闭；支付宝已配置时同步调用 `alipay.trade.close`
- 仅 `paid` 状态可退款；退款调用 `alipay.trade.refund` 全额退回，成功后订单转 `refunded`，并从账号扣回该单对应 VIP 天数
- 支付宝未配置时拒绝退款并返回缺少的配置项
- 管理操作全部写入 `operation_log`

## 9. 待补

- 部分退款、退款原因留档、订阅变更记录
- Pro 权益校验（当前仅返回状态，不拦截任何接口）
- Token 刷新、支付宝绑定本地账号、找回密码

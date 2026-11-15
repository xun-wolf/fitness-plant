# 03 · 数据库设计

> 说明：完整 DDL 位于 `server/schema.sql`，由 `SchemaInitializer` 在启动时逐条执行。本文档与该文件保持一致。

## 1. 基础信息

- 数据库：MySQL 8
- 库名：`fitplan`（可由 `MYSQL_DATABASE` 覆盖）
- 字符集：`utf8mb4`
- 时区：`Asia/Shanghai`
- 连接串：`jdbc:mysql://127.0.0.1:3306/fitplan?...&serverTimezone=Asia/Shanghai`

## 2. 表清单

| 表 | 用途 | 归属 |
|---|---|---|
| `users` | 账号、订阅状态 | 账号 |
| `sessions` | 登录会话（只存令牌哈希） | 账号 |
| `oauth_states` | 支付宝授权一次性 state | 账号 |
| `orders` | 支付订单 | 支付 |
| `profiles` | 用户档案与偏好 | 记录 |
| `frameworks` | 周框架 | 记录 |
| `day_sheets` | 今日训练清单 | 记录 |
| `set_logs` | 逐组训练记录 | 记录 |
| `activity_logs` | 其他运动记录 | 记录 |
| `meal_logs` | 饮食记录 | 记录 |
| `measure_logs` | 体重/腰围打卡 | 记录 |

## 3. 表结构

### 3.1 users

账号表同时承载账号密码用户和支付宝用户。

| 字段 | 说明 |
|---|---|
| `id` | 主键，BIGINT |
| `alipay_uid` | 支付宝用户 ID，可空，唯一 |
| `username` | 账号密码登录名，可空，唯一 |
| `password_hash` | BCrypt 密文，支付宝用户可空 |
| `nickname` | 昵称 |
| `role` | `USER` / `ADMIN`，默认 `USER` |
| `status` | 1 正常，0 禁用 |
| `plan` | `free` / `pro` |
| `plan_expires_at` | Pro 到期时间 |
| `created_at` | 注册时间 |
| `last_login_at` | 最近登录时间 |

> 已有库由 `SchemaMigrator` 幂等补列：`username`、`password_hash`、`nickname`、`role`、`status`，并把 `alipay_uid` 放宽为可空。不需要手工删表。

### 3.2 sessions（历史表）

JWT 上线后不再写入新会话，表先保留用于兼容和清理旧数据。

| 字段 | 说明 |
|---|---|
| `token_hash` | 旧会话令牌 SHA-256，唯一 |
| `user_id` | 关联 `users.id` |
| `expires_at` | 过期时间 |

### 3.3 oauth_states

| 字段 | 说明 |
|---|---|
| `state` | 一次性随机串，唯一 |
| `created_at` | 创建时间，2 小时后清理 |

### 3.4 orders

| 字段 | 说明 |
|---|---|
| `out_trade_no` | 商户订单号，唯一 |
| `user_id` | 关联 `users.id` |
| `plan` | 购买套餐，当前固定 `pro` |
| `days` | 购买天数 |
| `amount_cent` | 金额（分），对账只用这个字段 |
| `status` | `created` → `paid` → `refunded`；异常关闭为 `closed` |
| `trade_no` | 支付宝交易号 |
| `created_at` / `paid_at` / `refunded_at` | 创建/支付/退款时间 |

### 3.5 profiles

每用户一行，同时承载档案与前端状态。

| 字段 | 说明 |
|---|---|
| `user_id` | 关联 `users.id` |
| `sex` | `male` / `female` |
| `age` / `height_cm` / `weight_kg` / `body_fat_pct` | 身体数据 |
| `experience_years` / `last_solid_block` | 训练年限、上次认真练完一轮的日期 |
| `injuries` | JSON 数组，伤病部位 |
| `injuries_answered` | 是否回答过伤病问题 |
| `commercial_gym` | 是否有商业健身房（可空） |
| `extra_equipment` | 其他器械说明 |
| `weekdays` | JSON 数组，每周可练星期 |
| `session_minutes` | 单次训练时长 |
| `goal_wish` | 用户原话目标 |
| `goal` | JSON，模型解析后的目标 |
| `sleep_hours` / `daily_steps` | 睡眠、步数 |
| `diet_restrictions` | 饮食限制 |
| `no_cardio` / `home_only` | 不做有氧 / 只在家练 |
| `avoid_names` | JSON 数组，需回避的动作 |
| `day_areas` | JSON 对象，每天选择的部位 |
| `onboarded` | 是否完成引导 |
| `favorites` | JSON 数组，收藏动作 |
| `uploaded_at` | 最近一次云端上传时间 |

### 3.6 frameworks

| 字段 | 说明 |
|---|---|
| `user_id` | 关联 `users.id` |
| `framework_id` | 前端生成的框架 ID |
| `start_date` | 起始日 |
| `created_ts` | 生成时间（客户端字符串） |
| `weeks_total` | 周期周数，默认 4 |
| `days` / `weeks` / `rules` / `assumed` | JSON 数组 |
| `goal` | JSON，目标快照 |

### 3.7 day_sheets

| 字段 | 说明 |
|---|---|
| `user_id` | 关联 `users.id` |
| `sheet_id` | 今日表 ID |
| `day_date` | 训练日期 |
| `weekday` | 星期 |
| `focus` | 当天练哪里 |
| `budget_minutes` | 时间预算 |
| `load_adjust_pct` | 载重调整百分比 |
| `input` / `slots` / `overrides` / `skipped` / `assumed` / `flags` / `dropped` | JSON，生成输入与动作槽位 |
| `created_ts` | 生成时间 |

### 3.8 set_logs

| 字段 | 说明 |
|---|---|
| `user_id` | 关联 `users.id` |
| `sheet_id` / `slot_id` / `ex_id` | 今日表、动作行、动作 ID |
| `set_idx` | 第几组（从 0 开始） |
| `day_date` | 训练日期 |
| `weight_kg` / `reps` / `target_reps` / `rpe` | 重量、次数、目标次数、RPE |
| `to_failure` | 是否力竭 |
| `done_ts` | 完成时间 |

### 3.9 activity_logs

| 字段 | 说明 |
|---|---|
| `user_id` | 关联 `users.id` |
| `log_id` | 记录 ID |
| `day_date` | 日期 |
| `name` | 做了什么 |
| `minutes` | 时长 |
| `kind` | `cardio` / `sport` / `lift` / `walk` / `other` |
| `feel` | 1~5 |
| `areas` / `ex_ids` | JSON 数组 |
| `note` | 备注 |
| `logged_ts` | 记录时间 |

### 3.10 meal_logs

| 字段 | 说明 |
|---|---|
| `user_id` | 关联 `users.id` |
| `log_id` | 记录 ID |
| `day_date` | 日期 |
| `slot` | `breakfast` / `lunch` / `dinner` / `snack` |
| `name` | 吃了什么 |
| `kcal` / `protein_g` / `carbs_g` / `fat_g` / `sugar_g` / `sodium_mg` | 营养数据 |
| `note` / `logged_ts` | 备注与时间 |

### 3.11 measure_logs

| 字段 | 说明 |
|---|---|
| `user_id` | 关联 `users.id` |
| `log_id` | 打卡 ID |
| `day_date` | 日期 |
| `weight_kg` / `waist_cm` | 体重、腰围（至少填一个） |
| `note` / `logged_ts` | 备注与时间 |

### 3.12 operation_log

操作留痕表，只追加，不提供修改/删除接口。

| 字段 | 说明 |
|---|---|
| `id` | 主键 |
| `operator_id` | 操作人 `users.id`，登录失败时为空 |
| `operator_name` | 操作人账号快照 |
| `operator_role` | `USER` / `ADMIN` |
| `action` | `LOGIN_SUCCESS` / `LOGIN_FAILED` / `LOGOUT` / `REGISTER_SUCCESS` / `CHANGE_PASSWORD` / `ADMIN_DISABLE_USER` / `ADMIN_ENABLE_USER` / `ADMIN_GRANT_VIP` / `ADMIN_CLOSE_ORDER` / `ADMIN_REFUND_ORDER` |
| `target_type` / `target_id` | 操作对象 |
| `result` | `SUCCESS` / `FAILURE` |
| `detail` | 补充说明 |
| `ip` / `user_agent` | 请求来源 |
| `created_at` | 操作时间 |

## 4. 关系与约束

```text
users 1 ── N sessions
users 1 ── N orders
users 1 ── 1 profiles
users 1 ── 1 frameworks
users 1 ── N day_sheets / set_logs / activity_logs / meal_logs / measure_logs
```

- `users` 删除时，会话、订单、记录应级联删除（代码注释已说明外键 `ON DELETE CASCADE`）
- `users.alipay_uid` 唯一，保证同一支付宝账号只对应一个用户
- `sessions.token_hash` 唯一，令牌明文不落库
- `orders.out_trade_no` 唯一，支付通知按它定位订单
- 云端记录为整份覆盖：上传时先删除该用户所有记录，再批量插入
- `operation_log` 不设外键，避免用户注销时把审计记录一起删掉

## 5. 数据约定

- 业务日期：`YYYY-MM-DD`
- 客户端时间戳：按原字符串存储，服务器只额外记录 `uploaded_at`
- JSON 字段：以文本形式存储，读取时反序列化
- 金额：统一用「分」的整数字段 `amount_cent`，避免浮点误差
- 单次上传限制：请求体 ≤ 8 MB，每类记录 ≤ 20000 行

## 6. 待补

- 数据库迁移方案：当前只有 `CREATE TABLE IF NOT EXISTS`，无版本管理
- 备份与恢复策略

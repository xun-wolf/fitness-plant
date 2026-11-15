-- 练 · 数据库结构
-- 由 SchemaInitializer 在启动时逐条执行；所有语句必须保持 IF NOT EXISTS，可重复执行。

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  alipay_uid VARCHAR(64) NULL,
  username VARCHAR(32) NULL,
  password_hash VARCHAR(100) NULL,
  nickname VARCHAR(32) NULL,
  role VARCHAR(16) NOT NULL DEFAULT 'USER',
  status TINYINT NOT NULL DEFAULT 1,
  plan VARCHAR(16) NOT NULL DEFAULT 'free',
  plan_expires_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_users_alipay_uid (alipay_uid),
  UNIQUE KEY uk_users_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
  token_hash CHAR(64) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (token_hash),
  KEY idx_sessions_user (user_id),
  KEY idx_sessions_expires (expires_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS oauth_states (
  state VARCHAR(64) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (state),
  KEY idx_oauth_states_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
  out_trade_no VARCHAR(64) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  plan VARCHAR(16) NOT NULL DEFAULT 'pro',
  days INT NOT NULL,
  amount_cent BIGINT NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'created',
  trade_no VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at DATETIME NULL,
  refunded_at DATETIME NULL,
  PRIMARY KEY (out_trade_no),
  KEY idx_orders_user (user_id),
  KEY idx_orders_status (status),
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS profiles (
  user_id BIGINT UNSIGNED NOT NULL,
  sex VARCHAR(8) NULL,
  age DOUBLE NULL,
  height_cm DOUBLE NULL,
  weight_kg DOUBLE NULL,
  body_fat_pct DOUBLE NULL,
  experience_years DOUBLE NULL,
  last_solid_block DATE NULL,
  injuries JSON NULL,
  injuries_answered TINYINT(1) NOT NULL DEFAULT 0,
  commercial_gym TINYINT(1) NULL,
  extra_equipment VARCHAR(500) NULL,
  weekdays JSON NULL,
  session_minutes DOUBLE NULL,
  goal_wish VARCHAR(1000) NULL,
  goal JSON NULL,
  sleep_hours DOUBLE NULL,
  daily_steps DOUBLE NULL,
  diet_restrictions VARCHAR(500) NULL,
  no_cardio TINYINT(1) NOT NULL DEFAULT 0,
  home_only TINYINT(1) NOT NULL DEFAULT 0,
  avoid_names JSON NULL,
  day_areas JSON NULL,
  onboarded TINYINT(1) NOT NULL DEFAULT 0,
  favorites JSON NULL,
  uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_profiles_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS frameworks (
  user_id BIGINT UNSIGNED NOT NULL,
  framework_id VARCHAR(40) NOT NULL,
  start_date DATE NOT NULL,
  created_ts VARCHAR(32) NOT NULL,
  weeks_total INT NOT NULL DEFAULT 4,
  days JSON NULL,
  weeks JSON NULL,
  rules JSON NULL,
  goal JSON NULL,
  assumed JSON NULL,
  PRIMARY KEY (user_id, framework_id),
  CONSTRAINT fk_frameworks_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS day_sheets (
  user_id BIGINT UNSIGNED NOT NULL,
  sheet_id VARCHAR(40) NOT NULL,
  day_date DATE NOT NULL,
  weekday INT NOT NULL DEFAULT 0,
  focus VARCHAR(40) NULL,
  budget_minutes INT NOT NULL DEFAULT 0,
  load_adjust_pct DECIMAL(8,2) NOT NULL DEFAULT 0,
  input JSON NULL,
  slots JSON NULL,
  overrides JSON NULL,
  skipped JSON NULL,
  assumed JSON NULL,
  flags JSON NULL,
  dropped JSON NULL,
  created_ts VARCHAR(32) NOT NULL,
  PRIMARY KEY (user_id, sheet_id),
  KEY idx_day_sheets_date (user_id, day_date),
  CONSTRAINT fk_day_sheets_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS set_logs (
  user_id BIGINT UNSIGNED NOT NULL,
  sheet_id VARCHAR(40) NOT NULL,
  slot_id VARCHAR(48) NOT NULL,
  set_idx INT NOT NULL,
  ex_id VARCHAR(48) NOT NULL,
  day_date DATE NOT NULL,
  weight_kg DOUBLE NULL,
  reps DOUBLE NULL,
  target_reps DOUBLE NOT NULL DEFAULT 0,
  rpe DOUBLE NULL,
  to_failure TINYINT(1) NOT NULL DEFAULT 0,
  done_ts VARCHAR(32) NOT NULL,
  PRIMARY KEY (user_id, sheet_id, slot_id, set_idx),
  KEY idx_set_logs_date (user_id, day_date),
  CONSTRAINT fk_set_logs_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS activity_logs (
  user_id BIGINT UNSIGNED NOT NULL,
  log_id VARCHAR(40) NOT NULL,
  day_date DATE NOT NULL,
  name VARCHAR(500) NOT NULL,
  minutes DOUBLE NOT NULL DEFAULT 0,
  kind VARCHAR(16) NOT NULL,
  feel DOUBLE NULL,
  areas JSON NULL,
  ex_ids JSON NULL,
  note VARCHAR(1000) NULL,
  logged_ts VARCHAR(32) NOT NULL,
  PRIMARY KEY (user_id, log_id),
  KEY idx_activity_logs_date (user_id, day_date),
  CONSTRAINT fk_activity_logs_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS meal_logs (
  user_id BIGINT UNSIGNED NOT NULL,
  log_id VARCHAR(40) NOT NULL,
  day_date DATE NOT NULL,
  slot VARCHAR(16) NOT NULL,
  name VARCHAR(500) NOT NULL,
  kcal DOUBLE NULL,
  protein_g DOUBLE NULL,
  carbs_g DOUBLE NULL,
  fat_g DOUBLE NULL,
  sugar_g DOUBLE NULL,
  sodium_mg DOUBLE NULL,
  note VARCHAR(1000) NULL,
  logged_ts VARCHAR(32) NOT NULL,
  PRIMARY KEY (user_id, log_id),
  KEY idx_meal_logs_date (user_id, day_date),
  CONSTRAINT fk_meal_logs_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS measure_logs (
  user_id BIGINT UNSIGNED NOT NULL,
  log_id VARCHAR(40) NOT NULL,
  day_date DATE NOT NULL,
  weight_kg DOUBLE NULL,
  waist_cm DOUBLE NULL,
  note VARCHAR(1000) NULL,
  logged_ts VARCHAR(32) NOT NULL,
  PRIMARY KEY (user_id, log_id),
  KEY idx_measure_logs_date (user_id, day_date),
  CONSTRAINT fk_measure_logs_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS operation_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  operator_id BIGINT UNSIGNED NULL,
  operator_name VARCHAR(64) NULL,
  operator_role VARCHAR(16) NULL,
  action VARCHAR(64) NOT NULL,
  target_type VARCHAR(32) NULL,
  target_id BIGINT UNSIGNED NULL,
  result VARCHAR(16) NOT NULL DEFAULT 'SUCCESS',
  detail VARCHAR(1000) NULL,
  ip VARCHAR(64) NULL,
  user_agent VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_log_operator (operator_id, created_at),
  KEY idx_log_action (action, created_at),
  KEY idx_log_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

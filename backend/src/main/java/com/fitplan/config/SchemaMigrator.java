package com.fitplan.config;

import jakarta.annotation.PostConstruct;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.DependsOn;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * 已有的库不会因为 schema.sql 多了字段就自动加列，这里做一次幂等迁移。
 * 只做增量：加列、放宽 alipay_uid、补唯一索引，不删不改已有数据。
 */
@Component
@DependsOn("schemaInitializer")
public class SchemaMigrator {

    private static final Logger log = LoggerFactory.getLogger(SchemaMigrator.class);

    private static final List<String[]> COLUMNS = List.of(
        new String[] {"username", "ALTER TABLE users ADD COLUMN username VARCHAR(32) NULL AFTER alipay_uid"},
        new String[] {"password_hash", "ALTER TABLE users ADD COLUMN password_hash VARCHAR(100) NULL AFTER username"},
        new String[] {"nickname", "ALTER TABLE users ADD COLUMN nickname VARCHAR(32) NULL AFTER password_hash"},
        new String[] {"role", "ALTER TABLE users ADD COLUMN role VARCHAR(16) NOT NULL DEFAULT 'USER' AFTER nickname"},
        new String[] {"status", "ALTER TABLE users ADD COLUMN status TINYINT NOT NULL DEFAULT 1 AFTER role"}
    );

    private final JdbcTemplate jdbc;

    public SchemaMigrator(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @PostConstruct
    public void migrate() {
        try {
            Integer tables = jdbc.queryForObject(
                "SELECT COUNT(*) FROM information_schema.TABLES"
                    + " WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'",
                Integer.class);
            if (tables == null || tables == 0) {
                return;
            }
            int added = 0;
            for (String[] column : COLUMNS) {
                if (!hasColumn(column[0])) {
                    jdbc.execute(column[1]);
                    added += 1;
                }
            }
            if (!isNullable("alipay_uid")) {
                jdbc.execute("ALTER TABLE users MODIFY COLUMN alipay_uid VARCHAR(64) NULL");
                added += 1;
            }
            if (!hasIndex("uk_users_username")) {
                jdbc.execute("ALTER TABLE users ADD UNIQUE KEY uk_users_username (username)");
                added += 1;
            }
            if (added > 0) {
                log.info("[fitplan-api] users 表登录字段迁移完成（{} 项）", added);
            }
        } catch (Exception e) {
            log.warn("[fitplan-api] users 表登录字段迁移没跑完：{}", e.getMessage());
        }
        migrateOrders();
    }

    private void migrateOrders() {
        try {
            Integer tables = jdbc.queryForObject(
                "SELECT COUNT(*) FROM information_schema.TABLES"
                    + " WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders'",
                Integer.class);
            if (tables == null || tables == 0) {
                return;
            }
            if (!hasColumn("orders", "refunded_at")) {
                jdbc.execute("ALTER TABLE orders ADD COLUMN refunded_at DATETIME NULL AFTER paid_at");
                log.info("[fitplan-api] orders 表增加退款时间字段");
            }
        } catch (Exception e) {
            log.warn("[fitplan-api] orders 表迁移没跑完：{}", e.getMessage());
        }
    }

    private boolean hasColumn(String column) {
        return hasColumn("users", column);
    }

    private boolean hasColumn(String table, String column) {
        Integer count = jdbc.queryForObject(
            "SELECT COUNT(*) FROM information_schema.COLUMNS"
                + " WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
            Integer.class, table, column);
        return count != null && count > 0;
    }

    private boolean hasIndex(String index) {
        Integer count = jdbc.queryForObject(
            "SELECT COUNT(*) FROM information_schema.STATISTICS"
                + " WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = ?",
            Integer.class, index);
        return count != null && count > 0;
    }

    private boolean isNullable(String column) {
        String nullable = jdbc.queryForObject(
            "SELECT IS_NULLABLE FROM information_schema.COLUMNS"
                + " WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = ?",
            String.class, column);
        return "YES".equalsIgnoreCase(nullable);
    }
}

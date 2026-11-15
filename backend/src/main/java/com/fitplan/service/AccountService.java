package com.fitplan.service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 用户、OAuth state、订单这些表的基础读写；登录态改由 JWT 负责。 */
@Service
public class AccountService {

    private static final Logger log = LoggerFactory.getLogger(AccountService.class);

    private final JdbcTemplate jdbc;

    public AccountService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public boolean dbUp() {
        try {
            jdbc.queryForObject("SELECT 1", Integer.class);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    public void putState(String state) {
        jdbc.update("INSERT INTO oauth_states (state) VALUES (?)", state);
    }

    /** 到期的 OAuth state 不在库里堆着：服务起来跑一次，之后每小时一次。 */
    public Map<String, Object> purgeExpired() {
        int sessions = jdbc.update("DELETE FROM sessions WHERE expires_at <= NOW()");
        int states = jdbc.update("DELETE FROM oauth_states WHERE created_at < DATE_SUB(NOW(), INTERVAL 2 HOUR)");
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("sessions", sessions);
        out.put("states", states);
        return out;
    }

    /** 一次性：取到就删，顺带把过期的东西清掉。 */
    public boolean takeState(String state) {
        List<String> rows = jdbc.queryForList(
            "SELECT state FROM oauth_states WHERE state = ? LIMIT 1", String.class, state);
        jdbc.update("DELETE FROM oauth_states WHERE state = ?", state);
        purgeExpired();
        return !rows.isEmpty();
    }

    public long upsertUser(String alipayUid) {
        jdbc.update(
            "INSERT INTO users (alipay_uid, last_login_at) VALUES (?, NOW())"
                + " ON DUPLICATE KEY UPDATE last_login_at = NOW()",
            alipayUid);
        Long id = jdbc.queryForObject("SELECT id FROM users WHERE alipay_uid = ? LIMIT 1", Long.class, alipayUid);
        if (id == null) {
            throw new IllegalStateException("刚写进去的用户读不回来：" + alipayUid);
        }
        return id;
    }

    public void createOrder(String outTradeNo, long userId, int days, long amountCent) {
        jdbc.update(
            "INSERT INTO orders (out_trade_no, user_id, plan, days, amount_cent) VALUES (?, ?, ?, ?, ?)",
            outTradeNo, userId, "pro", days, amountCent);
    }

    public Map<String, Object> getOrder(String outTradeNo) {
        if (outTradeNo == null || outTradeNo.isBlank()) {
            return null;
        }
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT out_trade_no, user_id, plan, days, amount_cent, status, trade_no, created_at, paid_at"
                + " FROM orders WHERE out_trade_no = ? LIMIT 1",
            outTradeNo);
        return rows.isEmpty() ? null : rows.get(0);
    }

    /**
     * 发货：先把订单从 created 推到 paid，这条 UPDATE 只有一次机会（更新行数说了算），
     * 抢到了才加天数 —— 支付宝会把同一份通知重发很多次，幂等靠的就是这道闸。
     */
    @Transactional
    public boolean fulfill(String outTradeNo, String tradeNo) {
        int hit = jdbc.update(
            "UPDATE orders SET status = 'paid', paid_at = NOW(), trade_no = ?"
                + " WHERE out_trade_no = ? AND status = 'created'",
            tradeNo, outTradeNo);
        if (hit == 0) {
            return false;
        }
        Map<String, Object> order = jdbc.queryForMap(
            "SELECT user_id, days FROM orders WHERE out_trade_no = ? LIMIT 1", outTradeNo);
        Object days = order.get("days");
        Object userId = order.get("user_id");
        // 还没到期就在原到期日后续加，已经过期就从今天起算
        jdbc.update(
            "UPDATE users SET plan = 'pro',"
                + " plan_expires_at = DATE_ADD(GREATEST(COALESCE(plan_expires_at, NOW()), NOW()), INTERVAL ? DAY)"
                + " WHERE id = ?",
            days, userId);
        return true;
    }

    public void closeOrder(String outTradeNo) {
        jdbc.update("UPDATE orders SET status = 'closed' WHERE out_trade_no = ? AND status = 'created'", outTradeNo);
    }

    public void deleteUser(long userId) {
        jdbc.update("DELETE FROM users WHERE id = ?", userId);
    }

    @EventListener(ApplicationReadyEvent.class)
    public void sweepOnStart() {
        sweep();
    }

    @Scheduled(fixedDelay = 3600000L, initialDelay = 3600000L)
    public void sweep() {
        try {
            Map<String, Object> cleared = purgeExpired();
            int states = (Integer) cleared.get("states");
            if (states > 0) {
                log.info("[fitplan-api] 清了 {} 个放凉的 OAuth state", states);
            }
        } catch (Exception e) {
            log.warn("[fitplan-api] 这轮清理没跑成：{}", e.getMessage());
        }
    }
}

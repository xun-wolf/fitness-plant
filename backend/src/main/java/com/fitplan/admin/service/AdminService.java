package com.fitplan.admin.service;

import cn.hutool.core.util.StrUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fitplan.admin.dto.AdminOrderView;
import com.fitplan.admin.dto.AdminUserView;
import com.fitplan.admin.dto.OperationLogView;
import com.fitplan.admin.dto.PageResult;
import com.fitplan.admin.entity.OperationLog;
import com.fitplan.admin.mapper.OperationLogMapper;
import com.fitplan.auth.entity.SysUser;
import com.fitplan.auth.mapper.SysUserMapper;
import com.fitplan.auth.security.AuthUser;
import com.fitplan.config.ApiException;
import com.fitplan.service.AlipayClient;
import com.fitplan.service.PayService;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AdminService {

    private final SysUserMapper users;
    private final OperationLogMapper logs;
    private final AuditService audit;
    private final AlipayClient alipay;
    private final JdbcTemplate jdbc;

    public PageResult<AdminUserView> pageUsers(String keyword, int pageNum, int pageSize) {
        int num = Math.max(1, pageNum);
        int size = Math.max(1, Math.min(100, pageSize));
        LambdaQueryWrapper<SysUser> wrapper = new LambdaQueryWrapper<>();
        if (StrUtil.isNotBlank(keyword)) {
            String value = keyword.trim();
            wrapper.and(query -> query.like(SysUser::getUsername, value)
                .or()
                .like(SysUser::getNickname, value));
        }
        wrapper.orderByDesc(SysUser::getId);
        Page<SysUser> page = users.selectPage(new Page<>(num, size), wrapper);
        List<AdminUserView> list = page.getRecords().stream().map(this::view).toList();
        return new PageResult<>(page.getTotal(), page.getCurrent(), page.getSize(), list);
    }

    public AdminUserView user(long id) {
        return view(requireUser(id));
    }

    public AdminUserView setStatus(AuthUser admin, long id, int status, String ip, String userAgent) {
        SysUser target = requireUser(id);
        if (admin.id() == id && status == 0) {
            throw new ApiException(400, "不能停用当前登录的管理员");
        }
        if (status == 0 && "ADMIN".equals(target.getRole())) {
            Long activeAdmins = users.selectCount(new LambdaQueryWrapper<SysUser>()
                .eq(SysUser::getRole, "ADMIN")
                .eq(SysUser::getStatus, 1));
            if (activeAdmins != null && activeAdmins <= 1) {
                throw new ApiException(400, "至少保留一个启用中的管理员");
            }
        }
        users.update(null, new LambdaUpdateWrapper<SysUser>()
            .eq(SysUser::getId, id)
            .set(SysUser::getStatus, status));
        target.setStatus(status);
        audit.record(
            status == 1 ? "ADMIN_ENABLE_USER" : "ADMIN_DISABLE_USER",
            "SUCCESS", admin.id(), admin.username(), admin.role(),
            "USER", id, status == 1 ? "启用账号" : "停用账号", ip, userAgent);
        return view(target);
    }

    public AdminUserView grantVip(AuthUser admin, long id, int days, String ip, String userAgent) {
        requireUser(id);
        jdbc.update(
            "UPDATE users SET plan = 'pro',"
                + " plan_expires_at = DATE_ADD(GREATEST(COALESCE(plan_expires_at, NOW()), NOW()), INTERVAL ? DAY)"
                + " WHERE id = ?",
            days, id);
        AdminUserView result = view(requireUser(id));
        audit.record("ADMIN_GRANT_VIP", "SUCCESS", admin.id(), admin.username(), admin.role(),
            "USER", id, "开通 " + days + " 天", ip, userAgent);
        return result;
    }

    public PageResult<AdminOrderView> pageOrders(String keyword, String status, int pageNum, int pageSize) {
        int num = Math.max(1, pageNum);
        int size = Math.max(1, Math.min(100, pageSize));
        StringBuilder where = new StringBuilder(" WHERE 1 = 1");
        List<Object> args = new ArrayList<>();
        if (StrUtil.isNotBlank(status)) {
            where.append(" AND o.status = ?");
            args.add(status.trim());
        }
        if (StrUtil.isNotBlank(keyword)) {
            String like = "%" + keyword.trim() + "%";
            where.append(" AND (o.out_trade_no LIKE ? OR o.trade_no LIKE ?"
                + " OR u.username LIKE ? OR u.nickname LIKE ?)");
            for (int i = 0; i < 4; i += 1) {
                args.add(like);
            }
        }
        Long total = jdbc.queryForObject(
            "SELECT COUNT(*) FROM orders o LEFT JOIN users u ON u.id = o.user_id" + where,
            Long.class, args.toArray());
        List<Object> pageArgs = new ArrayList<>(args);
        pageArgs.add(size);
        pageArgs.add((num - 1) * size);
        List<AdminOrderView> list = jdbc.query(
            "SELECT o.out_trade_no, o.user_id, u.username, u.nickname, o.plan, o.days,"
                + " o.amount_cent, o.status, o.trade_no, o.created_at, o.paid_at, o.refunded_at"
                + " FROM orders o LEFT JOIN users u ON u.id = o.user_id"
                + where + " ORDER BY o.created_at DESC, o.out_trade_no DESC LIMIT ? OFFSET ?",
            pageArgs.toArray(), (rs, rowNum) -> orderView(rs));
        return new PageResult<>(total == null ? 0 : total, num, size, list);
    }

    /** 关闭未支付订单：支付宝配好了就同步关掉收银台侧，没配只改本地状态。 */
    public AdminOrderView closeOrder(AuthUser admin, String outTradeNo, String ip, String userAgent) {
        Map<String, Object> order = requireOrder(outTradeNo);
        if (!"created".equals(String.valueOf(order.get("status")))) {
            throw new ApiException(400, "只有待支付的订单可以关闭");
        }
        if (alipay.alipayMissing().isEmpty()) {
            try {
                alipay.closeTrade(outTradeNo);
            } catch (RuntimeException e) {
                throw new ApiException(502, "支付宝关单失败：" + e.getMessage());
            }
        }
        int hit = jdbc.update(
            "UPDATE orders SET status = 'closed' WHERE out_trade_no = ? AND status = 'created'", outTradeNo);
        long userId = number(order.get("user_id"));
        audit.record("ADMIN_CLOSE_ORDER", hit > 0 ? "SUCCESS" : "FAILURE", admin.id(), admin.username(),
            admin.role(), "ORDER", userId, "关闭订单 " + outTradeNo, ip, userAgent);
        if (hit == 0) {
            throw new ApiException(409, "订单状态已变化，请刷新后再试");
        }
        return order(outTradeNo);
    }

    /** 全额在线退款，成功后把这一单加过的 VIP 天数从账号上扣回去。 */
    public AdminOrderView refundOrder(AuthUser admin, String outTradeNo, String ip, String userAgent) {
        Map<String, Object> order = requireOrder(outTradeNo);
        if (!"paid".equals(String.valueOf(order.get("status")))) {
            throw new ApiException(400, "只有已支付的订单可以退款");
        }
        List<String> missing = alipay.alipayMissing();
        if (!missing.isEmpty()) {
            throw new ApiException(400, "支付宝未配置，无法在线退款：" + String.join("、", missing));
        }
        int amountCent = ((Number) order.get("amount_cent")).intValue();
        int days = ((Number) order.get("days")).intValue();
        long userId = number(order.get("user_id"));
        try {
            alipay.refund(outTradeNo, amountCent, "管理员退款");
        } catch (RuntimeException e) {
            throw new ApiException(502, "支付宝退款失败：" + e.getMessage());
        }
        int hit = jdbc.update(
            "UPDATE orders SET status = 'refunded', refunded_at = NOW()"
                + " WHERE out_trade_no = ? AND status = 'paid'", outTradeNo);
        if (hit > 0) {
            revokeVipDays(userId, days);
        }
        audit.record("ADMIN_REFUND_ORDER", hit > 0 ? "SUCCESS" : "FAILURE", admin.id(), admin.username(),
            admin.role(), "ORDER", userId,
            "退款 " + PayService.fromCent(amountCent) + " 元，订单 " + outTradeNo, ip, userAgent);
        if (hit == 0) {
            throw new ApiException(409, "订单状态已变化，请刷新后再试");
        }
        return order(outTradeNo);
    }

    private void revokeVipDays(long userId, int days) {
        if (days <= 0) {
            return;
        }
        jdbc.update(
            "UPDATE users SET plan_expires_at = CASE WHEN plan_expires_at IS NULL THEN NULL"
                + " ELSE DATE_SUB(plan_expires_at, INTERVAL ? DAY) END,"
                + " plan = CASE WHEN plan_expires_at IS NOT NULL"
                + " AND DATE_SUB(plan_expires_at, INTERVAL ? DAY) > NOW() THEN 'pro' ELSE 'free' END"
                + " WHERE id = ?",
            days, days, userId);
    }

    private Map<String, Object> requireOrder(String outTradeNo) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT out_trade_no, user_id, days, amount_cent, status FROM orders WHERE out_trade_no = ? LIMIT 1",
            outTradeNo);
        if (rows.isEmpty()) {
            throw new ApiException(404, "订单不存在");
        }
        return rows.get(0);
    }

    private AdminOrderView order(String outTradeNo) {
        return jdbc.queryForObject(
            "SELECT o.out_trade_no, o.user_id, u.username, u.nickname, o.plan, o.days,"
                + " o.amount_cent, o.status, o.trade_no, o.created_at, o.paid_at, o.refunded_at"
                + " FROM orders o LEFT JOIN users u ON u.id = o.user_id"
                + " WHERE o.out_trade_no = ? LIMIT 1",
            (rs, rowNum) -> orderView(rs), outTradeNo);
    }

    private static AdminOrderView orderView(ResultSet rs) throws SQLException {
        return new AdminOrderView(
            rs.getString("out_trade_no"),
            rs.getLong("user_id"),
            rs.getString("username"),
            rs.getString("nickname"),
            rs.getString("plan"),
            rs.getInt("days"),
            rs.getLong("amount_cent"),
            rs.getString("status"),
            rs.getString("trade_no"),
            time(rs, "created_at"),
            time(rs, "paid_at"),
            time(rs, "refunded_at"));
    }

    private static LocalDateTime time(ResultSet rs, String column) throws SQLException {
        Timestamp value = rs.getTimestamp(column);
        return value == null ? null : value.toLocalDateTime();
    }

    private static long number(Object value) {
        return value instanceof Number num ? num.longValue() : Long.parseLong(String.valueOf(value));
    }

    public PageResult<OperationLogView> pageLogs(String keyword, String action, int pageNum, int pageSize) {
        int num = Math.max(1, pageNum);
        int size = Math.max(1, Math.min(100, pageSize));
        LambdaQueryWrapper<OperationLog> wrapper = new LambdaQueryWrapper<>();
        if (StrUtil.isNotBlank(action)) {
            wrapper.eq(OperationLog::getAction, action.trim());
        }
        if (StrUtil.isNotBlank(keyword)) {
            String value = keyword.trim();
            wrapper.and(query -> query.like(OperationLog::getOperatorName, value)
                .or()
                .like(OperationLog::getDetail, value)
                .or()
                .like(OperationLog::getAction, value));
        }
        wrapper.orderByDesc(OperationLog::getId);
        Page<OperationLog> page = logs.selectPage(new Page<>(num, size), wrapper);
        List<OperationLogView> list = page.getRecords().stream().map(audit::view).toList();
        return new PageResult<>(page.getTotal(), page.getCurrent(), page.getSize(), list);
    }

    private SysUser requireUser(long id) {
        SysUser user = users.selectById(id);
        if (user == null) {
            throw new ApiException(404, "账号不存在");
        }
        return user;
    }

    private AdminUserView view(SysUser user) {
        return new AdminUserView(
            user.getId(),
            user.getUsername(),
            user.getNickname(),
            StrUtil.blankToDefault(user.getRole(), "USER"),
            user.getStatus() == null ? 0 : user.getStatus(),
            StrUtil.blankToDefault(user.getPlan(), "free"),
            user.getPlanExpiresAt(),
            user.getCreatedAt(),
            user.getLastLoginAt(),
            StrUtil.isNotBlank(user.getAlipayUid())
        );
    }
}

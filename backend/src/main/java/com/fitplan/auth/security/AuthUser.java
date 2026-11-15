package com.fitplan.auth.security;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;

/** 当前请求的登录人，控制器只依赖这个对象，不再直接查 sessions 表。 */
public record AuthUser(
    Long id,
    String alipayUid,
    String username,
    String nickname,
    String role,
    String plan,
    LocalDateTime planExpiresAt,
    LocalDateTime createdAt,
    LocalDateTime lastLoginAt,
    String jti,
    Instant tokenExpiresAt
) {

    private static final ZoneId SHANGHAI = ZoneId.of("Asia/Shanghai");

    public boolean pro() {
        return "pro".equals(plan)
            && planExpiresAt != null
            && planExpiresAt.isAfter(LocalDateTime.now(SHANGHAI));
    }

    public String uidTail() {
        String source = alipayUid != null && !alipayUid.isBlank()
            ? alipayUid
            : username != null && !username.isBlank() ? username : String.valueOf(id);
        return source.length() <= 4 ? source : source.substring(source.length() - 4);
    }

    public String displayName() {
        if (nickname != null && !nickname.isBlank()) {
            return nickname;
        }
        if (username != null && !username.isBlank()) {
            return username;
        }
        return "用户 " + id;
    }
}

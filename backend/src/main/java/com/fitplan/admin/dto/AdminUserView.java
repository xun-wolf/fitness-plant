package com.fitplan.admin.dto;

import java.time.LocalDateTime;

public record AdminUserView(
    Long id,
    String username,
    String nickname,
    String role,
    Integer status,
    String plan,
    LocalDateTime planExpiresAt,
    LocalDateTime createdAt,
    LocalDateTime lastLoginAt,
    boolean alipayBound
) {
}

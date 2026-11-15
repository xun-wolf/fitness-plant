package com.fitplan.auth.dto;

public record UserView(
    Long id,
    String username,
    String nickname,
    String role,
    String plan,
    boolean alipayBound
) {
}

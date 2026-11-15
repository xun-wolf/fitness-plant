package com.fitplan.admin.dto;

import java.time.LocalDateTime;

public record AdminOrderView(
    String outTradeNo,
    Long userId,
    String username,
    String nickname,
    String plan,
    Integer days,
    Long amountCent,
    String status,
    String tradeNo,
    LocalDateTime createdAt,
    LocalDateTime paidAt,
    LocalDateTime refundedAt
) {
}

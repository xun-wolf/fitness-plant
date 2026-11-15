package com.fitplan.admin.dto;

import java.time.LocalDateTime;

public record OperationLogView(
    Long id,
    Long operatorId,
    String operatorName,
    String operatorRole,
    String action,
    String targetType,
    Long targetId,
    String result,
    String detail,
    String ip,
    LocalDateTime createdAt
) {
}

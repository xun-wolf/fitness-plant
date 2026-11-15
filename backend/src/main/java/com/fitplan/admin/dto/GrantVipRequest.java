package com.fitplan.admin.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record GrantVipRequest(
    @NotNull(message = "开通天数不能为空")
    @Min(value = 1, message = "开通天数至少 1 天")
    @Max(value = 3650, message = "开通天数最多 3650 天")
    Integer days
) {
}

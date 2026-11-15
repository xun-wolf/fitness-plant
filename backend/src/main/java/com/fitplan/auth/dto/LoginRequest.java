package com.fitplan.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record LoginRequest(
    @NotBlank(message = "请输入账号")
    @Size(max = 32, message = "账号最长 32 个字符")
    String username,

    @NotBlank(message = "请输入密码")
    @Size(max = 64, message = "密码最长 64 个字符")
    String password
) {
}

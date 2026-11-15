package com.fitplan.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ChangePasswordRequest(
    @NotBlank(message = "请输入原密码")
    @Size(max = 64, message = "原密码最长 64 个字符")
    String oldPassword,

    @NotBlank(message = "请输入新密码")
    @Size(min = 8, max = 64, message = "新密码需为 8-64 位")
    String newPassword,

    @NotBlank(message = "请再输入一次新密码")
    String confirmPassword
) {
}

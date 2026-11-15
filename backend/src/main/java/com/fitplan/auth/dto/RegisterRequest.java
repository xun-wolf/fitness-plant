package com.fitplan.auth.dto;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
    @NotBlank(message = "请输入账号")
    @Pattern(regexp = "^[A-Za-z0-9_]{3,32}$", message = "账号需为 3-32 位字母、数字或下划线")
    String username,

    @NotBlank(message = "请输入密码")
    @Size(min = 8, max = 64, message = "密码需为 8-64 位")
    String password,

    @Size(max = 32, message = "昵称最长 32 个字符")
    String nickname,

    @NotNull(message = "请先阅读并同意隐私政策和服务条款")
    @AssertTrue(message = "请先阅读并同意隐私政策和服务条款")
    Boolean acceptedTerms
) {
}

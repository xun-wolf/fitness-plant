package com.fitplan.auth.common;

import cn.hutool.core.util.StrUtil;
import jakarta.servlet.http.HttpServletRequest;

public final class RequestIp {

    private RequestIp() {
    }

    public static String of(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (StrUtil.isNotBlank(forwarded)) {
            return StrUtil.splitTrim(forwarded, ',').stream().findFirst().orElse(request.getRemoteAddr());
        }
        return request.getRemoteAddr();
    }
}

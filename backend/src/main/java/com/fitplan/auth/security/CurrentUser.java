package com.fitplan.auth.security;

import com.fitplan.config.ApiException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

public final class CurrentUser {

    private CurrentUser() {
    }

    public static AuthUser require() {
        AuthUser user = optional();
        if (user == null) {
            throw new ApiException(401, "没有有效会话");
        }
        return user;
    }

    public static AuthUser optional() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof AuthUser user)) {
            return null;
        }
        return user;
    }
}

package com.fitplan.web;

import com.fitplan.auth.AuthService;
import com.fitplan.auth.security.AuthUser;
import com.fitplan.auth.security.CurrentUser;
import com.fitplan.service.AccountService;
import com.fitplan.service.JsonUtil;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class SessionController {

    private final AccountService account;
    private final AuthService auth;

    public SessionController(AccountService account, AuthService auth) {
        this.account = account;
        this.auth = auth;
    }

    @GetMapping("/api/session")
    public Map<String, Object> session() {
        AuthUser user = CurrentUser.require();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("uidTail", user.uidTail());
        out.put("username", user.username());
        out.put("nickname", user.nickname());
        out.put("alipayUid", user.alipayUid());
        out.put("displayName", user.displayName());
        out.put("role", user.role());
        out.put("plan", user.pro() ? "pro" : "free");
        out.put("planExpiresAt", JsonUtil.iso(user.planExpiresAt()));
        out.put("createdAt", JsonUtil.iso(user.createdAt()));
        out.put("lastLoginAt", JsonUtil.iso(user.lastLoginAt()));
        return out;
    }

    @DeleteMapping("/api/session")
    public Map<String, Object> logout() {
        auth.logout(CurrentUser.require());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("ok", true);
        out.put("dropped", "session");
        return out;
    }

    @DeleteMapping("/api/account")
    public Map<String, Object> close() {
        AuthUser user = CurrentUser.require();
        auth.logout(user);
        account.deleteUser(user.id());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("ok", true);
        out.put("dropped", "account");
        return out;
    }
}

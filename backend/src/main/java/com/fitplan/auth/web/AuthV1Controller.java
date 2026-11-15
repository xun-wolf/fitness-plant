package com.fitplan.auth.web;

import com.fitplan.admin.dto.OperationLogView;
import com.fitplan.admin.service.AuditService;
import com.fitplan.auth.AuthService;
import com.fitplan.auth.common.AuthException;
import com.fitplan.auth.common.RequestIp;
import com.fitplan.auth.common.Result;
import com.fitplan.auth.dto.AuthResponse;
import com.fitplan.auth.dto.ChangePasswordRequest;
import com.fitplan.auth.dto.LoginRequest;
import com.fitplan.auth.dto.RegisterRequest;
import com.fitplan.auth.dto.UserView;
import com.fitplan.auth.security.AuthUser;
import com.fitplan.auth.security.CurrentUser;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthV1Controller {

    private final AuthService auth;
    private final AuditService audit;

    @PostMapping("/register")
    public Result<AuthResponse> register(@Valid @RequestBody RegisterRequest request,
                                         HttpServletRequest http) {
        String ip = RequestIp.of(http);
        AuthResponse response = auth.register(request, ip);
        audit.record("REGISTER_SUCCESS", "SUCCESS", response.user().id(), request.username(), "USER",
            "USER", response.user().id(), null, ip, http.getHeader("User-Agent"));
        return Result.success(response);
    }

    @PostMapping("/login")
    public Result<AuthResponse> login(@Valid @RequestBody LoginRequest request,
                                      HttpServletRequest http) {
        String ip = RequestIp.of(http);
        try {
            AuthResponse response = auth.login(request, ip);
            audit.record("LOGIN_SUCCESS", "SUCCESS", response.user().id(), request.username(),
                response.user().role(), "USER", response.user().id(), null, ip, http.getHeader("User-Agent"));
            return Result.success(response);
        } catch (AuthException e) {
            audit.record("LOGIN_FAILED", "FAILURE", null, request.username(), null,
                "USER", null, e.getMessage(), ip, http.getHeader("User-Agent"));
            throw e;
        }
    }

    @GetMapping("/me")
    public Result<UserView> me() {
        return Result.success(auth.view(CurrentUser.require()));
    }

    @PostMapping("/logout")
    public Result<Void> logout(HttpServletRequest http) {
        AuthUser user = CurrentUser.require();
        auth.logout(user);
        audit.record("LOGOUT", "SUCCESS", user.id(), user.username(), user.role(),
            "USER", user.id(), null, RequestIp.of(http), http.getHeader("User-Agent"));
        return Result.success(null);
    }

    @PostMapping("/change-password")
    public Result<AuthResponse> changePassword(@Valid @RequestBody ChangePasswordRequest request,
                                               HttpServletRequest http) {
        AuthUser user = CurrentUser.require();
        AuthResponse response = auth.changePassword(user, request);
        audit.record("CHANGE_PASSWORD", "SUCCESS", user.id(), user.username(), user.role(),
            "USER", user.id(), null, RequestIp.of(http), http.getHeader("User-Agent"));
        return Result.success(response);
    }

    @GetMapping("/operation-logs")
    public Result<List<OperationLogView>> logs(@RequestParam(defaultValue = "20") int limit) {
        return Result.success(audit.recentForUser(CurrentUser.require().id(), limit));
    }
}

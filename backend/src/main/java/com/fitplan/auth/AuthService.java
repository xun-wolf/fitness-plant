package com.fitplan.auth;

import cn.hutool.core.util.StrUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.fitplan.auth.common.AuthException;
import com.fitplan.auth.common.ResultCode;
import com.fitplan.auth.dto.AuthResponse;
import com.fitplan.auth.dto.ChangePasswordRequest;
import com.fitplan.auth.dto.LoginRequest;
import com.fitplan.auth.dto.RegisterRequest;
import com.fitplan.auth.dto.UserView;
import com.fitplan.auth.entity.SysUser;
import com.fitplan.auth.mapper.SysUserMapper;
import com.fitplan.auth.security.AuthUser;
import com.fitplan.auth.security.JwtService;
import com.fitplan.auth.security.LoginRateLimiter;
import com.fitplan.auth.security.TokenBlacklist;
import com.fitplan.config.ApiException;
import java.time.LocalDateTime;
import java.time.ZoneId;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private static final ZoneId SHANGHAI = ZoneId.of("Asia/Shanghai");

    private final SysUserMapper users;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwt;
    private final LoginRateLimiter rateLimiter;
    private final TokenBlacklist blacklist;

    @Transactional
    public AuthResponse register(RegisterRequest request, String ip) {
        rateLimiter.checkRegister(ip);
        String username = StrUtil.trim(request.username());
        Long exists = users.selectCount(new LambdaQueryWrapper<SysUser>().eq(SysUser::getUsername, username));
        if (exists != null && exists > 0) {
            throw new AuthException(ResultCode.DUPLICATE, "账号已被占用", HttpStatus.CONFLICT);
        }

        SysUser user = new SysUser();
        user.setUsername(username);
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        String nickname = request.nickname();
        user.setNickname(StrUtil.isBlank(nickname) ? username : nickname.trim());
        user.setRole("USER");
        user.setStatus(1);
        user.setPlan("free");
        users.insert(user);
        updateLastLogin(user.getId());
        user.setLastLoginAt(LocalDateTime.now(SHANGHAI));
        return response(user);
    }

    public AuthResponse login(LoginRequest request, String ip) {
        String username = StrUtil.trim(request.username());
        rateLimiter.checkLogin(ip, username);
        SysUser user = findByUsername(username);
        if (user == null || user.getPasswordHash() == null
            || !passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new AuthException(ResultCode.BAD_CREDENTIALS, "账号或密码错误", HttpStatus.UNAUTHORIZED);
        }
        if (user.getStatus() == null || user.getStatus() != 1) {
            throw new AuthException(ResultCode.ACCOUNT_DISABLED, "账号已被禁用", HttpStatus.UNAUTHORIZED);
        }
        rateLimiter.resetLogin(ip, username);
        updateLastLogin(user.getId());
        user.setLastLoginAt(LocalDateTime.now(SHANGHAI));
        return response(user);
    }

    public UserView view(AuthUser user) {
        return new UserView(
            user.id(),
            user.username(),
            user.nickname(),
            user.role(),
            user.pro() ? "pro" : "free",
            StrUtil.isNotBlank(user.alipayUid())
        );
    }

    public void logout(AuthUser user) {
        blacklist.blacklist(user.jti(), user.tokenExpiresAt());
    }

    public AuthResponse changePassword(AuthUser principal, ChangePasswordRequest request) {
        SysUser user = users.selectById(principal.id());
        if (user == null) {
            throw new AuthException(ResultCode.UNAUTHORIZED, "账号不存在", HttpStatus.UNAUTHORIZED);
        }
        if (StrUtil.isBlank(user.getPasswordHash())) {
            throw new AuthException(ResultCode.BUSINESS_RULE, "这个账号还没有设置密码", HttpStatus.BAD_REQUEST);
        }
        if (!passwordEncoder.matches(request.oldPassword(), user.getPasswordHash())) {
            throw new AuthException(ResultCode.BAD_CREDENTIALS, "原密码不正确", HttpStatus.UNAUTHORIZED);
        }
        if (!request.newPassword().equals(request.confirmPassword())) {
            throw new AuthException(ResultCode.PARAM_INVALID, "两次输入的新密码不一致", HttpStatus.BAD_REQUEST);
        }
        if (passwordEncoder.matches(request.newPassword(), user.getPasswordHash())) {
            throw new AuthException(ResultCode.PARAM_INVALID, "新密码不能与原密码相同", HttpStatus.BAD_REQUEST);
        }
        users.update(null, new LambdaUpdateWrapper<SysUser>()
            .eq(SysUser::getId, user.getId())
            .set(SysUser::getPasswordHash, passwordEncoder.encode(request.newPassword())));
        // 当前令牌立即失效，同时签发一枚新令牌，避免用户改完密码被迫重新登录
        blacklist.blacklist(principal.jti(), principal.tokenExpiresAt());
        return response(user);
    }

    /** 支付宝回调没有密码，只按 user_id 发 JWT。 */
    public String issueForUserId(long userId) {
        SysUser user = users.selectById(userId);
        if (user == null || user.getStatus() == null || user.getStatus() != 1) {
            throw new ApiException(401, "账号不存在或已停用");
        }
        return jwt.issue(userId).token();
    }

    private AuthResponse response(SysUser user) {
        JwtService.Issued issued = jwt.issue(user.getId());
        return new AuthResponse(issued.token(), jwt.expiresInSeconds(), new UserView(
            user.getId(),
            user.getUsername(),
            user.getNickname(),
            StrUtil.isBlank(user.getRole()) ? "USER" : user.getRole(),
            "pro".equals(user.getPlan()) ? "pro" : "free",
            StrUtil.isNotBlank(user.getAlipayUid())
        ));
    }

    private SysUser findByUsername(String username) {
        return users.selectOne(new LambdaQueryWrapper<SysUser>()
            .eq(SysUser::getUsername, username)
            .last("LIMIT 1"));
    }

    private void updateLastLogin(Long userId) {
        users.update(null, new LambdaUpdateWrapper<SysUser>()
            .eq(SysUser::getId, userId)
            .set(SysUser::getLastLoginAt, LocalDateTime.now(SHANGHAI)));
    }
}

package com.fitplan.auth.security;

import cn.hutool.core.util.StrUtil;
import java.time.Duration;
import java.time.Instant;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

/** Redis 不可用时按放行处理：宁可登出不能主动失效，也不要让所有人登录不了。 */
@Slf4j
@Service
public class TokenBlacklist {

    private static final String PREFIX = "auth:blacklist:";

    private final StringRedisTemplate redis;
    private volatile boolean warned;

    public TokenBlacklist(StringRedisTemplate redis) {
        this.redis = redis;
    }

    public boolean isBlacklisted(String jti) {
        if (StrUtil.isBlank(jti)) {
            return false;
        }
        try {
            return Boolean.TRUE.equals(redis.hasKey(PREFIX + jti));
        } catch (Exception e) {
            warn(e);
            return false;
        }
    }

    public void blacklist(String jti, Instant expiresAt) {
        if (StrUtil.isBlank(jti) || expiresAt == null) {
            return;
        }
        long seconds = Duration.between(Instant.now(), expiresAt).getSeconds();
        if (seconds <= 0) {
            return;
        }
        try {
            redis.opsForValue().set(PREFIX + jti, "1", Duration.ofSeconds(seconds));
        } catch (Exception e) {
            warn(e);
        }
    }

    private void warn(Exception e) {
        if (!warned) {
            warned = true;
            log.warn("[auth] Redis 不可用，Token 黑名单暂时失效：{}", e.getMessage());
        }
    }
}

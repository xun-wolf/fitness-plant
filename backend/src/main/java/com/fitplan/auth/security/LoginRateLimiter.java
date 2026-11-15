package com.fitplan.auth.security;

import cn.hutool.core.util.StrUtil;
import com.fitplan.auth.common.AuthException;
import com.fitplan.auth.common.ResultCode;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/** 登录/注册限流：优先 Redis；Redis 挂了退回单实例内存计数，避免把登录整体拖死。 */
@Slf4j
@Service
public class LoginRateLimiter {

    private static final int LIMIT = 5;
    private static final long WINDOW_MILLIS = 60_000L;

    private final StringRedisTemplate redis;
    private final Map<String, Window> fallback = new ConcurrentHashMap<>();
    private volatile boolean warned;

    public LoginRateLimiter(StringRedisTemplate redis) {
        this.redis = redis;
    }

    public void checkLogin(String ip, String username) {
        check("auth:login:" + ip + ":" + StrUtil.nullToEmpty(username).toLowerCase(), "登录太频繁，请一分钟后再试");
    }

    public void checkRegister(String ip) {
        check("auth:register:" + ip, "注册太频繁，请一分钟后再试");
    }

    public void resetLogin(String ip, String username) {
        String key = "auth:login:" + ip + ":" + StrUtil.nullToEmpty(username).toLowerCase();
        fallback.remove(key);
        try {
            redis.delete(key);
        } catch (Exception e) {
            warn(e);
        }
    }

    private void check(String key, String message) {
        try {
            Long count = redis.opsForValue().increment(key);
            if (count != null && count == 1L) {
                redis.expire(key, Duration.ofMinutes(1));
            }
            if (count != null && count > LIMIT) {
                throw new AuthException(ResultCode.TOO_MANY_REQUESTS, message, HttpStatus.TOO_MANY_REQUESTS);
            }
        } catch (AuthException e) {
            throw e;
        } catch (Exception e) {
            warn(e);
            fallbackCheck(key, message);
        }
    }

    private void fallbackCheck(String key, String message) {
        long now = System.currentTimeMillis();
        Window window = fallback.computeIfAbsent(key, ignored -> new Window(now, 0));
        synchronized (window) {
            if (now - window.start > WINDOW_MILLIS) {
                window.start = now;
                window.count = 0;
            }
            window.count += 1;
            if (window.count > LIMIT) {
                throw new AuthException(ResultCode.TOO_MANY_REQUESTS, message, HttpStatus.TOO_MANY_REQUESTS);
            }
        }
    }

    private void warn(Exception e) {
        if (!warned) {
            warned = true;
            log.warn("[auth] Redis 不可用，限流退回本机内存：{}", e.getMessage());
        }
    }

    private static final class Window {

        private long start;
        private int count;

        private Window(long start, int count) {
            this.start = start;
            this.count = count;
        }
    }
}

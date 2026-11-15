package com.fitplan.auth.security;

import cn.hutool.core.util.IdUtil;
import cn.hutool.core.util.StrUtil;
import com.fitplan.config.FitplanProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import javax.crypto.SecretKey;
import org.springframework.stereotype.Service;

@Service
public class JwtService {

    private final SecretKey key;
    private final int expireMinutes;

    public JwtService(FitplanProperties props) {
        String secret = props.getAuth().getJwtSecret();
        if (StrUtil.isBlank(secret) || secret.length() < 32) {
            throw new IllegalStateException("JWT_SECRET 至少需要 32 个字符");
        }
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expireMinutes = Math.max(5, props.getAuth().getExpireMinutes());
    }

    public Issued issue(long userId) {
        Instant now = Instant.now();
        Instant expiresAt = now.plus(Duration.ofMinutes(expireMinutes));
        String token = Jwts.builder()
            .subject(String.valueOf(userId))
            .id(IdUtil.fastSimpleUUID())
            .issuedAt(Date.from(now))
            .expiration(Date.from(expiresAt))
            .signWith(key)
            .compact();
        return new Issued(token, expiresAt);
    }

    public Claims parse(String token) {
        return Jwts.parser()
            .verifyWith(key)
            .build()
            .parseSignedClaims(token)
            .getPayload();
    }

    public long expiresInSeconds() {
        return expireMinutes * 60L;
    }

    public record Issued(String token, Instant expiresAt) {
    }
}

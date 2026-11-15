package com.fitplan.auth.security;

import cn.hutool.core.util.StrUtil;
import com.fitplan.auth.entity.SysUser;
import com.fitplan.auth.mapper.SysUserMapper;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwt;
    private final SysUserMapper users;
    private final TokenBlacklist blacklist;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
        throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            authenticate(header.substring(7).trim(), request);
        }
        chain.doFilter(request, response);
    }

    private void authenticate(String token, HttpServletRequest request) {
        try {
            Claims claims = jwt.parse(token);
            String jti = claims.getId();
            if (jti == null || blacklist.isBlacklisted(jti)) {
                return;
            }
            long userId = Long.parseLong(claims.getSubject());
            SysUser row = users.selectById(userId);
            if (row == null || row.getStatus() == null || row.getStatus() != 1) {
                return;
            }
            String role = StrUtil.isBlank(row.getRole()) ? "USER" : row.getRole();
            AuthUser principal = new AuthUser(
                row.getId(),
                row.getAlipayUid(),
                row.getUsername(),
                row.getNickname(),
                role,
                row.getPlan() == null ? "free" : row.getPlan(),
                row.getPlanExpiresAt(),
                row.getCreatedAt(),
                row.getLastLoginAt(),
                jti,
                claims.getExpiration() == null ? null : claims.getExpiration().toInstant()
            );
            UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                principal, null, List.of(new SimpleGrantedAuthority("ROLE_" + role)));
            authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
            SecurityContextHolder.getContext().setAuthentication(authentication);
        } catch (Exception ignored) {
            SecurityContextHolder.clearContext();
        }
    }
}

package com.fitplan.admin;

import cn.hutool.core.util.StrUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fitplan.auth.entity.SysUser;
import com.fitplan.auth.mapper.SysUserMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/** 首次启动用环境变量创建一个管理员；已有管理员时绝不覆盖。 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AdminBootstrap implements ApplicationRunner {

    private final SysUserMapper users;
    private final PasswordEncoder passwordEncoder;

    @Value("${ADMIN_USERNAME:}")
    private String username;

    @Value("${ADMIN_PASSWORD:}")
    private String password;

    @Value("${ADMIN_NICKNAME:管理员}")
    private String nickname;

    @Override
    public void run(ApplicationArguments args) {
        if (StrUtil.isBlank(username) || StrUtil.isBlank(password)) {
            return;
        }
        Long admins = users.selectCount(new LambdaQueryWrapper<SysUser>().eq(SysUser::getRole, "ADMIN"));
        if (admins != null && admins > 0) {
            return;
        }
        String name = username.trim();
        Long exists = users.selectCount(new LambdaQueryWrapper<SysUser>().eq(SysUser::getUsername, name));
        if (exists != null && exists > 0) {
            log.warn("[admin] {} 已存在但不是管理员，跳过初始化", name);
            return;
        }

        SysUser user = new SysUser();
        user.setUsername(name);
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setNickname(StrUtil.isBlank(nickname) ? name : nickname.trim());
        user.setRole("ADMIN");
        user.setStatus(1);
        user.setPlan("free");
        users.insert(user);
        log.info("[admin] 已创建初始管理员 {}，请登录后尽快修改密码", name);
    }
}

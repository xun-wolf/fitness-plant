package com.fitplan.auth.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@TableName("users")
public class SysUser {

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    @TableField("alipay_uid")
    private String alipayUid;

    private String username;

    @TableField("password_hash")
    private String passwordHash;

    private String nickname;

    private String role;

    private Integer status;

    private String plan;

    @TableField("plan_expires_at")
    private LocalDateTime planExpiresAt;

    @TableField("created_at")
    private LocalDateTime createdAt;

    @TableField("last_login_at")
    private LocalDateTime lastLoginAt;
}

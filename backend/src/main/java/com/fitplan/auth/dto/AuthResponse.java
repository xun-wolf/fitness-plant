package com.fitplan.auth.dto;

public record AuthResponse(String token, long expiresIn, UserView user) {
}

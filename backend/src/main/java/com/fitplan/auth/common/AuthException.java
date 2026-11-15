package com.fitplan.auth.common;

import org.springframework.http.HttpStatus;

public class AuthException extends RuntimeException {

    private final int code;
    private final HttpStatus status;

    public AuthException(int code, String message, HttpStatus status) {
        super(message);
        this.code = code;
        this.status = status;
    }

    public int code() {
        return code;
    }

    public HttpStatus status() {
        return status;
    }
}

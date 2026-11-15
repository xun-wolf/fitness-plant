package com.fitplan.config;

/** 接口自己知道该回哪个状态码：400 是参数不对，401 是没登录，403 是别人的东西，404 是没有。 */
public class ApiException extends RuntimeException {

    private final int status;

    public ApiException(int status, String message) {
        super(message);
        this.status = status;
    }

    public int status() {
        return status;
    }
}

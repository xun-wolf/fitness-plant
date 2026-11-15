package com.fitplan.auth.common;

public final class ResultCode {

    public static final int OK = 200;
    public static final int PARAM_INVALID = 400001;
    public static final int BUSINESS_RULE = 400002;
    public static final int UNAUTHORIZED = 401001;
    public static final int BAD_CREDENTIALS = 401002;
    public static final int ACCOUNT_DISABLED = 401003;
    public static final int FORBIDDEN = 403001;
    public static final int DUPLICATE = 409001;
    public static final int TOO_MANY_REQUESTS = 429001;
    public static final int SERVER_ERROR = 500001;

    private ResultCode() {
    }
}

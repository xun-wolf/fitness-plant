package com.fitplan.service;

/** 支付宝网关回的错误节点：code 有值就说明是网关拒绝，不是我们这边 500。 */
public class AlipayException extends RuntimeException {

    private final String code;

    public AlipayException(String message, String code) {
        super(message);
        this.code = code;
    }

    public String code() {
        return code;
    }
}

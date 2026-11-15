package com.fitplan.config;

import java.util.ArrayList;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "fitplan")
public class FitplanProperties {

    private static final String HOSTED_FRONT = "https://minute-fitplan-9u7zherxrt7.qoder.zone";

    private int apiPort = 8787;
    private String front = "http://localhost:5173";
    private String publicBase = "";
    private String origins = "";
    private int sessionDays = 30;
    private final Auth auth = new Auth();
    private final Alipay alipay = new Alipay();
    private final Pay pay = new Pay();

    public int getApiPort() {
        return apiPort;
    }

    public void setApiPort(int apiPort) {
        this.apiPort = apiPort;
    }

    public String getFront() {
        return front;
    }

    public void setFront(String front) {
        this.front = front;
    }

    public String getPublicBase() {
        return publicBase;
    }

    public void setPublicBase(String publicBase) {
        this.publicBase = publicBase;
    }

    public String getOrigins() {
        return origins;
    }

    public void setOrigins(String origins) {
        this.origins = origins;
    }

    public int getSessionDays() {
        return sessionDays;
    }

    public void setSessionDays(int sessionDays) {
        this.sessionDays = sessionDays;
    }

    public Auth getAuth() {
        return auth;
    }

    public Alipay getAlipay() {
        return alipay;
    }

    public Pay getPay() {
        return pay;
    }

    public String trimmedFront() {
        return trimTrailingSlash(front);
    }

    public String resolvedPublicBase() {
        return isBlank(publicBase) ? "http://localhost:" + apiPort : trimTrailingSlash(publicBase);
    }

    /** 通知地址只认显式配好的公网地址：留空就是没开通，不能拿 localhost 兜底骗自己 */
    public String notifyBase() {
        return trimTrailingSlash(publicBase);
    }

    public List<String> resolvedOrigins() {
        List<String> configured = split(origins);
        if (!configured.isEmpty()) {
            return configured;
        }
        return split(trimmedFront() + ",http://localhost:8082," + HOSTED_FRONT);
    }

    public boolean originAllowed(String origin) {
        return origin != null && resolvedOrigins().contains(origin);
    }

    public static boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private static List<String> split(String value) {
        List<String> out = new ArrayList<>();
        for (String part : value.split(",")) {
            String trimmed = part.trim();
            if (!trimmed.isEmpty()) {
                out.add(trimmed);
            }
        }
        return out;
    }

    private static String trimTrailingSlash(String value) {
        return value == null ? "" : value.replaceAll("/+$", "");
    }

    public static class Auth {

        private String jwtSecret = "";
        private int expireMinutes = 120;

        public String getJwtSecret() {
            return jwtSecret;
        }

        public void setJwtSecret(String jwtSecret) {
            this.jwtSecret = jwtSecret;
        }

        public int getExpireMinutes() {
            return expireMinutes;
        }

        public void setExpireMinutes(int expireMinutes) {
            this.expireMinutes = expireMinutes;
        }
    }

    public static class Alipay {

        private String appId = "";
        private String gateway = "https://openapi.alipay.com/gateway.do";
        private String privateKey = "";
        private String privateKeyFile = "";
        private String publicKey = "";
        private String publicKeyFile = "";

        public String getAppId() {
            return appId;
        }

        public void setAppId(String appId) {
            this.appId = appId;
        }

        public String getGateway() {
            return gateway;
        }

        public void setGateway(String gateway) {
            this.gateway = gateway;
        }

        public String getPrivateKey() {
            return privateKey;
        }

        public void setPrivateKey(String privateKey) {
            this.privateKey = privateKey;
        }

        public String getPrivateKeyFile() {
            return privateKeyFile;
        }

        public void setPrivateKeyFile(String privateKeyFile) {
            this.privateKeyFile = privateKeyFile;
        }

        public String getPublicKey() {
            return publicKey;
        }

        public void setPublicKey(String publicKey) {
            this.publicKey = publicKey;
        }

        public String getPublicKeyFile() {
            return publicKeyFile;
        }

        public void setPublicKeyFile(String publicKeyFile) {
            this.publicKeyFile = publicKeyFile;
        }
    }

    public static class Pay {

        private double priceYuan = 8;
        private int days = 30;
        private String subject = "练 · Pro 会员";

        public double getPriceYuan() {
            return priceYuan;
        }

        public void setPriceYuan(double priceYuan) {
            this.priceYuan = priceYuan;
        }

        public int getDays() {
            return days;
        }

        public void setDays(int days) {
            this.days = days;
        }

        public String getSubject() {
            return subject;
        }

        public void setSubject(String subject) {
            this.subject = subject;
        }
    }
}

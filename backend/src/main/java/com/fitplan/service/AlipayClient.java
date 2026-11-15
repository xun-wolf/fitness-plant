package com.fitplan.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fitplan.config.FitplanProperties;
import com.fitplan.config.FitplanProperties.Alipay;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.SecureRandom;
import java.security.Signature;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/** 支付宝网关那一层：RSA2 签名、回执验签、换 token、查用户，以及授权跳转地址。 */
@Service
public class AlipayClient {

    private static final Logger log = LoggerFactory.getLogger(AlipayClient.class);
    private static final ZoneId SHANGHAI = ZoneId.of("Asia/Shanghai");
    private static final DateTimeFormatter STAMP = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final SecureRandom RANDOM = new SecureRandom();

    private final FitplanProperties props;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

    private volatile boolean keysLoaded;
    private volatile PrivateKey privateKey;
    private volatile PublicKey publicKey;

    public AlipayClient(FitplanProperties props) {
        this.props = props;
    }

    public String appId() {
        return props.getAlipay().getAppId();
    }

    /** 缺哪一项就直说哪一项，别让人去猜环境变量名。 */
    public List<String> alipayMissing() {
        Alipay a = props.getAlipay();
        List<String> missing = new ArrayList<>();
        if (FitplanProperties.isBlank(a.getAppId())) {
            missing.add("ALIPAY_APP_ID");
        }
        if (pem(a.getPrivateKey(), a.getPrivateKeyFile(), "PRIVATE KEY") == null) {
            missing.add("ALIPAY_APP_PRIVATE_KEY（或 ALIPAY_APP_PRIVATE_KEY_FILE 指向的 PEM 文件）");
        }
        if (pem(a.getPublicKey(), a.getPublicKeyFile(), "PUBLIC KEY") == null) {
            missing.add("ALIPAY_PUBLIC_KEY（或 ALIPAY_PUBLIC_KEY_FILE，验支付宝回执用）");
        }
        return missing;
    }

    public String authorizeUrl(String state) {
        String redirect = props.resolvedPublicBase() + "/api/auth/alipay/callback";
        return "https://openauth.alipay.com/oauth2/publicAppAuthorize.htm?"
            + "app_id=" + encode(appId())
            + "&scope=auth_user"
            + "&redirect_uri=" + encode(redirect)
            + "&state=" + encode(state);
    }

    public JsonNode oauthToken(String authCode) {
        LinkedHashMap<String, String> extra = new LinkedHashMap<>();
        extra.put("grant_type", "authorization_code");
        extra.put("code", authCode);
        return exec("alipay.system.oauth.token", extra);
    }

    public JsonNode userInfo(String accessToken) {
        LinkedHashMap<String, String> extra = new LinkedHashMap<>();
        extra.put("auth_token", accessToken);
        return exec("alipay.user.info.share", extra);
    }

    /** 全额退款：out_request_no 固定用订单号，重复提交会被支付宝按同一笔退款去重。 */
    public JsonNode refund(String outTradeNo, int amountCent, String reason) {
        LinkedHashMap<String, Object> biz = new LinkedHashMap<>();
        biz.put("out_trade_no", outTradeNo);
        biz.put("refund_amount", PayService.fromCent(amountCent));
        biz.put("out_request_no", outTradeNo);
        if (!FitplanProperties.isBlank(reason)) {
            biz.put("refund_reason", reason);
        }
        return exec("alipay.trade.refund", bizContent(biz));
    }

    /** 关闭未付款订单：支付宝侧关掉之后，用户再打开收银台也付不了。 */
    public JsonNode closeTrade(String outTradeNo) {
        LinkedHashMap<String, Object> biz = new LinkedHashMap<>();
        biz.put("out_trade_no", outTradeNo);
        return exec("alipay.trade.close", bizContent(biz));
    }

    private static LinkedHashMap<String, String> bizContent(Map<String, Object> biz) {
        String json;
        try {
            json = JsonUtil.MAPPER.writeValueAsString(biz);
        } catch (Exception e) {
            throw new IllegalStateException("支付宝业务参数序列化失败：" + e.getMessage(), e);
        }
        LinkedHashMap<String, String> extra = new LinkedHashMap<>();
        extra.put("biz_content", json);
        return extra;
    }

    /** 签名串：按键名排序拼 k=v，值不做 URL 编码（支付宝网关 RSA2 的口径）。 */
    public static String canonical(Map<String, String> params) {
        TreeMap<String, String> sorted = new TreeMap<>();
        for (Map.Entry<String, String> entry : params.entrySet()) {
            String value = entry.getValue();
            if (value != null && !value.isEmpty()) {
                sorted.put(entry.getKey(), value);
            }
        }
        StringBuilder out = new StringBuilder();
        for (Map.Entry<String, String> entry : sorted.entrySet()) {
            if (!out.isEmpty()) {
                out.append('&');
            }
            out.append(entry.getKey()).append('=').append(entry.getValue());
        }
        return out.toString();
    }

    public String sign(String content) {
        ensureKeys();
        PrivateKey key = privateKey;
        if (key == null) {
            throw new IllegalStateException("没有应用私钥，下不了单");
        }
        try {
            Signature signature = Signature.getInstance("SHA256withRSA");
            signature.initSign(key);
            signature.update(content.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(signature.sign());
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("签名失败：" + e.getMessage(), e);
        }
    }

    public boolean verify(String content, String signature, PublicKey key) {
        if (key == null || signature == null) {
            return false;
        }
        try {
            Signature verifier = Signature.getInstance("SHA256withRSA");
            verifier.initVerify(key);
            verifier.update(content.getBytes(StandardCharsets.UTF_8));
            return verifier.verify(Base64.getDecoder().decode(signature));
        } catch (Exception e) {
            return false;
        }
    }

    /** 支付宝要求的时间戳是 GMT+8 墙上时间，服务器在别的时区也不能跟着错。 */
    public String timestamp() {
        return STAMP.format(LocalDateTime.now(SHANGHAI));
    }

    public static String randomState() {
        byte[] bytes = new byte[16];
        RANDOM.nextBytes(bytes);
        return hex(bytes);
    }

    /**
     * 同步回执的验签内容是 `"xxx_response":` 后面那段 JSON 原文，不能用重新序列化的结果：
     * 键顺序和空格一变签名就对不上，所以按括号深度从原文里抠出这一段。
     */
    public static String extractNode(String raw, String key) {
        int at = raw.indexOf("\"" + key + "\":");
        if (at < 0) {
            return null;
        }
        int i = at + key.length() + 3;
        while (i < raw.length() && raw.charAt(i) != '{') {
            i += 1;
        }
        if (i >= raw.length()) {
            return null;
        }
        int depth = 0;
        boolean inString = false;
        boolean escaped = false;
        for (int j = i; j < raw.length(); j += 1) {
            char ch = raw.charAt(j);
            if (inString) {
                if (escaped) {
                    escaped = false;
                } else if (ch == '\\') {
                    escaped = true;
                } else if (ch == '"') {
                    inString = false;
                }
                continue;
            }
            if (ch == '"') {
                inString = true;
            } else if (ch == '{') {
                depth += 1;
            } else if (ch == '}') {
                depth -= 1;
                if (depth == 0) {
                    return raw.substring(i, j + 1);
                }
            }
        }
        return null;
    }

    private JsonNode exec(String method, LinkedHashMap<String, String> extra) {
        ensureKeys();
        if (privateKey == null) {
            throw new IllegalStateException("没有应用私钥，调不了支付宝接口");
        }
        LinkedHashMap<String, String> base = new LinkedHashMap<>();
        base.put("app_id", appId());
        base.put("method", method);
        base.put("format", "JSON");
        base.put("charset", "utf-8");
        base.put("sign_type", "RSA2");
        base.put("timestamp", timestamp());
        base.put("version", "1.0");
        base.putAll(extra);
        base.put("sign", sign(canonical(base)));

        HttpResponse<String> response;
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(props.getAlipay().getGateway()))
                .header("Content-Type", "application/x-www-form-urlencoded; charset=utf-8")
                .timeout(Duration.ofSeconds(30))
                .POST(HttpRequest.BodyPublishers.ofString(form(base), StandardCharsets.UTF_8))
                .build();
            response = http.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("调支付宝网关失败：" + e.getMessage(), e);
        } catch (IOException e) {
            throw new IllegalStateException("调支付宝网关失败：" + e.getMessage(), e);
        }

        String raw = response.body();
        JsonNode body;
        try {
            body = JsonUtil.MAPPER.readTree(raw);
        } catch (Exception e) {
            throw new IllegalStateException(
                "支付宝网关返回的不是 JSON（HTTP " + response.statusCode() + "）：" + prefix(raw));
        }
        if (body == null) {
            throw new IllegalStateException(
                "支付宝网关返回的不是 JSON（HTTP " + response.statusCode() + "）：" + prefix(raw));
        }

        String nodeKey = method.replace('.', '_') + "_response";
        String foundKey = body.has(nodeKey) ? nodeKey : "error_response";
        String signed = extractNode(raw, foundKey);
        JsonNode signature = body.get("sign");
        if (signed != null && signature != null) {
            if (publicKey == null) {
                throw new IllegalStateException("支付宝回执带回来了签名，但后端没有 ALIPAY_PUBLIC_KEY，不敢当可信结果用。");
            }
            if (!verify(signed, signature.asText(), publicKey)) {
                throw new IllegalStateException("支付宝回执验签没过，这次结果不信：" + prefix(raw));
            }
        }

        JsonNode node = body.get(foundKey);
        if (node == null) {
            throw new IllegalStateException("支付宝响应里没有 " + nodeKey + "：" + prefix(raw));
        }
        String code = text(node, "code");
        if ("error_response".equals(foundKey) || (code != null && !code.isEmpty() && !"10000".equals(code))) {
            String subCode = text(node, "sub_code");
            String detail = text(node, "sub_msg");
            if (FitplanProperties.isBlank(detail)) {
                detail = text(node, "msg");
            }
            if (FitplanProperties.isBlank(detail)) {
                detail = code;
            }
            if (FitplanProperties.isBlank(detail)) {
                detail = "调用失败";
            }
            throw new AlipayException("支付宝 " + (subCode == null ? "" : subCode + " ") + detail, code);
        }
        return node;
    }

    private void ensureKeys() {
        if (keysLoaded) {
            return;
        }
        synchronized (this) {
            if (keysLoaded) {
                return;
            }
            Alipay a = props.getAlipay();
            String privatePem = pem(a.getPrivateKey(), a.getPrivateKeyFile(), "PRIVATE KEY");
            String publicPem = pem(a.getPublicKey(), a.getPublicKeyFile(), "PUBLIC KEY");
            try {
                if (privatePem != null) {
                    privateKey = parsePrivate(privatePem);
                }
            } catch (Exception e) {
                log.warn("[alipay] 应用私钥读不了：{}", e.getMessage());
            }
            try {
                if (publicPem != null) {
                    publicKey = parsePublic(publicPem);
                }
            } catch (Exception e) {
                log.warn("[alipay] 支付宝公钥读不了：{}", e.getMessage());
            }
            keysLoaded = true;
        }
    }

    public PublicKey publicKey() {
        ensureKeys();
        return publicKey;
    }

    /** 控制台给的密钥是一串没有换行的 base64，也能直接贴 PEM 文件路径，两种都要能吃。 */
    private static String pem(String raw, String file, String kind) {
        String text = raw;
        if (FitplanProperties.isBlank(text) && !FitplanProperties.isBlank(file)) {
            Path path = Path.of(file.trim());
            if (Files.isReadable(path)) {
                try {
                    text = Files.readString(path, StandardCharsets.UTF_8);
                } catch (IOException e) {
                    log.warn("[alipay] 读不了 {}：{}", path, e.getMessage());
                }
            }
        }
        if (FitplanProperties.isBlank(text)) {
            return null;
        }
        text = text.trim();
        if (text.startsWith("-----BEGIN")) {
            return text;
        }
        String body = text.replaceAll("[^A-Za-z0-9+/=]", "");
        StringBuilder wrapped = new StringBuilder();
        for (int i = 0; i < body.length(); i += 64) {
            wrapped.append(body, i, Math.min(i + 64, body.length())).append('\n');
        }
        return "-----BEGIN " + kind + "-----\n" + wrapped.toString().stripTrailing() + "\n-----END " + kind + "-----\n";
    }

    private static PrivateKey parsePrivate(String pem) throws GeneralSecurityException {
        byte[] der = Base64.getDecoder().decode(base64Body(pem));
        return KeyFactory.getInstance("RSA").generatePrivate(new PKCS8EncodedKeySpec(der));
    }

    private static PublicKey parsePublic(String pem) throws GeneralSecurityException {
        byte[] der = Base64.getDecoder().decode(base64Body(pem));
        return KeyFactory.getInstance("RSA").generatePublic(new X509EncodedKeySpec(der));
    }

    private static String base64Body(String pem) {
        return pem.replaceAll("-----BEGIN [^-]+-----", "")
            .replaceAll("-----END [^-]+-----", "")
            .replaceAll("\\s", "");
    }

    private static String form(Map<String, String> params) {
        StringBuilder out = new StringBuilder();
        for (Map.Entry<String, String> entry : params.entrySet()) {
            if (!out.isEmpty()) {
                out.append('&');
            }
            out.append(encode(entry.getKey())).append('=').append(encode(entry.getValue()));
        }
        return out.toString();
    }

    private static String encode(String value) {
        return URLEncoder.encode(value == null ? "" : value, StandardCharsets.UTF_8);
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value == null || value.isNull() ? null : value.asText();
    }

    private static String prefix(String raw) {
        if (raw == null) {
            return "";
        }
        return raw.substring(0, Math.min(200, raw.length()));
    }

    static String hex(byte[] bytes) {
        StringBuilder out = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) {
            out.append(String.format("%02x", b));
        }
        return out.toString();
    }
}

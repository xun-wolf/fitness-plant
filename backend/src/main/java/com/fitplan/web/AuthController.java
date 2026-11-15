package com.fitplan.web;

import com.fasterxml.jackson.databind.JsonNode;
import com.fitplan.auth.AuthService;
import com.fitplan.config.ApiException;
import com.fitplan.config.FitplanProperties;
import com.fitplan.service.AccountService;
import com.fitplan.service.AlipayClient;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 支付宝授权码登录：发起授权、接回调、换 token、认人、发 JWT，最后带着令牌跳回前端。 */
@RestController
public class AuthController {

    private final AccountService account;
    private final AlipayClient alipay;
    private final FitplanProperties props;
    private final AuthService auth;

    public AuthController(AccountService account, AlipayClient alipay, FitplanProperties props,
                          AuthService auth) {
        this.account = account;
        this.alipay = alipay;
        this.props = props;
        this.auth = auth;
    }

    @GetMapping("/api/auth/alipay/start")
    public void start(HttpServletResponse response) throws IOException {
        List<String> missing = alipay.alipayMissing();
        if (!missing.isEmpty()) {
            throw new ApiException(400, "后端还没配支付宝：" + String.join(" / ", missing));
        }
        String state = AlipayClient.randomState();
        account.putState(state);
        redirect(response, alipay.authorizeUrl(state));
    }

    @GetMapping("/api/auth/alipay/callback")
    public void callback(@RequestParam(value = "auth_code", required = false) String authCode,
                         @RequestParam(value = "state", required = false) String state,
                         HttpServletResponse response) throws IOException {
        if (authCode == null || authCode.isEmpty()) {
            throw new ApiException(400, "回调里没有 auth_code，可能是你在授权页取消了。");
        }
        if (!account.takeState(state == null ? "" : state)) {
            throw new ApiException(400, "state 对不上或已过期，这次登录不接。回设置页重新点登录。");
        }
        JsonNode tokenRes = alipay.oauthToken(authCode);
        JsonNode info = alipay.userInfo(JsonUtilText.of(tokenRes, "access_token"));
        String uid = firstNonEmpty(
            JsonUtilText.of(info, "user_id"),
            JsonUtilText.of(info, "alipay_user_id"),
            JsonUtilText.of(tokenRes, "user_id"),
            JsonUtilText.of(tokenRes, "alipay_user_id"));
        if (uid == null) {
            throw new ApiException(502, "支付宝没回 user_id，无法认人。");
        }
        long userId = account.upsertUser(uid);
        String token = auth.issueForUserId(userId);
        // 令牌走 URL 片段：片段不进服务端访问日志，也不随 Referer 发给第三方
        redirect(response, props.trimmedFront() + "/#token=" + token);
    }

    private static void redirect(HttpServletResponse response, String location) {
        response.setStatus(HttpServletResponse.SC_FOUND);
        response.setHeader("Location", location);
        response.setHeader("Cache-Control", "no-store");
    }

    private static String firstNonEmpty(String... values) {
        for (String value : values) {
            if (value != null && !value.isEmpty()) {
                return value;
            }
        }
        return null;
    }

    private static final class JsonUtilText {

        private JsonUtilText() {
        }

        static String of(JsonNode node, String field) {
            JsonNode value = node == null ? null : node.get(field);
            return value == null || value.isNull() ? null : value.asText();
        }
    }
}

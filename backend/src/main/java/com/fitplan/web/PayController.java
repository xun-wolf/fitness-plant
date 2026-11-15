package com.fitplan.web;

import com.fitplan.auth.security.AuthUser;
import com.fitplan.auth.security.CurrentUser;
import com.fitplan.config.ApiException;
import com.fitplan.config.FitplanProperties;
import com.fitplan.service.AccountService;
import com.fitplan.service.JsonUtil;
import com.fitplan.service.PayService;
import jakarta.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class PayController {

    private static final Logger log = LoggerFactory.getLogger(PayController.class);
    private static final MediaType TEXT = new MediaType(MediaType.TEXT_PLAIN, StandardCharsets.UTF_8);

    private final AccountService account;
    private final PayService pay;
    private final FitplanProperties props;

    public PayController(AccountService account, PayService pay, FitplanProperties props) {
        this.account = account;
        this.pay = pay;
        this.props = props;
    }

    @PostMapping("/api/pay/order")
    public Map<String, Object> createOrder(HttpServletRequest request) {
        AuthUser user = CurrentUser.require();
        if (!pay.payMissing().isEmpty()) {
            throw new ApiException(400, "收款还没在这台服务上开通");
        }
        FitplanProperties.Pay cfg = props.getPay();
        int amountCent = PayService.toCent(cfg.getPriceYuan());
        String outTradeNo = PayService.newOutTradeNo();
        account.createOrder(outTradeNo, user.id(), cfg.getDays(), amountCent);
        String url = pay.payUrl(
            outTradeNo,
            amountCent,
            cfg.getSubject(),
            props.trimmedFront() + "/#/settings/account",
            props.notifyBase() + "/api/pay/notify",
            request.getHeader("User-Agent"));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("url", url);
        out.put("outTradeNo", outTradeNo);
        out.put("amountYuan", PayService.fromCent(amountCent));
        out.put("days", cfg.getDays());
        return out;
    }

    // 从收银台回来时页面问一句「这单算上了没有」；发货本身只认异步通知，这里只是让它早点看得见
    @GetMapping("/api/pay/order")
    public Map<String, Object> orderStatus(@RequestParam(value = "out_trade_no", required = false) String outTradeNo,
                                           HttpServletRequest request) {
        AuthUser user = CurrentUser.require();
        Map<String, Object> order = outTradeNo == null || outTradeNo.isEmpty() ? null : account.getOrder(outTradeNo);
        if (order != null && orderUserId(order) != user.id()) {
            throw new ApiException(403, "这不是你的订单");
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("status", order == null ? "none" : String.valueOf(order.get("status")));
        out.put("plan", user.pro() ? "pro" : "free");
        out.put("expiresAt", JsonUtil.iso(user.planExpiresAt()));
        return out;
    }

    // 支付宝服务器直接打这里：不带会话也不带 Origin，认的是签名不是令牌
    @PostMapping("/api/pay/notify")
    public ResponseEntity<String> notify(@RequestParam MultiValueMap<String, String> form) {
        Map<String, String> params = new LinkedHashMap<>();
        form.forEach((key, values) -> {
            if (!values.isEmpty()) {
                params.put(key, values.get(values.size() - 1));
            }
        });

        PayService.NotifyCheck checked = pay.checkNotify(params);
        if (!checked.ok()) {
            log.info("[pay] 通知被拒：{}", checked.why());
            return text("failure");
        }
        Map<String, Object> order = account.getOrder(params.get("out_trade_no"));
        PayService.Verdict verdict = PayService.settle(params, order);
        if (!verdict.pay()) {
            if (verdict.close()) {
                account.closeOrder(params.get("out_trade_no"));
            }
            log.info("[pay] {} 不发货：{}", params.getOrDefault("out_trade_no", "(无订单号)"), verdict.why());
            // 金额对不上是要人来看的，回 failure 让它重发、日志里留着；其余情况回 success 别再吵
            return text(verdict.mismatch() ? "failure" : "success");
        }
        boolean changed = account.fulfill(params.get("out_trade_no"), params.get("trade_no"));
        log.info("[pay] {} {}", params.get("out_trade_no"), changed ? "发货完成" : "重复通知，已忽略");
        return text("success");
    }

    private static ResponseEntity<String> text(String body) {
        return ResponseEntity.ok().contentType(TEXT).body(body);
    }

    private static long orderUserId(Map<String, Object> order) {
        Object value = order.get("user_id");
        return value instanceof Number number ? number.longValue() : Long.parseLong(String.valueOf(value));
    }
}

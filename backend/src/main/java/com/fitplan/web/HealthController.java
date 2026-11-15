package com.fitplan.web;

import com.fitplan.config.FitplanProperties;
import com.fitplan.service.AccountService;
import com.fitplan.service.AlipayClient;
import com.fitplan.service.PayService;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HealthController {

    private final AccountService account;
    private final AlipayClient alipay;
    private final PayService pay;
    private final FitplanProperties props;

    public HealthController(AccountService account, AlipayClient alipay, PayService pay, FitplanProperties props) {
        this.account = account;
        this.alipay = alipay;
        this.pay = pay;
        this.props = props;
    }

    @GetMapping("/api/health")
    public Map<String, Object> health() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("ok", true);
        out.put("db", account.dbUp() ? "up" : "down");
        out.put("alipay", describe(alipay.alipayMissing()));
        out.put("pay", describe(pay.payMissing()));
        out.put("origins", props.resolvedOrigins());
        return out;
    }

    private static String describe(List<String> missing) {
        return missing.isEmpty() ? "configured" : "missing:" + String.join(" / ", missing);
    }
}

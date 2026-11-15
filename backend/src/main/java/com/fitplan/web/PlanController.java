package com.fitplan.web;

import com.fitplan.auth.security.AuthUser;
import com.fitplan.auth.security.CurrentUser;
import com.fitplan.config.FitplanProperties;
import com.fitplan.service.JsonUtil;
import com.fitplan.service.PayService;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class PlanController {

    private final PayService pay;
    private final FitplanProperties props;

    public PlanController(PayService pay, FitplanProperties props) {
        this.pay = pay;
        this.props = props;
    }

    @GetMapping("/api/plan")
    public Map<String, Object> plan() {
        AuthUser user = CurrentUser.require();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("plan", user.pro() ? "pro" : "free");
        out.put("expiresAt", JsonUtil.iso(user.planExpiresAt()));
        Map<String, Object> price = new LinkedHashMap<>();
        price.put("yuan", props.getPay().getPriceYuan());
        price.put("days", props.getPay().getDays());
        out.put("price", price);
        out.put("payReady", pay.payMissing().isEmpty());
        return out;
    }
}

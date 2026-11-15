package com.fitplan.service;

import com.fitplan.config.FitplanProperties;
import com.fitplan.service.AlipayClient;
import java.math.BigDecimal;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;

/**
 * 收款这一侧全是纯逻辑：下单 URL 怎么拼、通知能不能信、这单该不该发货。
 * 数据库只负责把「该发货」落成一次（orders 上 WHERE status='created' 的那道闸）。
 */
@Service
public class PayService {

    private static final ZoneId SHANGHAI = ZoneId.of("Asia/Shanghai");
    private static final DateTimeFormatter STAMP = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
    private static final Pattern MOBILE = Pattern.compile("android|iphone|ipad|ipod|mobile|harmony", Pattern.CASE_INSENSITIVE);
    private static final SecureRandom RANDOM = new SecureRandom();

    private final FitplanProperties props;
    private final AlipayClient alipay;

    public PayService(FitplanProperties props, AlipayClient alipay) {
        this.props = props;
        this.alipay = alipay;
    }

    /** 收款这一侧缺什么：跟登录共用应用凭据，另外要求 notify 能被支付宝访问到。 */
    public List<String> payMissing() {
        List<String> missing = new ArrayList<>(alipay.alipayMissing());
        if (FitplanProperties.isBlank(props.notifyBase())) {
            missing.add("FITPLAN_PUBLIC_BASE（支付宝异步通知要打得到的公网地址）");
        }
        double price = props.getPay().getPriceYuan();
        if (!Double.isFinite(price) || price <= 0) {
            missing.add("FITPLAN_PRO_PRICE_YUAN（要是个大于 0 的数）");
        }
        if (props.getPay().getDays() <= 0) {
            missing.add("FITPLAN_PRO_DAYS（要是个大于 0 的天数）");
        }
        return missing;
    }

    /** 元 → 分：所有比较都在分上做，浮点数不参与对账。 */
    public static int toCent(double yuan) {
        return (int) Math.round(yuan * 100);
    }

    public static String fromCent(long cent) {
        return BigDecimal.valueOf(cent, 2).toPlainString();
    }

    /** 订单号：本机时间 + 随机后缀，可读又能撞不上。 */
    public static String newOutTradeNo() {
        byte[] bytes = new byte[4];
        RANDOM.nextBytes(bytes);
        return STAMP.format(LocalDateTime.now(SHANGHAI)) + AlipayClient.hex(bytes);
    }

    /** 手机浏览器走 wap.pay，桌面走 page.pay：都是把用户跳到收银台，只差方法名和 product_code。 */
    public String payUrl(String outTradeNo, int amountCent, String subject, String returnUrl, String notifyUrl,
                         String userAgent) {
        boolean mobile = MOBILE.matcher(userAgent == null ? "" : userAgent).find();
        String method = mobile ? "alipay.trade.wap.pay" : "alipay.trade.page.pay";
        String productCode = mobile ? "QUICK_WAP_WAY" : "FAST_INSTANT_TRADE_PAY";

        LinkedHashMap<String, String> biz = new LinkedHashMap<>();
        biz.put("out_trade_no", outTradeNo);
        biz.put("total_amount", fromCent(amountCent));
        biz.put("subject", subject);
        biz.put("product_code", productCode);
        String bizContent = writeJson(biz);

        LinkedHashMap<String, String> base = new LinkedHashMap<>();
        base.put("app_id", alipay.appId());
        base.put("method", method);
        base.put("format", "JSON");
        base.put("charset", "utf-8");
        base.put("sign_type", "RSA2");
        base.put("timestamp", alipay.timestamp());
        base.put("version", "1.0");
        base.put("notify_url", notifyUrl);
        base.put("return_url", returnUrl);
        base.put("biz_content", bizContent);
        base.put("sign", alipay.sign(AlipayClient.canonical(base)));
        return props.getAlipay().getGateway() + "?" + query(base);
    }

    /** 异步通知的待验签串：表单参数按 key 排序拼 k=v，去掉 sign、sign_type 和空值。 */
    public static String notifyContent(Map<String, String> params) {
        LinkedHashMap<String, String> rest = new LinkedHashMap<>();
        for (Map.Entry<String, String> entry : params.entrySet()) {
            String key = entry.getKey();
            String value = entry.getValue();
            if ("sign".equals(key) || "sign_type".equals(key) || value == null || value.isEmpty()) {
                continue;
            }
            rest.put(key, value);
        }
        return AlipayClient.canonical(rest);
    }

    /** 先验签、再认人：签名对了但 app_id 不是我们的，一样不算。 */
    public NotifyCheck checkNotify(Map<String, String> params) {
        String sign = params.get("sign");
        if (sign == null || sign.isEmpty()) {
            return new NotifyCheck(false, "通知里没有 sign");
        }
        if (alipay.publicKey() == null) {
            return new NotifyCheck(false, "后端没有支付宝公钥，验不了这份通知");
        }
        String charset = params.get("charset");
        if (charset != null && !charset.isEmpty() && !"utf-8".equals(charset)) {
            return new NotifyCheck(false, "字符集不是 utf-8（" + charset + "）");
        }
        String content;
        try {
            content = notifyContent(params);
        } catch (RuntimeException e) {
            return new NotifyCheck(false, "通知参数读不了：" + e.getMessage());
        }
        if (!alipay.verify(content, sign, alipay.publicKey())) {
            return new NotifyCheck(false, "验签没过，这份通知不信");
        }
        String configuredAppId = alipay.appId();
        String notifiedAppId = params.get("app_id");
        if (!FitplanProperties.isBlank(configuredAppId) && notifiedAppId != null && !notifiedAppId.isEmpty()
            && !configuredAppId.equals(notifiedAppId)) {
            return new NotifyCheck(false, "app_id 不是这个应用的");
        }
        return new NotifyCheck(true, null);
    }

    /**
     * 该不该发货：只看三样 —— 订单在不在、金额对不对、状态是不是已付款。
     * 金额一律跟下单时存进库的分值比，通知里写多少都不作数。
     */
    public static Verdict settle(Map<String, String> params, Map<String, Object> order) {
        String outTradeNo = params.get("out_trade_no");
        if (outTradeNo == null || outTradeNo.isEmpty()) {
            return new Verdict(false, false, false, false, "通知里没有 out_trade_no");
        }
        if (order == null) {
            return new Verdict(false, false, false, false, "库里没有这单：" + outTradeNo);
        }
        String status = String.valueOf(order.get("status"));
        if ("paid".equals(status)) {
            return new Verdict(false, false, false, true, "这单已经发过货了");
        }
        if (!"created".equals(status)) {
            return new Verdict(false, false, false, false, "这单状态是 " + status + "，不发");
        }
        Long cents = centOf(params.get("total_amount"));
        long stored = order.get("amount_cent") instanceof Number number ? number.longValue() : 0L;
        if (cents == null || cents != stored) {
            return new Verdict(false, false, true, false,
                "金额对不上：通知 " + nullText(params.get("total_amount")) + " 元，订单 " + fromCent(stored) + " 元");
        }
        String tradeStatus = params.get("trade_status");
        if ("TRADE_SUCCESS".equals(tradeStatus) || "TRADE_FINISHED".equals(tradeStatus)) {
            return new Verdict(true, false, false, false, null);
        }
        if ("TRADE_CLOSED".equals(tradeStatus)) {
            return new Verdict(false, true, false, false, "交易已关闭");
        }
        return new Verdict(false, false, false, false,
            "交易状态 " + nullText(tradeStatus) + "，还不算付成功");
    }

    private static Long centOf(String yuan) {
        if (yuan == null || yuan.isEmpty()) {
            return null;
        }
        try {
            return Math.round(Double.parseDouble(yuan) * 100);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static String nullText(String value) {
        return value == null || value.isEmpty() ? "(空)" : value;
    }

    private static String writeJson(Map<String, String> values) {
        try {
            return JsonUtil.MAPPER.writeValueAsString(values);
        } catch (Exception e) {
            throw new IllegalStateException("下单参数序列化失败：" + e.getMessage(), e);
        }
    }

    private static String query(Map<String, String> params) {
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
        return java.net.URLEncoder.encode(value == null ? "" : value, java.nio.charset.StandardCharsets.UTF_8);
    }

    public record NotifyCheck(boolean ok, String why) {
    }

    public record Verdict(boolean pay, boolean close, boolean mismatch, boolean duplicate, String why) {
    }
}

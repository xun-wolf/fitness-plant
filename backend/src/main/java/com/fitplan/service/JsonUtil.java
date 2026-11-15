package com.fitplan.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;

/** 记录接口的 JSON 语义要和 Node 版一模一样：空值落库、默认值、时间格式都在这儿统一。 */
public final class JsonUtil {

    public static final ObjectMapper MAPPER = new ObjectMapper();

    private static final ZoneId SHANGHAI = ZoneId.of("Asia/Shanghai");
    private static final DateTimeFormatter ISO_UTC =
        DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'").withZone(ZoneOffset.UTC);

    private JsonUtil() {
    }

    /** JS 的 ??：只有 null / undefined 才落到默认值，false、0、空串都保留。 */
    public static JsonNode or(JsonNode node, JsonNode fallback) {
        return node == null || node.isNull() || node.isMissingNode() ? fallback : node;
    }

    /** JS 的真值判断：空数组和空对象也是真。 */
    public static boolean truthy(JsonNode node) {
        if (node == null || node.isNull() || node.isMissingNode()) {
            return false;
        }
        if (node.isBoolean()) {
            return node.asBoolean();
        }
        if (node.isNumber()) {
            return node.asDouble() != 0;
        }
        if (node.isTextual()) {
            return !node.asText().isEmpty();
        }
        return true;
    }

    public static String stringify(JsonNode node) {
        try {
            return MAPPER.writeValueAsString(node);
        } catch (Exception e) {
            throw new IllegalStateException("JSON 序列化失败：" + e.getMessage(), e);
        }
    }

    public static JsonNode array() {
        return MAPPER.createArrayNode();
    }

    public static JsonNode object() {
        return MAPPER.createObjectNode();
    }

    /** 服务器时钟的「刚刚」：Node 的 new Date().toISOString() 是毫秒精度。 */
    public static String isoNow() {
        return ISO_UTC.format(Instant.now());
    }

    /** DATETIME 按上海墙上时间理解，再转成 UTC 的 ISO 串，和 mysql2 交给 JSON.stringify 的结果一致。 */
    public static String iso(Timestamp ts) {
        if (ts == null) {
            return null;
        }
        return ISO_UTC.format(ts.toLocalDateTime().atZone(SHANGHAI).toInstant());
    }

    public static String iso(Object value) {
        if (value instanceof Timestamp ts) {
            return iso(ts);
        }
        if (value instanceof LocalDateTime local) {
            return ISO_UTC.format(local.atZone(SHANGHAI).toInstant());
        }
        return null;
    }
}

package com.fitplan.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fitplan.config.ApiException;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.regex.Pattern;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 一个登录用户的记录进出云端。
 * 语义是「整份替换」：这台设备上传了什么，库里就是什么 —— 本机删掉的条目跟着消失，
 * 两边不用合并，也不需要墓碑。时间一律按客户端给的原样存字符串，服务器只另记 uploaded_at。
 */
@Service
public class RecordsService {

    /** 单次上传每类条目的行数上限：真练起来一年也就几百张表，超了是客户端出 bug 了 */
    private static final int ROW_LIMIT = 20000;

    private static final Pattern DATE = Pattern.compile("^\\d{4}-\\d{2}-\\d{2}$");
    private static final Pattern ID = Pattern.compile("^[\\w:.-]+$");
    private static final Set<String> SEX = Set.of("male", "female");
    private static final Set<String> ACTIVITY_KINDS = Set.of("cardio", "sport", "lift", "walk", "other");
    private static final Set<String> MEAL_SLOTS = Set.of("breakfast", "lunch", "dinner", "snack");

    private static final String[] PROFILE_COLUMNS = {
        "sex", "age", "height_cm", "weight_kg", "body_fat_pct", "experience_years", "last_solid_block",
        "injuries", "injuries_answered", "commercial_gym", "extra_equipment", "weekdays", "session_minutes",
        "goal_wish", "goal", "sleep_hours", "daily_steps", "diet_restrictions", "no_cardio", "home_only",
        "avoid_names", "day_areas", "onboarded", "favorites"
    };

    private static final String[] FRAMEWORK_COLUMNS = {
        "framework_id", "start_date", "created_ts", "weeks_total", "days", "weeks", "rules", "goal", "assumed"
    };

    private static final String[] SHEET_COLUMNS = {
        "sheet_id", "day_date", "weekday", "focus", "budget_minutes", "load_adjust_pct",
        "input", "slots", "overrides", "skipped", "assumed", "flags", "dropped", "created_ts"
    };

    private static final String[] SET_COLUMNS = {
        "sheet_id", "slot_id", "set_idx", "ex_id", "day_date",
        "weight_kg", "reps", "target_reps", "rpe", "to_failure", "done_ts"
    };

    private static final String[] ACTIVITY_COLUMNS = {
        "log_id", "day_date", "name", "minutes", "kind", "feel", "areas", "ex_ids", "note", "logged_ts"
    };

    private static final String[] MEAL_COLUMNS = {
        "log_id", "day_date", "slot", "name", "kcal",
        "protein_g", "carbs_g", "fat_g", "sugar_g", "sodium_mg", "note", "logged_ts"
    };

    private static final String[] MEASURE_COLUMNS = {"log_id", "day_date", "weight_kg", "waist_cm", "note", "logged_ts"};

    private record TableDef(String key, String table, String order, String label, String[] columns,
                            Function<JsonNode, Object[]> shape,
                            Function<Map<String, Object>, Map<String, Object>> read) {
    }

    private static final List<TableDef> LISTS = List.of(
        new TableDef("sheets", "day_sheets", "day_date, created_ts", "今日表", SHEET_COLUMNS,
            RecordsService::sheetValues, RecordsService::rowToSheet),
        new TableDef("setLogs", "set_logs", "day_date, done_ts, set_idx", "逐组记录", SET_COLUMNS,
            RecordsService::setValues, RecordsService::rowToSetLog),
        new TableDef("activityLogs", "activity_logs", "day_date, logged_ts", "运动记录", ACTIVITY_COLUMNS,
            RecordsService::activityValues, RecordsService::rowToActivity),
        new TableDef("mealLogs", "meal_logs", "day_date, logged_ts", "饮食记录", MEAL_COLUMNS,
            RecordsService::mealValues, RecordsService::rowToMeal),
        new TableDef("measureLogs", "measure_logs", "day_date", "体重腰围打卡", MEASURE_COLUMNS,
            RecordsService::measureValues, RecordsService::rowToMeasure)
    );

    private static final String[] RECORD_TABLES = {
        "profiles", "frameworks", "day_sheets", "set_logs", "activity_logs", "meal_logs", "measure_logs"
    };

    private final JdbcTemplate jdbc;

    public RecordsService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** 整份替换：传进来的这套就是云端这一类的全集。 */
    @Transactional
    public Map<String, Object> replaceRecords(long userId, JsonNode data) {
        JsonNode profile = data == null ? null : data.get("profile");
        if (profile == null || !profile.isObject()) {
            throw bad("传上来的里没有档案，不敢当一份完整的记录覆盖过去");
        }
        for (TableDef def : LISTS) {
            JsonNode rows = data.get(def.key());
            if (rows == null || !rows.isArray()) {
                throw bad("「" + def.label() + "」不是列表");
            }
            if (rows.size() > ROW_LIMIT) {
                throw bad("「" + def.label() + "」有 " + rows.size() + " 条，超过单次上限 " + ROW_LIMIT + " 条");
            }
        }

        deleteAll(userId);
        Map<String, Object> counts = new LinkedHashMap<>();
        counts.put("profiles",
            insert("profiles", PROFILE_COLUMNS, Collections.singletonList(withUser(userId, profileValues(profile, data)))));
        JsonNode framework = data.get("framework");
        counts.put("frameworks", JsonUtil.truthy(framework)
            ? insert("frameworks", FRAMEWORK_COLUMNS,
                Collections.singletonList(withUser(userId, frameworkValues(framework))))
            : 0);
        for (TableDef def : LISTS) {
            List<Object[]> rows = new ArrayList<>();
            for (JsonNode row : data.get(def.key())) {
                rows.add(withUser(userId, def.shape().apply(row)));
            }
            counts.put(def.table(), insert(def.table(), def.columns(), rows));
        }
        return counts;
    }

    @Transactional
    public void clearRecords(long userId) {
        deleteAll(userId);
    }

    /** 回来的都是按日期正着排的，前端拿到就是一份长起来的存档。 */
    public Map<String, Object> readRecords(long userId) {
        List<Map<String, Object>> profile = jdbc.queryForList(
            "SELECT " + String.join(",", PROFILE_COLUMNS) + " FROM profiles WHERE user_id = ? LIMIT 1", userId);
        if (profile.isEmpty()) {
            return null;
        }
        Map<String, Object> out = new LinkedHashMap<>();
        Map<String, Object> row = profile.get(0);
        out.put("profile", rowToProfile(row));
        out.put("onboarded", boolOf(row.get("onboarded")));
        out.put("favorites", jsonValue(row.get("favorites"), JsonUtil.array()));
        List<Map<String, Object>> framework = jdbc.queryForList(
            "SELECT " + String.join(",", FRAMEWORK_COLUMNS) + " FROM frameworks WHERE user_id = ? LIMIT 1", userId);
        out.put("framework", framework.isEmpty() ? null : rowToFramework(framework.get(0)));
        for (TableDef def : LISTS) {
            List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT " + String.join(",", def.columns()) + " FROM " + def.table()
                    + " WHERE user_id = ? ORDER BY " + def.order(),
                userId);
            List<Map<String, Object>> mapped = new ArrayList<>();
            for (Map<String, Object> each : rows) {
                mapped.add(def.read().apply(each));
            }
            out.put(def.key(), mapped);
        }
        List<Map<String, Object>> meta = jdbc.queryForList(
            "SELECT uploaded_at FROM profiles WHERE user_id = ? LIMIT 1", userId);
        out.put("syncedAt", meta.isEmpty() ? null : JsonUtil.iso(meta.get(0).get("uploaded_at")));
        return out;
    }

    private void deleteAll(long userId) {
        for (String table : RECORD_TABLES) {
            jdbc.update("DELETE FROM " + table + " WHERE user_id = ?", userId);
        }
    }

    private int insert(String table, String[] columns, List<Object[]> rows) {
        if (rows.isEmpty()) {
            return 0;
        }
        List<String> holders = new ArrayList<>();
        for (int i = 0; i <= columns.length; i += 1) {
            holders.add("?");
        }
        String sql = "INSERT INTO " + table + " (user_id," + String.join(",", columns) + ")"
            + " VALUES (" + String.join(",", holders) + ")";
        jdbc.batchUpdate(sql, rows);
        return rows.size();
    }

    private static Object[] withUser(long userId, Object[] values) {
        Object[] row = new Object[values.length + 1];
        row[0] = userId;
        System.arraycopy(values, 0, row, 1, values.length);
        return row;
    }

    // ---- 上传这一侧：逐字段校验，报错话术和 Node 版一字不差 ----

    private static Object[] profileValues(JsonNode p, JsonNode state) {
        JsonNode sex = at(p, "sex");
        if (!absent(sex) && (!sex.isTextual() || !SEX.contains(sex.asText()))) {
            throw bad("性别只有 male / female 两种写法：" + display(sex));
        }
        return new Object[] {
            absent(sex) ? null : sex.asText(),
            num(at(p, "age"), "年龄", 120, 0, false, false),
            num(at(p, "heightCm"), "身高", 400, 0, false, false),
            num(at(p, "weightKg"), "体重", 500, 0, false, false),
            num(at(p, "bodyFatPct"), "体脂率", 70, 0, false, false),
            num(at(p, "experienceYears"), "训练年限", 999, 0, false, false),
            JsonUtil.truthy(at(p, "lastSolidBlock"))
                ? dateStr(at(p, "lastSolidBlock"), "上次认真练完一轮的日期") : null,
            jsonOr(at(p, "injuries"), JsonUtil.array()),
            truthyFlag(at(p, "injuriesAnswered")),
            nullableFlag(at(p, "commercialGym")),
            text(at(p, "extraEquipment"), "其他器械", 500, false),
            jsonIfArray(at(p, "weekdays")),
            num(at(p, "sessionMinutes"), "一次练多久", 600, 0, false, false),
            text(at(p, "goalWish"), "想要的目标", 1000, false),
            jsonNullable(at(p, "goal")),
            num(at(p, "sleepHours"), "睡几个小时", 24, 0, false, false),
            num(at(p, "dailySteps"), "每天步数", 65535, 0, false, false),
            text(at(p, "dietRestrictions"), "饮食限制", 500, false),
            truthyFlag(at(p, "noCardio")),
            truthyFlag(at(p, "homeOnly")),
            jsonOr(at(p, "avoidNames"), JsonUtil.array()),
            jsonOr(at(p, "dayAreas"), JsonUtil.object()),
            truthyFlag(at(state, "onboarded")),
            jsonIfArray(at(state, "favorites"), JsonUtil.array())
        };
    }

    private static Object[] frameworkValues(JsonNode f) {
        return new Object[] {
            id(at(f, "id"), "周框架 id", 40),
            dateStr(at(f, "startDate"), "周框架起始日"),
            tsStr(at(f, "createdAt"), "周框架生成时间"),
            defaultValue(num(at(f, "weeksTotal"), "一共几周", 255, 1, false, false), 4),
            jsonOr(at(f, "days"), JsonUtil.array()),
            jsonOr(at(f, "weeks"), JsonUtil.array()),
            jsonOr(at(f, "rules"), JsonUtil.array()),
            jsonNullable(at(f, "goal")),
            jsonOr(at(f, "assumed"), JsonUtil.array())
        };
    }

    private static Object[] sheetValues(JsonNode s) {
        return new Object[] {
            id(at(s, "id"), "今日表 id", 40),
            dateStr(at(s, "date"), "今日表日期"),
            defaultValue(num(at(s, "weekday"), "星期", 6, 0, false, false), 0),
            text(at(s, "focus"), "这天练哪里", 40, false),
            defaultValue(num(at(s, "budgetMinutes"), "这天的工作量", 65535, 0, false, false), 0),
            defaultValue(num(at(s, "loadAdjustPct"), "载重调整", 9999, 0, true, false), 0),
            jsonOr(at(s, "input"), JsonUtil.object()),
            jsonOr(at(s, "slots"), JsonUtil.array()),
            jsonOr(at(s, "overrides"), JsonUtil.object()),
            jsonOr(at(s, "skipped"), JsonUtil.array()),
            jsonOr(at(s, "assumed"), JsonUtil.array()),
            jsonOr(at(s, "flags"), JsonUtil.array()),
            jsonOr(at(s, "dropped"), JsonUtil.array()),
            tsStr(at(s, "createdAt"), "今日表生成时间")
        };
    }

    private static Object[] setValues(JsonNode l) {
        return new Object[] {
            id(at(l, "sheetId"), "今日表 id", 40),
            id(at(l, "slotId"), "动作行 id", 48),
            num(at(l, "setIdx"), "第几组", 65535, 0, false, true),
            id(at(l, "exId"), "动作 id", 48),
            dateStr(at(l, "date"), "训练日期"),
            num(at(l, "weightKg"), "重量", 9999, 0, false, false),
            num(at(l, "reps"), "做了几个", 65535, 0, false, true),
            defaultValue(num(at(l, "targetReps"), "目标几个", 65535, 0, false, false), 0),
            num(at(l, "rpe"), "RPE", 10, 0, false, false),
            truthyFlag(at(l, "toFailure")),
            tsStr(at(l, "ts"), "记下这条的时间")
        };
    }

    private static Object[] activityValues(JsonNode a) {
        JsonNode kind = at(a, "kind");
        if (absent(kind) || !kind.isTextual() || !ACTIVITY_KINDS.contains(kind.asText())) {
            throw bad("运动类型不认得：" + display(kind));
        }
        return new Object[] {
            id(at(a, "id"), "运动记录 id", 40),
            dateStr(at(a, "date"), "运动日期"),
            text(at(a, "name"), "做了什么", 500, true),
            defaultValue(num(at(a, "minutes"), "练了多久", 65535, 0, false, false), 0),
            kind.asText(),
            num(at(a, "feel"), "练完的状态", 5, 1, false, false),
            jsonOr(at(a, "areas"), JsonUtil.array()),
            jsonOr(at(a, "exIds"), JsonUtil.array()),
            text(at(a, "note"), "备注", 1000, false),
            tsStr(at(a, "ts"), "记下这条的时间")
        };
    }

    private static Object[] mealValues(JsonNode m) {
        JsonNode slot = at(m, "slot");
        if (absent(slot) || !slot.isTextual() || !MEAL_SLOTS.contains(slot.asText())) {
            throw bad("这一餐的时段不认得：" + display(slot));
        }
        return new Object[] {
            id(at(m, "id"), "饮食记录 id", 40),
            dateStr(at(m, "date"), "吃饭日期"),
            slot.asText(),
            text(at(m, "name"), "吃了什么", 500, true),
            num(at(m, "kcal"), "热量", 999999, 0, false, false),
            num(at(m, "proteinG"), "蛋白质", 999999, 0, false, false),
            num(at(m, "carbsG"), "碳水", 999999, 0, false, false),
            num(at(m, "fatG"), "脂肪", 999999, 0, false, false),
            num(at(m, "sugarG"), "糖", 999999, 0, false, false),
            num(at(m, "sodiumMg"), "钠", 4294967295L, 0, false, false),
            text(at(m, "note"), "备注", 1000, false),
            tsStr(at(m, "ts"), "记下这条的时间")
        };
    }

    private static Object[] measureValues(JsonNode m) {
        Object weight = num(at(m, "weightKg"), "体重", 500, 0, false, false);
        Object waist = num(at(m, "waistCm"), "腰围", 300, 0, false, false);
        if (weight == null && waist == null) {
            throw bad("体重和腰围总得填一个，两个都空着的打卡没什么可存的");
        }
        return new Object[] {
            id(at(m, "id"), "打卡 id", 40),
            dateStr(at(m, "date"), "打卡日期"),
            weight,
            waist,
            text(at(m, "note"), "备注", 1000, false),
            tsStr(at(m, "ts"), "记下这条的时间")
        };
    }

    // ---- 下载这一侧：列名转回驼峰，空值保持空 ----

    private static Map<String, Object> rowToProfile(Map<String, Object> r) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("sex", r.get("sex"));
        out.put("age", n(r.get("age")));
        out.put("heightCm", n(r.get("height_cm")));
        out.put("weightKg", n(r.get("weight_kg")));
        out.put("bodyFatPct", n(r.get("body_fat_pct")));
        out.put("experienceYears", n(r.get("experience_years")));
        out.put("lastSolidBlock", r.get("last_solid_block"));
        out.put("injuries", jsonValue(r.get("injuries"), JsonUtil.array()));
        out.put("injuriesAnswered", boolOf(r.get("injuries_answered")));
        out.put("commercialGym", nullableBoolOf(r.get("commercial_gym")));
        out.put("extraEquipment", r.get("extra_equipment"));
        out.put("weekdays", jsonValue(r.get("weekdays"), null));
        out.put("sessionMinutes", n(r.get("session_minutes")));
        out.put("goalWish", r.get("goal_wish") == null ? "" : r.get("goal_wish"));
        out.put("goal", jsonValue(r.get("goal"), null));
        out.put("sleepHours", n(r.get("sleep_hours")));
        out.put("dailySteps", n(r.get("daily_steps")));
        out.put("dietRestrictions", r.get("diet_restrictions"));
        out.put("noCardio", boolOf(r.get("no_cardio")));
        out.put("homeOnly", boolOf(r.get("home_only")));
        out.put("avoidNames", jsonValue(r.get("avoid_names"), JsonUtil.array()));
        out.put("dayAreas", jsonValue(r.get("day_areas"), JsonUtil.object()));
        return out;
    }

    private static Map<String, Object> rowToFramework(Map<String, Object> r) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", r.get("framework_id"));
        out.put("startDate", r.get("start_date"));
        out.put("createdAt", r.get("created_ts"));
        out.put("weeksTotal", n(r.get("weeks_total")));
        out.put("days", jsonValue(r.get("days"), JsonUtil.array()));
        out.put("weeks", jsonValue(r.get("weeks"), JsonUtil.array()));
        out.put("rules", jsonValue(r.get("rules"), JsonUtil.array()));
        out.put("goal", jsonValue(r.get("goal"), null));
        out.put("assumed", jsonValue(r.get("assumed"), JsonUtil.array()));
        return out;
    }

    private static Map<String, Object> rowToSheet(Map<String, Object> r) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", r.get("sheet_id"));
        out.put("createdAt", r.get("created_ts"));
        out.put("date", r.get("day_date"));
        out.put("weekday", n(r.get("weekday")));
        out.put("focus", r.get("focus"));
        out.put("budgetMinutes", n(r.get("budget_minutes")));
        out.put("loadAdjustPct", n(r.get("load_adjust_pct")));
        out.put("input", jsonValue(r.get("input"), JsonUtil.object()));
        out.put("slots", jsonValue(r.get("slots"), JsonUtil.array()));
        out.put("overrides", jsonValue(r.get("overrides"), JsonUtil.object()));
        out.put("skipped", jsonValue(r.get("skipped"), JsonUtil.array()));
        out.put("assumed", jsonValue(r.get("assumed"), JsonUtil.array()));
        out.put("flags", jsonValue(r.get("flags"), JsonUtil.array()));
        out.put("dropped", jsonValue(r.get("dropped"), JsonUtil.array()));
        return out;
    }

    private static Map<String, Object> rowToSetLog(Map<String, Object> r) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("slotId", r.get("slot_id"));
        out.put("sheetId", r.get("sheet_id"));
        out.put("exId", r.get("ex_id"));
        out.put("date", r.get("day_date"));
        out.put("setIdx", n(r.get("set_idx")));
        out.put("weightKg", n(r.get("weight_kg")));
        out.put("reps", n(r.get("reps")));
        out.put("targetReps", n(r.get("target_reps")));
        out.put("rpe", n(r.get("rpe")));
        out.put("toFailure", boolOf(r.get("to_failure")));
        out.put("ts", r.get("done_ts"));
        return out;
    }

    private static Map<String, Object> rowToActivity(Map<String, Object> r) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", r.get("log_id"));
        out.put("date", r.get("day_date"));
        out.put("name", r.get("name"));
        out.put("minutes", n(r.get("minutes")));
        out.put("kind", r.get("kind"));
        out.put("feel", n(r.get("feel")));
        out.put("areas", jsonValue(r.get("areas"), JsonUtil.array()));
        out.put("exIds", jsonValue(r.get("ex_ids"), JsonUtil.array()));
        out.put("note", r.get("note") == null ? "" : r.get("note"));
        out.put("ts", r.get("logged_ts"));
        return out;
    }

    private static Map<String, Object> rowToMeal(Map<String, Object> r) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", r.get("log_id"));
        out.put("date", r.get("day_date"));
        out.put("slot", r.get("slot"));
        out.put("name", r.get("name"));
        out.put("kcal", n(r.get("kcal")));
        out.put("proteinG", n(r.get("protein_g")));
        out.put("carbsG", n(r.get("carbs_g")));
        out.put("fatG", n(r.get("fat_g")));
        out.put("sugarG", n(r.get("sugar_g")));
        out.put("sodiumMg", n(r.get("sodium_mg")));
        out.put("note", r.get("note") == null ? "" : r.get("note"));
        out.put("ts", r.get("logged_ts"));
        return out;
    }

    private static Map<String, Object> rowToMeasure(Map<String, Object> r) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", r.get("log_id"));
        out.put("date", r.get("day_date"));
        out.put("weightKg", n(r.get("weight_kg")));
        out.put("waistCm", n(r.get("waist_cm")));
        out.put("note", r.get("note") == null ? "" : r.get("note"));
        out.put("ts", r.get("logged_ts"));
        return out;
    }

    // ---- 基础工具 ----

    private static JsonNode at(JsonNode node, String key) {
        return node == null ? null : node.get(key);
    }

    private static RuntimeException bad(String message) {
        return new ApiException(400, message);
    }

    private static boolean absent(JsonNode node) {
        return node == null || node.isNull() || node.isMissingNode();
    }

    private static String display(JsonNode node) {
        if (node == null || node.isMissingNode()) {
            return "undefined";
        }
        if (node.isTextual()) {
            return node.asText();
        }
        return node.toString();
    }

    private static Object defaultValue(Object value, Object fallback) {
        return value == null ? fallback : value;
    }

    private static Object num(JsonNode value, String label, long max, long min, boolean allowNegative,
                              boolean required) {
        if (absent(value) || (value.isTextual() && value.asText().isEmpty())) {
            if (required) {
                throw bad(label + " 不能空着");
            }
            return null;
        }
        double n;
        if (value.isNumber()) {
            n = value.asDouble();
        } else if (value.isBoolean()) {
            n = value.asBoolean() ? 1 : 0;
        } else if (value.isTextual()) {
            try {
                n = Double.parseDouble(value.asText());
            } catch (NumberFormatException e) {
                throw bad(label + " 不是个数：" + value.asText());
            }
        } else {
            throw bad(label + " 不是个数：" + value);
        }
        if (!Double.isFinite(n)) {
            throw bad(label + " 不是个数：" + display(value));
        }
        double low = allowNegative ? -max : min;
        if (n < low || n > max) {
            throw bad(label + " 超出能存的范围（" + show(low) + " ~ " + show(max) + "）：" + show(n));
        }
        return integral(n) ? (Object) (long) n : (Object) n;
    }

    private static boolean integral(double n) {
        return n == Math.rint(n) && Math.abs(n) <= 9_007_199_254_740_991L;
    }

    private static String show(double n) {
        return integral(n) ? Long.toString((long) n) : Double.toString(n);
    }

    private static String text(JsonNode value, String label, int max, boolean required) {
        if (absent(value)) {
            if (required) {
                throw bad(label + " 不能空着");
            }
            return null;
        }
        if (!value.isTextual()) {
            throw bad(label + " 不是文字");
        }
        String s = value.asText();
        if (s.length() > max) {
            throw bad(label + " 太长（" + s.length() + " 个字，最多 " + max + "）");
        }
        return s;
    }

    private static Integer truthyFlag(JsonNode value) {
        return JsonUtil.truthy(value) ? 1 : 0;
    }

    private static Integer nullableFlag(JsonNode value) {
        return absent(value) ? null : (JsonUtil.truthy(value) ? 1 : 0);
    }

    private static String dateStr(JsonNode value, String label) {
        String s = text(value, label, 10, true);
        if (!DATE.matcher(s).matches()) {
            throw bad(label + " 不是 YYYY-MM-DD 这种写法：" + s);
        }
        return s;
    }

    private static String tsStr(JsonNode value, String label) {
        String s = text(value, label, 32, true);
        if (!parses(s)) {
            throw bad(label + " 认不出来是哪个时刻：" + s);
        }
        return s;
    }

    /** Node 那边认 Date.parse 的口径：全是本机时间，不带时区也能读。 */
    private static boolean parses(String text) {
        try {
            Instant.parse(text);
            return true;
        } catch (Exception ignored) {
            // 继续试别的写法
        }
        try {
            OffsetDateTime.parse(text);
            return true;
        } catch (Exception ignored) {
            // 继续试别的写法
        }
        try {
            LocalDateTime.parse(text);
            return true;
        } catch (Exception ignored) {
            // 继续试别的写法
        }
        try {
            LocalDate.parse(text);
            return true;
        } catch (Exception ignored) {
            return false;
        }
    }

    private static String id(JsonNode value, String label, int max) {
        String s = text(value, label, max, true);
        if (!ID.matcher(s).matches()) {
            throw bad(label + " 里有不认得的字符：" + s);
        }
        return s;
    }

    private static String jsonOr(JsonNode value, JsonNode fallback) {
        return JsonUtil.stringify(JsonUtil.or(value, fallback));
    }

    private static String jsonNullable(JsonNode value) {
        return absent(value) ? null : JsonUtil.stringify(value);
    }

    private static String jsonIfArray(JsonNode value) {
        return value != null && value.isArray() ? JsonUtil.stringify(value) : null;
    }

    private static String jsonIfArray(JsonNode value, JsonNode fallback) {
        return value != null && value.isArray() ? JsonUtil.stringify(value) : JsonUtil.stringify(fallback);
    }

    private static Object n(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof BigDecimal decimal) {
            BigDecimal stripped = decimal.stripTrailingZeros();
            return stripped.scale() <= 0 ? (Object) stripped.longValue() : (Object) decimal.doubleValue();
        }
        if (value instanceof Number) {
            return value;
        }
        if (value instanceof String text) {
            try {
                double d = Double.parseDouble(text);
                return d == Math.rint(d) && !text.contains(".") ? (Object) (long) d : (Object) d;
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return value;
    }

    private static boolean boolOf(Object value) {
        if (value == null) {
            return false;
        }
        if (value instanceof Boolean bool) {
            return bool;
        }
        if (value instanceof Number number) {
            return number.intValue() != 0;
        }
        return Boolean.parseBoolean(String.valueOf(value));
    }

    private static Boolean nullableBoolOf(Object value) {
        return value == null ? null : boolOf(value);
    }

    private static JsonNode jsonValue(Object value, JsonNode fallback) {
        if (value == null) {
            return fallback;
        }
        if (value instanceof String text) {
            try {
                return JsonUtil.MAPPER.readTree(text);
            } catch (Exception e) {
                return fallback;
            }
        }
        return JsonUtil.MAPPER.valueToTree(value);
    }
}

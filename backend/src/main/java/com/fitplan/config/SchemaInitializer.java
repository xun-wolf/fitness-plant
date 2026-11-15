package com.fitplan.config;

import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * 建表和 Node 版 setup 用同一份 server/schema.sql，不在这边再抄一遍 DDL。
 * 起来时先把库建出来（不存在才建），再逐条执行 IF NOT EXISTS 的建表语句。
 */
@Component
public class SchemaInitializer {

    private static final Logger log = LoggerFactory.getLogger(SchemaInitializer.class);
    private static final Pattern DB_URL = Pattern.compile("jdbc:mysql://([^/]+)/([^?]*)(\\?.*)?");
    private static final List<String> CANDIDATES =
        List.of("server/schema.sql", "../server/schema.sql", "../../server/schema.sql");

    private final JdbcTemplate jdbc;
    private final Environment env;

    public SchemaInitializer(JdbcTemplate jdbc, Environment env) {
        this.jdbc = jdbc;
        this.env = env;
    }

    @PostConstruct
    public void init() {
        String url = env.getProperty("spring.datasource.url");
        if (url == null || url.isBlank()) {
            return;
        }
        Matcher m = DB_URL.matcher(url);
        if (!m.matches()) {
            log.warn("[fitplan-api] 认不出 spring.datasource.url，跳过建表");
            return;
        }
        String host = m.group(1);
        String database = m.group(2);
        String query = m.group(3) == null ? "" : m.group(3);
        if (database == null || database.isBlank()) {
            return;
        }
        String user = env.getProperty("spring.datasource.username", "root");
        String password = env.getProperty("spring.datasource.password", "");

        try (Connection conn = DriverManager.getConnection("jdbc:mysql://" + host + "/" + query, user, password);
             Statement st = conn.createStatement()) {
            st.execute("CREATE DATABASE IF NOT EXISTS `" + database.replace("`", "") + "` CHARACTER SET utf8mb4");
        } catch (Exception e) {
            log.warn("[fitplan-api] 建库失败（库已经存在就忽略）：{}", e.getMessage());
        }

        Path schema = locate();
        if (schema == null) {
            log.warn("[fitplan-api] 没找到 server/schema.sql，跳过建表");
            return;
        }
        try {
            for (String statement : statements(Files.readString(schema, StandardCharsets.UTF_8))) {
                jdbc.execute(statement);
            }
            log.info("[fitplan-api] 建表就位（{}）", schema.toAbsolutePath());
        } catch (Exception e) {
            log.warn("[fitplan-api] 建表没跑完：{}", e.getMessage());
        }
    }

    private static Path locate() {
        String override = System.getProperty("fitplan.schema-file");
        if (FitplanProperties.isBlank(override)) {
            override = System.getenv("FITPLAN_SCHEMA_FILE");
        }
        if (!FitplanProperties.isBlank(override)) {
            Path direct = Path.of(override.trim());
            return Files.isReadable(direct) ? direct : null;
        }
        for (String candidate : CANDIDATES) {
            Path path = Path.of(candidate);
            if (Files.isReadable(path)) {
                return path;
            }
        }
        return null;
    }

    private static List<String> statements(String schema) throws IOException {
        StringBuilder withoutComments = new StringBuilder();
        for (String line : schema.split("\r?\n")) {
            if (!line.trim().startsWith("--")) {
                withoutComments.append(line).append('\n');
            }
        }
        List<String> out = new ArrayList<>();
        for (String part : withoutComments.toString().split(";")) {
            String trimmed = part.trim();
            if (!trimmed.isEmpty()) {
                out.add(trimmed);
            }
        }
        return out;
    }
}

package com.fitplan.config;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** 口令只有一份来源：Node 那边已经在用的 server/.env，这里不复制第二份密钥文件。 */
public final class DotEnv {

    private static final Pattern ENTRY = Pattern.compile("^\\s*([A-Za-z0-9_]+)\\s*=\\s*(.*)$");
    private static final List<String> CANDIDATES = List.of("server/.env", "../server/.env", "../../server/.env");

    private DotEnv() {
    }

    public static void apply() {
        Path file = locate();
        if (file == null) {
            return;
        }
        List<String> lines;
        try {
            lines = Files.readAllLines(file, StandardCharsets.UTF_8);
        } catch (IOException e) {
            System.err.println("[fitplan-api] 读不了 " + file.toAbsolutePath() + "：" + e.getMessage());
            return;
        }
        for (String line : lines) {
            if (line.trim().startsWith("#")) {
                continue;
            }
            Matcher m = ENTRY.matcher(line);
            if (!m.matches()) {
                continue;
            }
            String key = m.group(1);
            if (System.getProperty(key) != null || System.getenv(key) != null) {
                continue;
            }
            System.setProperty(key, unquote(m.group(2).trim()));
        }
    }

    private static Path locate() {
        String override = System.getProperty("fitplan.env-file");
        if (FitplanProperties.isBlank(override)) {
            override = System.getenv("FITPLAN_ENV_FILE");
        }
        if (!FitplanProperties.isBlank(override)) {
            Path direct = Path.of(override.trim());
            return Files.isReadable(direct) ? direct : null;
        }
        for (String candidate : CANDIDATES) {
            Path p = Path.of(candidate);
            if (Files.isReadable(p)) {
                return p;
            }
        }
        return null;
    }

    private static String unquote(String value) {
        if (value.length() >= 2 && ((value.startsWith("\"") && value.endsWith("\""))
            || (value.startsWith("'") && value.endsWith("'")))) {
            return value.substring(1, value.length() - 1);
        }
        return value;
    }
}

package com.fitplan.config;

import com.fitplan.service.AlipayException;
import jakarta.servlet.http.HttpServletRequest;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import org.springframework.http.converter.HttpMessageNotReadableException;

/** 所有接口的错误都回 {error: "..."}，前端只认这一个字段。 */
@RestControllerAdvice
public class ApiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);
    private static final Pattern DB_URL = Pattern.compile("jdbc:mysql://([^/:]+)(?::(\\d+))?/([^?]*)");

    @Value("${spring.datasource.url:}")
    private String jdbcUrl;

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<Map<String, Object>> api(ApiException e) {
        return body(e.status(), e.getMessage());
    }

    @ExceptionHandler(AlipayException.class)
    public ResponseEntity<Map<String, Object>> alipay(AlipayException e) {
        log.warn("[alipay] {}", e.getMessage());
        return body(502, e.getMessage());
    }

    @ExceptionHandler(DataAccessException.class)
    public ResponseEntity<Map<String, Object>> database(DataAccessException e) {
        log.warn("[db] {}", e.getMessage());
        String host = "127.0.0.1";
        int port = 3306;
        String database = "fitplan";
        Matcher m = DB_URL.matcher(jdbcUrl == null ? "" : jdbcUrl);
        if (m.find()) {
            host = m.group(1);
            port = m.group(2) == null ? 3306 : Integer.parseInt(m.group(2));
            database = m.group(3);
        }
        return body(500, DbErrors.humanize(e, database, host, port));
    }

    @ExceptionHandler({
        HttpMessageNotReadableException.class,
        MissingServletRequestParameterException.class,
        MethodArgumentTypeMismatchException.class
    })
    public ResponseEntity<Map<String, Object>> badRequest(Exception e) {
        return body(400, e.getMessage());
    }

    @ExceptionHandler({HttpRequestMethodNotSupportedException.class, NoResourceFoundException.class})
    public ResponseEntity<Map<String, Object>> notFound(Exception e, HttpServletRequest request) {
        String path = request.getRequestURI().replaceAll("/+$", "");
        return body(404, "没有这个接口：" + path);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> unexpected(Exception e) {
        log.warn("[api] {}", e.toString(), e);
        String message = e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
        return body(500, message);
    }

    private static ResponseEntity<Map<String, Object>> body(int status, String message) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", message == null ? "服务出错了" : message);
        return ResponseEntity.status(HttpStatus.valueOf(status)).body(body);
    }
}

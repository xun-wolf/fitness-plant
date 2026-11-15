package com.fitplan.config;

import java.sql.SQLException;

/** 数据库报错翻成一句能照着做的人话，和 Node 版 dbError 保持一致。 */
public final class DbErrors {

    private DbErrors() {
    }

    public static String humanize(Throwable error, String database, String host, int port) {
        SQLException sql = findSql(error);
        int code = sql == null ? 0 : sql.getErrorCode();
        if (code == 1045) {
            return "数据库账号或密码不对（查 MYSQL_USER / MYSQL_PASSWORD）";
        }
        if (code == 1146) {
            return "库里没有 " + (sql == null ? "" : sql.getMessage()) + " 这张表，先跑一次建表";
        }
        if (code == 1049) {
            return "数据库 " + database + " 不存在，先 CREATE DATABASE " + database + ";";
        }
        String message = sql == null ? String.valueOf(error.getMessage()) : sql.getMessage();
        if (message != null && message.contains("Connection refused")) {
            return "连不上 " + host + ":" + port + "，MySQL 服务没起？";
        }
        return "数据库出错：" + message;
    }

    private static SQLException findSql(Throwable error) {
        Throwable cursor = error;
        while (cursor != null) {
            if (cursor instanceof SQLException sql) {
                return sql;
            }
            cursor = cursor.getCause();
        }
        return null;
    }
}

package com.fitplan.admin.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import cn.hutool.core.util.StrUtil;
import com.fitplan.admin.dto.OperationLogView;
import com.fitplan.admin.entity.OperationLog;
import com.fitplan.admin.mapper.OperationLogMapper;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuditService {

    private final OperationLogMapper logs;

    public void record(String action, String result, Long operatorId, String operatorName, String operatorRole,
                       String targetType, Long targetId, String detail, String ip, String userAgent) {
        try {
            OperationLog row = new OperationLog();
            row.setAction(truncate(action, 64));
            row.setResult(StrUtil.blankToDefault(result, "SUCCESS"));
            row.setOperatorId(operatorId);
            row.setOperatorName(truncate(operatorName, 64));
            row.setOperatorRole(truncate(operatorRole, 16));
            row.setTargetType(truncate(targetType, 32));
            row.setTargetId(targetId);
            row.setDetail(truncate(detail, 1000));
            row.setIp(truncate(ip, 64));
            row.setUserAgent(truncate(userAgent, 255));
            logs.insert(row);
        } catch (Exception e) {
            log.warn("[audit] 写操作日志失败：{}", e.getMessage());
        }
    }

    public List<OperationLogView> recentForUser(long userId, int limit) {
        int size = Math.max(1, Math.min(100, limit));
        List<OperationLog> rows = logs.selectList(new LambdaQueryWrapper<OperationLog>()
            .eq(OperationLog::getOperatorId, userId)
            .orderByDesc(OperationLog::getId)
            .last("LIMIT " + size));
        return rows.stream().map(this::view).toList();
    }

    public OperationLogView view(OperationLog row) {
        return new OperationLogView(
            row.getId(),
            row.getOperatorId(),
            row.getOperatorName(),
            row.getOperatorRole(),
            row.getAction(),
            row.getTargetType(),
            row.getTargetId(),
            row.getResult(),
            row.getDetail(),
            row.getIp(),
            row.getCreatedAt()
        );
    }

    private static String truncate(String value, int max) {
        if (value == null) {
            return null;
        }
        return value.length() <= max ? value : value.substring(0, max);
    }
}

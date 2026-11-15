package com.fitplan.admin.dto;

import java.util.List;

public record PageResult<T>(long total, long pageNum, long pageSize, List<T> list) {
}

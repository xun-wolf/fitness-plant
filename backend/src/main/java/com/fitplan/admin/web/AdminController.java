package com.fitplan.admin.web;

import com.fitplan.admin.dto.AdminOrderView;
import com.fitplan.admin.dto.AdminUserView;
import com.fitplan.admin.dto.GrantVipRequest;
import com.fitplan.admin.dto.OperationLogView;
import com.fitplan.admin.dto.PageResult;
import com.fitplan.admin.dto.UpdateStatusRequest;
import com.fitplan.admin.service.AdminService;
import com.fitplan.auth.common.RequestIp;
import com.fitplan.auth.common.Result;
import com.fitplan.auth.security.AuthUser;
import com.fitplan.auth.security.CurrentUser;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {

    private final AdminService admin;

    @GetMapping("/users")
    public Result<PageResult<AdminUserView>> users(
        @RequestParam(required = false) String keyword,
        @RequestParam(defaultValue = "1") int pageNum,
        @RequestParam(defaultValue = "20") int pageSize) {
        return Result.success(admin.pageUsers(keyword, pageNum, pageSize));
    }

    @GetMapping("/users/{id}")
    public Result<AdminUserView> user(@PathVariable long id) {
        return Result.success(admin.user(id));
    }

    @PatchMapping("/users/{id}/status")
    public Result<AdminUserView> status(@PathVariable long id,
                                        @Valid @RequestBody UpdateStatusRequest request,
                                        HttpServletRequest http) {
        AuthUser operator = CurrentUser.require();
        return Result.success(admin.setStatus(
            operator, id, request.status(), RequestIp.of(http), http.getHeader("User-Agent")));
    }

    @PostMapping("/users/{id}/vip")
    public Result<AdminUserView> vip(@PathVariable long id,
                                     @Valid @RequestBody GrantVipRequest request,
                                     HttpServletRequest http) {
        AuthUser operator = CurrentUser.require();
        return Result.success(admin.grantVip(
            operator, id, request.days(), RequestIp.of(http), http.getHeader("User-Agent")));
    }

    @GetMapping("/operation-logs")
    public Result<PageResult<OperationLogView>> logs(
        @RequestParam(required = false) String keyword,
        @RequestParam(required = false) String action,
        @RequestParam(defaultValue = "1") int pageNum,
        @RequestParam(defaultValue = "20") int pageSize) {
        return Result.success(admin.pageLogs(keyword, action, pageNum, pageSize));
    }

    @GetMapping("/orders")
    public Result<PageResult<AdminOrderView>> orders(
        @RequestParam(required = false) String keyword,
        @RequestParam(required = false) String status,
        @RequestParam(defaultValue = "1") int pageNum,
        @RequestParam(defaultValue = "20") int pageSize) {
        return Result.success(admin.pageOrders(keyword, status, pageNum, pageSize));
    }

    @PostMapping("/orders/{outTradeNo}/close")
    public Result<AdminOrderView> closeOrder(@PathVariable String outTradeNo, HttpServletRequest http) {
        AuthUser operator = CurrentUser.require();
        return Result.success(admin.closeOrder(
            operator, outTradeNo, RequestIp.of(http), http.getHeader("User-Agent")));
    }

    @PostMapping("/orders/{outTradeNo}/refund")
    public Result<AdminOrderView> refundOrder(@PathVariable String outTradeNo, HttpServletRequest http) {
        AuthUser operator = CurrentUser.require();
        return Result.success(admin.refundOrder(
            operator, outTradeNo, RequestIp.of(http), http.getHeader("User-Agent")));
    }
}

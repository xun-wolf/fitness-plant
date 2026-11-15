export const ACTION_LABELS = {
  REGISTER_SUCCESS: '注册',
  LOGIN_SUCCESS: '登录',
  LOGIN_FAILED: '登录失败',
  LOGOUT: '退出登录',
  CHANGE_PASSWORD: '修改密码',
  ADMIN_DISABLE_USER: '停用账号',
  ADMIN_ENABLE_USER: '启用账号',
  ADMIN_GRANT_VIP: '开通 VIP',
  ADMIN_CLOSE_ORDER: '关闭订单',
  ADMIN_REFUND_ORDER: '订单退款',
};

export function actionLabel(action) {
  return ACTION_LABELS[action] ?? action;
}

export function resultLabel(result) {
  return result === 'SUCCESS' ? '成功' : '失败';
}

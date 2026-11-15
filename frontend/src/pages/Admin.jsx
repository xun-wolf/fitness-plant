import { useEffect, useState } from 'react';
import { Card, Notice, Pills } from '../components/ui';
import {
  adminCloseOrder,
  adminGrantVip,
  adminOperationLogs,
  adminOrders,
  adminRefundOrder,
  adminSetStatus,
  adminUsers,
} from '../lib/api';
import { actionLabel, resultLabel } from '../lib/audit';
import { formatDateTime } from '../lib/storage';

const TABS = [
  { key: 'users', label: '账号管理' },
  { key: 'orders', label: '订单管理' },
  { key: 'logs', label: '操作日志' },
];

const ORDER_STATUS = [
  { key: '', label: '全部' },
  { key: 'created', label: '待支付' },
  { key: 'paid', label: '已支付' },
  { key: 'closed', label: '已关闭' },
  { key: 'refunded', label: '已退款' },
];

const ORDER_STATUS_LABEL = {
  created: '待支付',
  paid: '已支付',
  closed: '已关闭',
  refunded: '已退款',
};

function yuan(cent) {
  return (Number(cent || 0) / 100).toFixed(2);
}

export default function Admin({ go }) {
  const [tab, setTab] = useState('users');
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState(null);
  const [orders, setOrders] = useState(null);
  const [logs, setLogs] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = async (nextPage = 1, nextStatus = status) => {
    setBusy(true);
    setError('');
    try {
      if (tab === 'users') {
        setUsers(await adminUsers({ keyword, pageNum: nextPage, pageSize: 20 }));
      } else if (tab === 'orders') {
        setOrders(await adminOrders({ keyword, status: nextStatus, pageNum: nextPage, pageSize: 20 }));
      } else {
        setLogs(await adminOperationLogs({ keyword, pageNum: nextPage, pageSize: 20 }));
      }
      setPage(nextPage);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    load(1);
  }, [tab]);

  const toggleStatus = async (user) => {
    const next = user.status === 1 ? 0 : 1;
    if (!window.confirm(`${next === 0 ? '停用' : '启用'} ${user.username}？`)) return;
    setBusy(true);
    setError('');
    try {
      await adminSetStatus(user.id, next);
      setMessage(`${user.username} 已${next === 0 ? '停用' : '启用'}。`);
      await load(page);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const grantVip = async (user) => {
    const input = window.prompt(`给 ${user.username} 开通多少天？`, '30');
    if (input === null) return;
    const days = Number(input);
    if (!Number.isInteger(days) || days < 1 || days > 3650) {
      setError('天数需为 1-3650 的整数');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await adminGrantVip(user.id, days);
      setMessage(`${user.username} 已开通 ${days} 天 VIP。`);
      await load(page);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const closeOrder = async (order) => {
    if (!window.confirm(`关闭订单 ${order.outTradeNo}？`)) return;
    setBusy(true);
    setError('');
    try {
      await adminCloseOrder(order.outTradeNo);
      setMessage(`订单 ${order.outTradeNo} 已关闭。`);
      await load(page);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const refundOrder = async (order) => {
    const tip = `确认全额退款 ${yuan(order.amountCent)} 元？退款成功后这单增加的 ${order.days} 天 VIP 会从账号扣回。`;
    if (!window.confirm(tip)) return;
    setBusy(true);
    setError('');
    try {
      await adminRefundOrder(order.outTradeNo);
      setMessage(`订单 ${order.outTradeNo} 已退款。`);
      await load(page);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const current = tab === 'users' ? users : tab === 'orders' ? orders : logs;
  const pages = current ? Math.max(1, Math.ceil(current.total / current.pageSize)) : 1;

  return (
    <div>
      <Card tight>
        <Pills
          options={TABS}
          value={tab}
          onChange={(next) => {
            setTab(next);
            setMessage('');
            setError('');
          }}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <input
            type="search"
            value={keyword}
            placeholder={
              tab === 'users' ? '搜账号或昵称' : tab === 'orders' ? '搜订单号或账号' : '搜操作人或动作'
            }
            onChange={(event) => setKeyword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') load(1);
            }}
          />
          <button className="btn ghost" type="button" onClick={() => load(1)} disabled={busy}>
            搜索
          </button>
        </div>
        {tab === 'orders' ? (
          <div style={{ marginTop: 10 }}>
            <Pills
              options={ORDER_STATUS}
              value={status}
              onChange={(next) => {
                setStatus(next);
                load(1, next);
              }}
            />
          </div>
        ) : null}
      </Card>

      {message ? <Notice>{message}</Notice> : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}

      {tab === 'users' ? (
        <>
          <Card title={`账号 ${users?.total ?? 0} 个`}>
            {busy && !users ? <div className="faint">正在读取…</div> : null}
            {users?.list?.map((user) => (
              <div className="kv" key={user.id} style={{ display: 'block' }}>
                <div style={{ fontWeight: 650 }}>
                  {user.username}
                  <span className="tag" style={{ marginLeft: 6 }}>{user.role}</span>
                  <span className="tag" style={{ marginLeft: 6 }}>
                    {user.status === 1 ? '启用' : '停用'}
                  </span>
                </div>
                <div className="faint">
                  {user.nickname || '—'} · {user.plan}
                  {user.planExpiresAt ? ` 到 ${formatDateTime(user.planExpiresAt)}` : ''}
                  {' · '}注册 {formatDateTime(user.createdAt)}
                </div>
                <div className="btnbar">
                  <button className="btn ghost" type="button" onClick={() => toggleStatus(user)} disabled={busy}>
                    {user.status === 1 ? '停用' : '启用'}
                  </button>
                  <button className="btn ghost" type="button" onClick={() => grantVip(user)} disabled={busy}>
                    开通 VIP
                  </button>
                </div>
              </div>
            ))}
            {users && users.list.length === 0 ? <div className="small muted">没有匹配的账号。</div> : null}
          </Card>
        </>
      ) : tab === 'orders' ? (
        <Card title={`订单 ${orders?.total ?? 0} 笔`}>
          {busy && !orders ? <div className="faint">正在读取…</div> : null}
          {orders?.list?.map((order) => (
            <div className="kv" key={order.outTradeNo} style={{ display: 'block' }}>
              <div style={{ fontWeight: 650 }}>
                {order.outTradeNo}
                <span className="tag" style={{ marginLeft: 6 }}>
                  {ORDER_STATUS_LABEL[order.status] || order.status}
                </span>
              </div>
              <div className="faint">
                {order.username || order.nickname || `#${order.userId}`}
                {' · '}{yuan(order.amountCent)} 元 · {order.days} 天
              </div>
              <div className="faint">
                下单 {formatDateTime(order.createdAt)}
                {order.paidAt ? ` · 支付 ${formatDateTime(order.paidAt)}` : ''}
                {order.refundedAt ? ` · 退款 ${formatDateTime(order.refundedAt)}` : ''}
              </div>
              {order.status === 'created' || order.status === 'paid' ? (
                <div className="btnbar">
                  {order.status === 'created' ? (
                    <button className="btn ghost" type="button" onClick={() => closeOrder(order)} disabled={busy}>
                      关闭订单
                    </button>
                  ) : null}
                  {order.status === 'paid' ? (
                    <button className="btn ghost" type="button" onClick={() => refundOrder(order)} disabled={busy}>
                      退款
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
          {orders && orders.list.length === 0 ? <div className="small muted">没有匹配的订单。</div> : null}
        </Card>
      ) : (
        <Card title={`操作日志 ${logs?.total ?? 0} 条`}>
          {logs?.list?.map((log) => (
            <div className="kv" key={log.id} style={{ display: 'block' }}>
              <div style={{ fontWeight: 650 }}>
                {actionLabel(log.action)}
                <span className="tag" style={{ marginLeft: 6 }}>
                  {resultLabel(log.result)}
                </span>
              </div>
              <div className="faint">
                {log.operatorName || '—'} → {log.targetType || '—'}
                {log.targetId ? ` #${log.targetId}` : ''}
                {log.detail ? ` · ${log.detail}` : ''}
              </div>
              <div className="faint">
                {formatDateTime(log.createdAt)} · {log.ip || '—'}
              </div>
            </div>
          ))}
          {logs && logs.list.length === 0 ? <div className="small muted">还没有操作日志。</div> : null}
        </Card>
      )}

      <div className="btnbar">
        <button className="btn ghost" type="button" onClick={() => load(page - 1)} disabled={busy || page <= 1}>
          上一页
        </button>
        <span className="faint" style={{ alignSelf: 'center' }}>
          第 {page} / {pages} 页
        </span>
        <button className="btn ghost" type="button" onClick={() => load(page + 1)} disabled={busy || page >= pages}>
          下一页
        </button>
      </div>

      <div className="btnbar">
        <button className="btn ghost" type="button" onClick={() => go('/settings')}>
          回设置
        </button>
      </div>
    </div>
  );
}

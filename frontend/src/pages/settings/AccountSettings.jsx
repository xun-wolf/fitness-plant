import { useCallback, useEffect, useState } from 'react';
import { Card, Loading, Notice, TextField } from '../../components/ui';
import {
  ORDER_KEY,
  authLogin,
  authRegister,
  changePassword,
  closeAccount,
  createOrder,
  getOrder,
  getPlan,
  getSession,
  getToken,
  loginUrl,
  logout,
  myOperationLogs,
  setToken,
} from '../../lib/api';
import { actionLabel, resultLabel } from '../../lib/audit';
import { formatDate, formatDateTime } from '../../lib/storage';

export default function AccountSettings({ go }) {
  const [session, setSession] = useState(null);
  const [planInfo, setPlanInfo] = useState(null);
  const [loading, setLoading] = useState(Boolean(getToken()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [authMode, setAuthMode] = useState('login');
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirm, setAuthConfirm] = useState('');
  const [authNickname, setAuthNickname] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [agreed, setAgreed] = useState(false);

  const [pwdOpen, setPwdOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdBusy, setPwdBusy] = useState(false);
  const [pwdError, setPwdError] = useState('');
  const [myLogs, setMyLogs] = useState([]);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setSession(null);
      setPlanInfo(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [nextSession, nextPlan] = await Promise.all([getSession(), getPlan()]);
      setSession(nextSession);
      setPlanInfo(nextPlan);
    } catch (err) {
      if (err.status === 401) setToken('');
      setError(err.message);
      setSession(null);
      setPlanInfo(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const pending = localStorage.getItem(ORDER_KEY);
    if (!pending || !getToken()) return;
    getOrder(pending)
      .then((result) => {
        if (result.status === 'paid') {
          localStorage.removeItem(ORDER_KEY);
          setMessage('这单已经到账，Pro 已开通。');
          refresh();
        }
      })
      .catch(() => undefined);
  }, [refresh]);

  useEffect(() => {
    if (!session) {
      setMyLogs([]);
      return;
    }
    myOperationLogs(10)
      .then((rows) => setMyLogs(Array.isArray(rows) ? rows : []))
      .catch(() => setMyLogs([]));
  }, [session]);

  const submitAuth = async () => {
    const username = authUsername.trim();
    if (!username) {
      setAuthError('请输入账号');
      return;
    }
    if (authPassword.length < 8) {
      setAuthError('密码至少 8 位');
      return;
    }
    if (authMode === 'register' && authPassword !== authConfirm) {
      setAuthError('两次输入的密码不一致');
      return;
    }
    if (authMode === 'register' && !agreed) {
      setAuthError('请先阅读并同意隐私政策和服务条款');
      return;
    }
    setAuthBusy(true);
    setAuthError('');
    try {
      const data = authMode === 'login'
        ? await authLogin(username, authPassword)
        : await authRegister({
            username,
            password: authPassword,
            nickname: authNickname.trim(),
            acceptedTerms: agreed,
          });
      setToken(data.token);
      setAuthPassword('');
      setAuthConfirm('');
      setMessage(authMode === 'login' ? '已登录。' : '注册成功，已经登录。');
      await refresh();
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthBusy(false);
    }
  };

  const resetPasswordForm = () => {
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPwdError('');
  };

  const cancelPassword = () => {
    setPwdOpen(false);
    resetPasswordForm();
  };

  const submitPassword = async () => {
    if (newPassword.length < 8) {
      setPwdError('新密码至少 8 位');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdError('两次输入的新密码不一致');
      return;
    }
    setPwdBusy(true);
    setPwdError('');
    try {
      const data = await changePassword({ oldPassword, newPassword, confirmPassword });
      setToken(data.token);
      setPwdOpen(false);
      resetPasswordForm();
      setMessage('密码已修改，当前设备已换用新令牌。');
      await refresh();
    } catch (err) {
      setPwdError(err.message);
    } finally {
      setPwdBusy(false);
    }
  };

  const doLogout = async () => {
    setBusy(true);
    setError('');
    try {
      await logout();
    } catch (err) {
      setError(`退出没成：${err.message}`);
    }
    setToken('');
    setSession(null);
    setPlanInfo(null);
    setAuthMode('login');
    setAuthPassword('');
    setAuthConfirm('');
    setAuthError('');
    setAgreed(false);
    setPwdOpen(false);
    resetPasswordForm();
    setMessage('退出了这台设备的会话。云端那一行还留着，要彻底删就点注销。');
    setBusy(false);
  };

  const doClose = async () => {
    if (!window.confirm('注销会删掉云端关于你的那一行（账号、订阅状态、令牌）。本机记录不受影响，要留底先导出 JSON。继续？')) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      await closeAccount();
      setToken('');
      setSession(null);
      setPlanInfo(null);
      setMessage('云端那一行已经删了。');
    } catch (err) {
      setError(`注销没成：${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const buy = async () => {
    setBusy(true);
    setError('');
    try {
      const order = await createOrder();
      localStorage.setItem(ORDER_KEY, order.outTradeNo);
      window.location.href = order.url;
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  if (!getToken()) {
    return (
      <div>
        {message ? <Notice>{message}</Notice> : null}

        <Card title="账号密码">
          <div className="tabs">
            <button
              type="button"
              className="tab"
              aria-pressed={authMode === 'login'}
              onClick={() => {
                setAuthMode('login');
                setAuthError('');
              }}
            >
              登录
            </button>
            <button
              type="button"
              className="tab"
              aria-pressed={authMode === 'register'}
              onClick={() => {
                setAuthMode('register');
                setAuthError('');
              }}
            >
              注册
            </button>
          </div>
          <TextField
            label="账号"
            value={authUsername}
            placeholder="3-32 位字母、数字或下划线"
            onChange={(value) => setAuthUsername(value)}
          />
          <TextField
            label="密码"
            type="password"
            value={authPassword}
            placeholder="至少 8 位"
            onChange={(value) => setAuthPassword(value)}
          />
          {authMode === 'register' ? (
            <>
              <TextField
                label="确认密码"
                type="password"
                value={authConfirm}
                onChange={(value) => setAuthConfirm(value)}
              />
              <TextField
                label="昵称（可选）"
                value={authNickname}
                placeholder="不填就用账号"
                onChange={(value) => setAuthNickname(value)}
              />
              <label
                className="field"
                style={{ display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer' }}
              >
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(event) => setAgreed(event.target.checked)}
                  style={{ width: 'auto', margin: '3px 0 0', flex: 'none' }}
                />
                <span className="small muted">
                  我已阅读并同意
                  <a
                    href="#/privacy"
                    target="_blank"
                    rel="noreferrer"
                    onClick={(event) => event.stopPropagation()}
                  >
                    《隐私政策》
                  </a>
                  和
                  <a
                    href="#/terms"
                    target="_blank"
                    rel="noreferrer"
                    onClick={(event) => event.stopPropagation()}
                  >
                    《服务条款》
                  </a>
                </span>
              </label>
            </>
          ) : null}
          {authError ? <Notice tone="danger">{authError}</Notice> : null}
          <div className="btnbar">
            <button
              className="btn primary"
              type="button"
              onClick={submitAuth}
              disabled={authBusy || (authMode === 'register' && !agreed)}
            >
              {authBusy ? '处理中…' : authMode === 'login' ? '登录' : '注册并登录'}
            </button>
          </div>
          <div className="faint">账号密码用于本地验证登录；真实项目可以继续用下面的支付宝登录。</div>
        </Card>

        <Card title="支付宝登录">
          <div className="small muted">
            登录只用来把云端记录认到你名下。不登录也能用，所有记录只在这台设备上。
          </div>
          <div className="btnbar">
            <a className="btn ghost" href={loginUrl()}>
              用支付宝登录
            </a>
            <button className="btn ghost" type="button" onClick={refresh}>
              重新读一遍
            </button>
          </div>
        </Card>

        <div className="btnbar">
          <button className="btn ghost" type="button" onClick={() => go('/settings')}>
            回设置
          </button>
        </div>
      </div>
    );
  }

  if (loading) return <Loading text="正在读取账号…" />;

  return (
    <div>
      {message ? <Notice>{message}</Notice> : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}

      {session ? (
        <>
          <Card title="已登录">
            <div className="kv">
              <span>登录方式</span>
              <span>{session.username ? '账号密码' : '支付宝'}</span>
            </div>
            {session.username ? (
              <div className="kv">
                <span>账号</span>
                <span>{session.username}</span>
              </div>
            ) : null}
            {session.nickname ? (
              <div className="kv">
                <span>昵称</span>
                <span>{session.nickname}</span>
              </div>
            ) : null}
            {session.alipayUid ? (
              <div className="kv">
                <span>支付宝 uid 尾号</span>
                <span>{session.uidTail}</span>
              </div>
            ) : null}
            <div className="kv">
              <span>订阅</span>
              <span>{session.plan === 'pro' ? 'Pro' : '免费版'}</span>
            </div>
            <div className="kv">
              <span>注册</span>
              <span>{formatDateTime(session.createdAt)}</span>
            </div>
            <div className="kv">
              <span>最近登录</span>
              <span>{formatDateTime(session.lastLoginAt)}</span>
            </div>
          </Card>

          <Card title="修改密码">
            {!session.username ? (
              <div className="small muted">
                支付宝登录账号没有本地密码；如需账号密码登录，请先注册一个本地账号。
              </div>
            ) : !pwdOpen ? (
              <>
                <div className="small muted">
                  改完密码后，当前设备的旧令牌会立即失效，并自动换用新令牌。
                </div>
                <div className="btnbar">
                  <button className="btn ghost" type="button" onClick={() => setPwdOpen(true)}>
                    修改密码
                  </button>
                </div>
              </>
            ) : (
              <>
                <TextField
                  label="原密码"
                  type="password"
                  value={oldPassword}
                  onChange={setOldPassword}
                />
                <TextField
                  label="新密码"
                  type="password"
                  value={newPassword}
                  placeholder="至少 8 位"
                  onChange={setNewPassword}
                />
                <TextField
                  label="确认新密码"
                  type="password"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                />
                {pwdError ? <Notice tone="danger">{pwdError}</Notice> : null}
                <div className="btnbar">
                  <button className="btn primary" type="button" onClick={submitPassword} disabled={pwdBusy}>
                    {pwdBusy ? '保存中…' : '保存新密码'}
                  </button>
                  <button className="btn ghost" type="button" onClick={cancelPassword} disabled={pwdBusy}>
                    取消
                  </button>
                </div>
              </>
            )}
          </Card>

          <Card title="最近操作">
            {myLogs.length ? (
              myLogs.map((log) => (
                <div className="kv" key={log.id} style={{ display: 'block' }}>
                  <div style={{ fontWeight: 650 }}>
                    {actionLabel(log.action)}
                    <span className="tag" style={{ marginLeft: 6 }}>
                      {resultLabel(log.result)}
                    </span>
                  </div>
                  <div className="faint">
                    {formatDateTime(log.createdAt)} · {log.ip || '—'}
                    {log.detail ? ` · ${log.detail}` : ''}
                  </div>
                </div>
              ))
            ) : (
              <div className="small muted">还没有操作记录。</div>
            )}
          </Card>

          {planInfo ? (
            <Card title="订阅">
              <div className="pro-box">
                <div>
                  <div className="pro-name">{planInfo.plan === 'pro' ? 'Pro' : '免费版'}</div>
                  <div className="faint">
                    {planInfo.plan === 'pro'
                      ? `到 ${formatDate(planInfo.expiresAt)}`
                      : `¥${planInfo.price.yuan} 用 ${planInfo.price.days} 天`}
                  </div>
                </div>
                {planInfo.payReady ? (
                  <button className="btn primary" type="button" onClick={buy} disabled={busy}>
                    {planInfo.plan === 'pro' ? `续 ${planInfo.price.days} 天` : '升级 Pro'}
                  </button>
                ) : (
                  <span className="faint">收款还没开通</span>
                )}
              </div>
            </Card>
          ) : null}

          <Card title="云端记录">
            <div className="small muted">
              云端只认账号和订阅，记录要你在「数据与备份」里点上传。退出登录不会删本机记录。
            </div>
            <div className="btnbar">
              <button className="btn ghost" type="button" onClick={() => go('/settings/data')}>
                去数据与备份
              </button>
              <button className="btn ghost" type="button" onClick={refresh} disabled={busy}>
                刷新状态
              </button>
              <button className="btn danger" type="button" onClick={doLogout} disabled={busy}>
                退出这台设备
              </button>
            </div>
          </Card>
        </>
      ) : (
        <Card title="会话读不到">
          <div className="small muted">{error || '登录状态可能过期了，重新登录一次。'}</div>
          <div className="btnbar">
            <a className="btn primary" href={loginUrl()}>
              用支付宝重新登录
            </a>
            <button className="btn ghost" type="button" onClick={refresh}>
              再试一次
            </button>
          </div>
        </Card>
      )}

      {session ? (
        <Card title="注销">
          <div className="small muted">
            注销会删掉云端关于你的那一行（账号、订阅状态、令牌）。本机记录不受影响，要留底先导出 JSON。
          </div>
          <div className="btnbar">
            <button className="btn danger" type="button" onClick={doClose} disabled={busy}>
              注销云端那一行
            </button>
          </div>
        </Card>
      ) : null}

      <div className="btnbar">
        <button className="btn ghost" type="button" onClick={() => go('/settings')}>
          回设置
        </button>
      </div>
    </div>
  );
}

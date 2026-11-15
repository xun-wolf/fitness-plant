import { loginUrl, getToken } from '../lib/api';
import { Card } from '../components/ui';

export default function Welcome({ go, update }) {
  const loggedIn = Boolean(getToken());

  const freeStart = () => {
    update((state) => ({ ...state, onboardingDone: true }));
    go('/train');
  };

  return (
    <div className="welcome">
      <div className="welcome-brand">练</div>
      <h1 className="welcome-title">
        把「想练成什么样」
        <br />
        翻译成今天练什么
      </h1>
      <p className="welcome-sub">
        今天点几个练的部位就排几个，练的时候不计时、不掐点。记录默认只存在这台设备。
      </p>

      <div className="welcome-actions">
        <button className="btn big primary" type="button" onClick={() => go('/setup')}>
          花两分钟建档
        </button>
        <button className="btn big ghost" type="button" onClick={freeStart}>
          先随便练练
        </button>
      </div>

      <Card>
        <div className="kv">
          <span>周框架</span>
          <span className="muted">按你的天数排，不套固定课表</span>
        </div>
        <div className="kv">
          <span>今日清单</span>
          <span className="muted">点几个部位就排几个动作</span>
        </div>
        <div className="kv">
          <span>记录</span>
          <span className="muted">重量、次数、饮食、体重腰围</span>
        </div>
      </Card>

      <div className="welcome-foot">
        {loggedIn ? (
          <button className="btn ghost" type="button" onClick={() => go('/settings/account')}>
            已登录 · 查看账号
          </button>
        ) : (
          <a className="btn ghost" href={loginUrl()}>
            支付宝登录 / 注册
          </a>
        )}
        <a className="welcome-login" href="#/settings/account">
          账号密码登录
        </a>
        <div className="faint" style={{ marginTop: 8 }}>
          不登录也能用；登录只是为了让云端能认出这份记录是谁的。
        </div>
      </div>
    </div>
  );
}

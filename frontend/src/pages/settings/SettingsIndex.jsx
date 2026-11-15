import { useEffect, useState } from 'react';
import { Card } from '../../components/ui';
import { getSession, getToken } from '../../lib/api';

const ITEMS = [
  {
    href: '/settings/profile',
    title: '我的档案',
    desc: '身体数据、一周练哪几天、想练成什么样；也可以不设目标自由练',
    icon: '☺',
  },
  {
    href: '/settings/model',
    title: '链接大模型',
    desc: 'baseURL / apiKey / model，Key 只存这台设备',
    icon: '◈',
  },
  {
    href: '/settings/account',
    title: '账号',
    desc: '支付宝登录；云端只认 uid 和订阅，记录要你自己点上传',
    icon: '◎',
  },
  {
    href: '/settings/data',
    title: '数据与备份',
    desc: '导出 JSON、导入 JSON、云端整份备份和拉回、清空本机数据',
    icon: '≣',
  },
  {
    href: '/settings/offline',
    title: '离线与安装',
    desc: '装到主屏，断网能做什么、不能做什么',
    icon: '▤',
  },
  {
    href: '/settings/safety',
    title: '安全边界',
    desc: '这个应用不做什么：不诊断、不冲极限、不断食',
    icon: '⚠',
  },
];

export default function SettingsIndex({ go }) {
  const [role, setRole] = useState(null);

  useEffect(() => {
    if (!getToken()) return;
    getSession()
      .then((session) => setRole(session.role))
      .catch(() => setRole(null));
  }, []);

  return (
    <div>
      {role === 'ADMIN' ? (
        <button
          type="button"
          className="card"
          style={{ display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer' }}
          onClick={() => go('/admin')}
        >
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ fontSize: 22, minWidth: 28 }}>▦</div>
            <div>
              <h3>管理后台</h3>
              <div className="small muted">账号停用/启用、开通 VIP、查看操作日志</div>
            </div>
          </div>
        </button>
      ) : null}

      {ITEMS.map((item) => (
        <button
          key={item.href}
          type="button"
          className="card"
          style={{ display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer' }}
          onClick={() => go(item.href)}
        >
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ fontSize: 22, minWidth: 28 }}>{item.icon}</div>
            <div>
              <h3>{item.title}</h3>
              <div className="small muted">{item.desc}</div>
            </div>
          </div>
        </button>
      ))}
      <Card title="这台设备上有什么">
        <div className="small muted">
          记录默认只存在这个浏览器里。登录并在「数据与备份」点一次「传到云端」，上传的是那一刻的全部记录；
          不点就没有任何东西离开设备。大模型 Key 不上传。
        </div>
      </Card>
    </div>
  );
}

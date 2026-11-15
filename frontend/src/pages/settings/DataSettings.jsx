import { useRef, useState } from 'react';
import { Card, Notice } from '../../components/ui';
import {
  clearCloudData,
  getToken,
  readCloudData,
  stateFromCloud,
  syncData,
} from '../../lib/api';
import { STORAGE_KEY, exportJSON, importJSON, todayISO } from '../../lib/storage';

const TABLE_LABELS = {
  profiles: '档案',
  frameworks: '周框架',
  day_sheets: '今日表',
  set_logs: '逐组记录',
  activity_logs: '运动记录',
  meal_logs: '饮食记录',
  measure_logs: '体重腰围',
};

function counts(state) {
  return [
    `${state.sheets.length} 张今日表`,
    `${state.setLogs.length} 组`,
    `${state.mealLogs.length} 餐`,
    `${state.activityLogs.length} 次其他运动`,
    `${state.measureLogs.length} 次打卡`,
  ].join(' · ');
}

export default function DataSettings({ state, update, go }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const run = async (task) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await task();
      if (result) setMessage(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const exportFile = () => {
    const blob = new Blob([exportJSON(state)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fitplan-${todayISO()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage('已导出 JSON。收好这份文件，它就是这一台设备的全部记录。');
  };

  const importFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const next = importJSON(String(reader.result ?? ''));
        next.settings.apiKey = state.settings.apiKey;
        update(() => next);
        setMessage('导入完成，记录已经换成文件里的那一份。');
        setError('');
      } catch (err) {
        setError(`导入失败：${err.message}`);
      }
    };
    reader.readAsText(file, 'utf-8');
    event.target.value = '';
  };

  const upload = () => {
    if (!getToken()) {
      setError('先在「账号」里登录，云端才知道这些记录是谁的。');
      return;
    }
    run(async () => {
      const result = await syncData(state);
      const saved = Object.entries(result.saved)
        .filter(([, value]) => value > 0)
        .map(([key, value]) => `${TABLE_LABELS[key] ?? key} ${value}`)
        .join(' / ');
      return `已传到云端：${saved || '空记录'}。换设备或清了浏览器数据后可以拉回。`;
    });
  };

  const downloadCloud = () => {
    if (!getToken()) {
      setError('先在「账号」里登录。');
      return;
    }
    run(async () => {
      const cloud = await readCloudData();
      update((current) => stateFromCloud(current, cloud));
      return `已从云端拉回：${counts(stateFromCloud(state, cloud))}。`;
    });
  };

  const removeCloud = () => {
    if (!getToken()) {
      setError('先在「账号」里登录。');
      return;
    }
    if (!window.confirm('删掉云端这一份记录？本机不受影响，但云端拉不回来了。')) return;
    run(async () => {
      await clearCloudData();
      return '云端记录已删除。';
    });
  };

  const clearLocal = () => {
    if (!window.confirm('清空本机数据？会删掉档案、周框架、训练与饮食记录。建议先导出 JSON。')) return;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('fitplan.contentOpen');
    window.location.hash = '#/welcome';
    window.location.reload();
  };

  return (
    <div>
      {message ? <Notice>{message}</Notice> : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}

      <Card title="这台设备现在攒了">
        <div className="small muted">{counts(state)}</div>
      </Card>

      <Card title="本机备份">
        <div className="small muted">
          导出的是 JSON，档案、周框架、训练、饮食、体重腰围都在里面；大模型 Key 不会导出。
        </div>
        <div className="btnbar">
          <button className="btn primary" type="button" onClick={exportFile}>
            导出 JSON
          </button>
          <button className="btn ghost" type="button" onClick={() => fileRef.current?.click()}>
            导入 JSON
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={importFile} />
        </div>
      </Card>

      <Card title="云端备份">
        <div className="small muted">
          先在「账号」里登录，云端才知道这些记录是谁的。没登录时所有记录都只在这台设备上。
          上传是整份覆盖：这台设备现在有什么，云端就变成什么。
        </div>
        <div className="btnbar">
          <button className="btn primary" type="button" onClick={upload} disabled={busy}>
            传到云端
          </button>
          <button className="btn ghost" type="button" onClick={downloadCloud} disabled={busy}>
            从云端拉回
          </button>
          <button className="btn danger" type="button" onClick={removeCloud} disabled={busy}>
            删云端记录
          </button>
        </div>
      </Card>

      <Card title="清空本机">
        <div className="small muted">
          清空后回到欢迎页。这个操作不碰云端；如果云端还有一份，登录后可以拉回。
        </div>
        <div className="btnbar">
          <button className="btn danger" type="button" onClick={clearLocal}>
            清空本机数据
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

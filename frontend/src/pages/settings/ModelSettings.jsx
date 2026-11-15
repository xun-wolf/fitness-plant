import { useState } from 'react';
import { Card, Notice, TextField } from '../../components/ui';
import { testConnection } from '../../lib/ai';
import { getApiBase, setApiBase } from '../../lib/api';

export default function ModelSettings({ state, update, go }) {
  const [draft, setDraft] = useState(() => ({ ...state.settings }));
  const [apiBase, setApiBaseDraft] = useState(() => getApiBase());
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const patch = (value) => setDraft((current) => ({ ...current, ...value }));

  const save = () => {
    update((current) => ({ ...current, settings: { ...current.settings, ...draft } }));
    setApiBase(apiBase);
    setMessage('已保存。Key 只在这台设备的 localStorage 里，不会上传。');
    setError('');
  };

  const test = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const reply = await testConnection(draft);
      setMessage(`接口通了：${reply}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {message ? <Notice>{message}</Notice> : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}

      <Card title="模型接口">
        <TextField
          label="baseURL"
          value={draft.baseURL}
          placeholder="https://api.deepseek.com/v1"
          hint="按服务商的 OpenAI 兼容地址填写，末尾不用加 /chat/completions"
          onChange={(baseURL) => patch({ baseURL })}
        />
        <TextField
          label="apiKey"
          value={draft.apiKey}
          type="password"
          placeholder="sk-..."
          hint="只存这台设备；不会上传到云端"
          onChange={(apiKey) => patch({ apiKey })}
        />
        <TextField
          label="model"
          value={draft.model}
          placeholder="deepseek-chat"
          onChange={(model) => patch({ model })}
        />
        <div className="field">
          <label>启用大模型</label>
          <div className="chips">
            <button
              className={`chip${draft.useAI ? ' on' : ''}`}
              type="button"
              aria-pressed={draft.useAI}
              onClick={() => patch({ useAI: true })}
            >
              启用
            </button>
            <button
              className={`chip${!draft.useAI ? ' on' : ''}`}
              type="button"
              aria-pressed={!draft.useAI}
              onClick={() => patch({ useAI: false })}
            >
              只用本地规则
            </button>
          </div>
          <div className="faint" style={{ marginTop: 6 }}>
            不启用也能生成周框架；启用后会用模型把目标愿望翻译成更贴合的优先部位。
          </div>
        </div>
        <div className="btnbar">
          <button className="btn primary" type="button" onClick={save}>
            保存
          </button>
          <button className="btn ghost" type="button" onClick={test} disabled={busy}>
            {busy ? '测试中…' : '测试连通性'}
          </button>
        </div>
      </Card>

      <Card title="后端接口">
        <TextField
          label="API 基地址"
          value={apiBase}
          placeholder="/api"
          hint="默认 /api；前后端分开部署时可以填完整地址"
          onChange={setApiBaseDraft}
        />
        <div className="btnbar">
          <button className="btn ghost" type="button" onClick={() => { setApiBase(apiBase); setMessage('接口地址已保存'); }}>
            保存接口地址
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

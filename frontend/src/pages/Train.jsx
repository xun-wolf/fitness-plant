import { useMemo, useState } from 'react';
import { Card, Chips, Notice, NumberField } from '../components/ui';
import { aiReady, interpretGoal } from '../lib/ai';
import { exerciseById, formatWeight } from '../lib/exercises';
import {
  buildFramework,
  buildSheet,
  frameworkWeek,
  localGoal,
  setLogsForSheet,
  sheetForDate,
  sheetStats,
  upcomingDays,
} from '../lib/plan';
import { todayISO, weekdayName, weekdayOf } from '../lib/storage';

const AREAS = ['胸', '背', '肩', '手臂', '腿', '臀', '核心', '有氧'];

export default function Train({ state, update, go }) {
  const today = todayISO();
  const weekday = weekdayOf(today);
  const sheet = sheetForDate(state, today);
  const logs = useMemo(() => setLogsForSheet(state, sheet), [state, sheet]);
  const stats = useMemo(() => sheetStats(sheet, logs), [sheet, logs]);
  const framework = state.framework;
  const frameworkDay = framework?.days?.find((day) => day.weekday === weekday) ?? null;
  const week = frameworkWeek(framework, today);
  const [areas, setAreas] = useState(() => {
    const saved = state.profile.dayAreas?.[today];
    if (Array.isArray(saved)) return saved;
    return typeof saved === 'string' ? saved.split('、').filter(Boolean) : [];
  });
  const [minutes, setMinutes] = useState(state.profile.sessionMinutes ?? 45);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const setPickedAreas = (next) => {
    setAreas(next);
    update((current) => ({
      ...current,
      profile: {
        ...current.profile,
        dayAreas: { ...current.profile.dayAreas, [today]: next.join('、') },
      },
    }));
  };

  const ensureFramework = async () => {
    if (framework) return framework;
    let goal = state.profile.goal ?? localGoal(state.profile);
    if (aiReady(state.settings)) {
      try {
        goal = await interpretGoal(state.profile, state.settings);
      } catch (error) {
        setMessage(`大模型没读成，先用本地规则：${error.message}`);
      }
    }
    const next = buildFramework({ ...state.profile, goal });
    update((current) => ({ ...current, framework: next, profile: { ...current.profile, goal } }));
    return next;
  };

  const generateSheet = async (options = {}) => {
    setBusy(true);
    setMessage('');
    try {
      const base = await ensureFramework();
      const nextSheet = buildSheet(
        { ...state, framework: base },
        {
          date: today,
          totalMinutes: minutes,
          wantAreas: options.direct || options.free ? [] : areas,
          direct: options.direct,
          free: options.free,
          focus: options.direct ? '自由训练' : options.free ? undefined : undefined,
        },
      );
      update((current) => ({
        ...current,
        framework: base,
        sheets: [...current.sheets.filter((item) => item.date !== today), nextSheet],
      }));
      go('/session');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  };

  const regenerateFramework = async () => {
    setBusy(true);
    setMessage('');
    try {
      let goal = state.profile.goal ?? localGoal(state.profile);
      if (aiReady(state.settings)) {
        try {
          goal = await interpretGoal(state.profile, state.settings);
        } catch (error) {
          setMessage(`大模型没读成，先用本地规则：${error.message}`);
        }
      }
      const next = buildFramework({ ...state.profile, goal });
      update((current) => ({
        ...current,
        framework: next,
        profile: { ...current.profile, goal },
        sheets: current.sheets.filter((item) => item.date !== today),
      }));
      setMessage('周框架已经按当前档案重新排好。');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div
        className="hero-card"
        style={{ '--img': 'url(/plan.jpg)', '--pos': 'center 30%' }}
      >
        <div className="hero-tag">今天 · {weekdayName(weekday)}</div>
        <div className="hero-title">{sheet?.focus ?? frameworkDay?.focus ?? '自由训练'}</div>
        <div className="hero-meta">
          {sheet
            ? `${stats.minutes} 分钟 · ${stats.planned} 组 · 完成 ${stats.percent}%`
            : framework
              ? '今天还没有清单'
              : '先建档或直接开练'}
        </div>
      </div>

      {message ? <Notice>{message}</Notice> : null}

      {framework ? (
        <Card title="本周框架">
          <div className="kv">
            <span>周期</span>
            <span>{week?.theme ?? `第 1 周 · 摸底`}</span>
          </div>
          <div className="kv">
            <span>今天安排</span>
            <span>{frameworkDay?.focus ?? '休息 / 自由训练'}</span>
          </div>
          <div className="small muted" style={{ marginTop: 8 }}>
            {week?.intent ?? '按表做完，把每组实际重量和次数记下来。'}
          </div>
          <div className="btnbar">
            <button className="btn ghost" type="button" onClick={() => go('/plan')}>
              查看完整框架
            </button>
            <button className="btn ghost" type="button" onClick={regenerateFramework} disabled={busy}>
              重新生成
            </button>
          </div>
        </Card>
      ) : (
        <Card title="还没有周框架">
          <div className="small muted">
            建档后会按你一周能练的天数排一个框架；也可以不设框架，直接按今天的部位开练。
          </div>
          <div className="btnbar">
            <button className="btn primary" type="button" onClick={() => go('/setup')}>
              去建档
            </button>
            <button className="btn ghost" type="button" onClick={regenerateFramework} disabled={busy}>
              直接生成
            </button>
          </div>
        </Card>
      )}

      {sheet ? (
        <Card title="今日清单">
          <div className="sheetmeta">
            <span>{sheet.budgetMinutes} 分钟</span>
            <span>{stats.planned} 组</span>
            <span>完成 {stats.percent}%</span>
            {stats.volume ? <span>容量 {stats.volume}kg</span> : null}
          </div>
          <div className="setlist" style={{ marginTop: 10 }}>
            {sheet.slots
              .filter((slot) => slot.kind === 'main' && !sheet.skipped.includes(slot.id))
              .map((slot) => (
                <div className="kv" key={slot.id}>
                  <span>{slot.name}</span>
                  <span className="muted">
                    {slot.sets} 组 × {slot.setPlan[0]?.reps ?? 0} ·{' '}
                    {formatWeight(slot.setPlan[0]?.weightKg, slot.unit)}
                  </span>
                </div>
              ))}
          </div>
          <div className="btnbar">
            <button className="btn primary" type="button" onClick={() => go('/session')}>
              {stats.sets ? '继续训练' : '开始训练'}
            </button>
            <button className="btn ghost" type="button" onClick={() => generateSheet({ free: true })} disabled={busy}>
              换一份
            </button>
          </div>
        </Card>
      ) : (
        <Card title="今天练哪里">
          <div className="faint" style={{ marginBottom: 8 }}>
            点几个部位就排几个动作，最多选 3 个。
          </div>
          <Chips
            options={AREAS}
            value={areas}
            onChange={(next) => setPickedAreas(next.slice(0, 3))}
          />
          <div className="row2" style={{ marginTop: 12 }}>
            <NumberField
              label="今天有多少分钟"
              value={minutes}
              min={15}
              max={180}
              step={5}
              onChange={setMinutes}
            />
          </div>
          <div className="btnbar">
            <button
              className="btn primary"
              type="button"
              onClick={() => generateSheet({})}
              disabled={busy}
            >
              {busy ? '正在排…' : '生成今日清单'}
            </button>
            <button className="btn ghost" type="button" onClick={() => generateSheet({ direct: true })} disabled={busy}>
              直接开练
            </button>
          </div>
        </Card>
      )}

      <Card title="接下来几天">
        {upcomingDays(framework, 5, today).map((day) => (
          <div className="weekrow" key={day.date}>
            <div style={{ minWidth: 54 }} className="muted">
              {weekdayName(day.weekday)}
            </div>
            <div className="small">
              {day.plan?.focus ?? '休息'}
              {day.date === today ? ' · 今天' : ''}
            </div>
          </div>
        ))}
      </Card>

      {logs.length ? (
        <Card title="今天已经记下的组">
          {logs.slice(-6).reverse().map((log) => (
            <div className="kv" key={`${log.slotId}-${log.setIdx}`}>
              <span>
                {exerciseById(log.exId)?.name ?? log.exId} · 第 {log.setIdx + 1} 组
              </span>
              <span className="muted">
                {formatWeight(log.weightKg, 'kg')} × {log.reps}
              </span>
            </div>
          ))}
        </Card>
      ) : null}
    </div>
  );
}

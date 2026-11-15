import { useMemo, useState } from 'react';
import { Card, NumberField, Pills, TextArea, TextField } from '../components/ui';
import { exerciseById, formatWeight } from '../lib/exercises';
import { ACTIVITY_KINDS, activityLabel } from '../lib/nutrition';
import { addDays, shortDate, todayISO, weekdayName, weekdayOf } from '../lib/storage';

const KINDS = ACTIVITY_KINDS.map((item) => ({ key: item.key, label: item.label }));

export default function Log({ state, update, go }) {
  const [date, setDate] = useState(todayISO());
  const [activityOpen, setActivityOpen] = useState(false);
  const [measureOpen, setMeasureOpen] = useState(false);
  const [activity, setActivity] = useState({ kind: 'cardio', name: '', minutes: 30, feel: 4, note: '' });
  const [measure, setMeasure] = useState({ weightKg: null, waistCm: null, note: '' });
  const [message, setMessage] = useState('');

  const sets = useMemo(() => state.setLogs.filter((log) => log.date === date), [state.setLogs, date]);
  const activities = useMemo(
    () => state.activityLogs.filter((log) => log.date === date),
    [state.activityLogs, date],
  );
  const measures = useMemo(
    () => state.measureLogs.filter((log) => log.date === date),
    [state.measureLogs, date],
  );
  const meals = useMemo(
    () => state.mealLogs.filter((log) => log.date === date),
    [state.mealLogs, date],
  );

  const volume = sets.reduce(
    (sum, log) => sum + (Number(log.weightKg) || 0) * (Number(log.reps) || 0),
    0,
  );
  const grouped = useMemo(() => {
    const map = new Map();
    for (const log of sets) {
      const key = log.slotId;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(log);
    }
    return [...map.values()];
  }, [sets]);

  const days = useMemo(() => {
    const result = [];
    for (let index = -3; index <= 3; index += 1) result.push(addDays(todayISO(), index));
    return result;
  }, []);

  const calendar = useMemo(() => {
    const result = [];
    const start = addDays(todayISO(), -27);
    for (let index = 0; index < 28; index += 1) result.push(addDays(start, index));
    return result;
  }, []);

  const hasLog = (day) =>
    state.setLogs.some((log) => log.date === day) ||
    state.activityLogs.some((log) => log.date === day) ||
    state.measureLogs.some((log) => log.date === day);

  const removeSet = (log) => {
    update((current) => ({
      ...current,
      setLogs: current.setLogs.filter(
        (item) =>
          !(
            item.sheetId === log.sheetId &&
            item.slotId === log.slotId &&
            item.setIdx === log.setIdx
          ),
      ),
    }));
  };

  const saveActivity = () => {
    if (!activity.name.trim()) {
      setMessage('先写一下做了什么');
      return;
    }
    const log = {
      id: `act-${Date.now().toString(36)}`,
      date,
      name: activity.name.trim(),
      minutes: Number(activity.minutes) || 0,
      kind: activity.kind,
      feel: Number(activity.feel) || 3,
      areas: [],
      exIds: [],
      note: activity.note,
      ts: new Date().toISOString(),
    };
    update((current) => ({ ...current, activityLogs: [...current.activityLogs, log] }));
    setActivity({ kind: 'cardio', name: '', minutes: 30, feel: 4, note: '' });
    setActivityOpen(false);
    setMessage('');
  };

  const saveMeasure = () => {
    if (measure.weightKg === null && measure.waistCm === null) {
      setMessage('体重和腰围至少填一个');
      return;
    }
    const log = {
      id: `measure-${Date.now().toString(36)}`,
      date,
      weightKg: measure.weightKg,
      waistCm: measure.waistCm,
      note: measure.note,
      ts: new Date().toISOString(),
    };
    update((current) => ({ ...current, measureLogs: [...current.measureLogs, log] }));
    setMeasure({ weightKg: null, waistCm: null, note: '' });
    setMeasureOpen(false);
    setMessage('');
  };

  return (
    <div>
      <Card tight>
        <div className="picked-row">
          {days.map((day) => (
            <button
              key={day}
              type="button"
              className={`pill${date === day ? ' on' : ''}`}
              aria-pressed={date === day}
              onClick={() => setDate(day)}
            >
              <div>{shortDate(day)}</div>
              <div className="faint">{weekdayName(weekdayOf(day))}</div>
            </button>
          ))}
        </div>
      </Card>

      {message ? <div className="notice">{message}</div> : null}

      <Card title={`${date} 概览`}>
        <div className="kv">
          <span>训练组数</span>
          <span className="num">{sets.length} 组</span>
        </div>
        <div className="kv">
          <span>训练容量</span>
          <span className="num">{Math.round(volume)} kg</span>
        </div>
        <div className="kv">
          <span>其他运动</span>
          <span className="num">{activities.reduce((sum, item) => sum + (Number(item.minutes) || 0), 0)} 分钟</span>
        </div>
        <div className="kv">
          <span>饮食记录</span>
          <span className="num">{meals.length} 条</span>
        </div>
        <div className="kv">
          <span>体重腰围打卡</span>
          <span className="num">{measures.length} 次</span>
        </div>
      </Card>

      <Card title="训练记录">
        {grouped.length ? (
          grouped.map((group) => {
            const first = group[0];
            const exercise = exerciseById(first.exId);
            return (
              <div key={first.slotId} style={{ marginBottom: 10 }}>
                <div style={{ fontWeight: 650 }}>{exercise?.name ?? first.exId}</div>
                {group
                  .sort((a, b) => a.setIdx - b.setIdx)
                  .map((log) => (
                    <div className="kv" key={`${log.slotId}-${log.setIdx}`}>
                      <span className="muted">
                        第 {log.setIdx + 1} 组 · {formatWeight(log.weightKg, 'kg')} × {log.reps}
                        {log.rpe ? ` @ RPE ${log.rpe}` : ''}
                      </span>
                      <button className="btn ghost" type="button" onClick={() => removeSet(log)}>
                        删
                      </button>
                    </div>
                  ))}
              </div>
            );
          })
        ) : (
          <div className="small muted">这一天还没有逐组记录。</div>
        )}
      </Card>

      <Card title="其他运动">
        {activities.length ? (
          activities.map((log) => (
            <div className="kv" key={log.id}>
              <span>
                {log.name} · {activityLabel(log.kind)} · {log.minutes} 分钟
                {log.note ? ` · ${log.note}` : ''}
              </span>
              <button
                className="btn ghost"
                type="button"
                onClick={() =>
                  update((current) => ({
                    ...current,
                    activityLogs: current.activityLogs.filter((item) => item.id !== log.id),
                  }))
                }
              >
                删
              </button>
            </div>
          ))
        ) : (
          <div className="small muted">还没有其他运动。</div>
        )}
        {activityOpen ? (
          <div style={{ marginTop: 10 }}>
            <div className="field">
              <label>类型</label>
              <Pills
                options={KINDS}
                value={activity.kind}
                onChange={(kind) => setActivity((current) => ({ ...current, kind }))}
              />
            </div>
            <TextField
              label="做了什么"
              value={activity.name}
              placeholder="例如：慢跑、羽毛球、爬山"
              onChange={(name) => setActivity((current) => ({ ...current, name }))}
            />
            <div className="row2">
              <NumberField
                label="分钟"
                value={activity.minutes}
                min={0}
                max={600}
                onChange={(minutes) => setActivity((current) => ({ ...current, minutes }))}
              />
              <NumberField
                label="练完状态（1–5）"
                value={activity.feel}
                min={1}
                max={5}
                onChange={(feel) => setActivity((current) => ({ ...current, feel }))}
              />
            </div>
            <TextArea
              label="备注"
              value={activity.note}
              rows={2}
              onChange={(note) => setActivity((current) => ({ ...current, note }))}
            />
            <div className="btnbar">
              <button className="btn primary" type="button" onClick={saveActivity}>
                保存
              </button>
              <button className="btn ghost" type="button" onClick={() => setActivityOpen(false)}>
                取消
              </button>
            </div>
          </div>
        ) : (
          <div className="btnbar">
            <button className="btn ghost" type="button" onClick={() => setActivityOpen(true)}>
              加一条其他运动
            </button>
          </div>
        )}
      </Card>

      <Card title="体重 / 腰围">
        {measures.length ? (
          measures.map((log) => (
            <div className="kv" key={log.id}>
              <span>
                {log.weightKg ? `${log.weightKg} kg` : ''}
                {log.weightKg && log.waistCm ? ' · ' : ''}
                {log.waistCm ? `腰围 ${log.waistCm} cm` : ''}
                {log.note ? ` · ${log.note}` : ''}
              </span>
              <button
                className="btn ghost"
                type="button"
                onClick={() =>
                  update((current) => ({
                    ...current,
                    measureLogs: current.measureLogs.filter((item) => item.id !== log.id),
                  }))
                }
              >
                删
              </button>
            </div>
          ))
        ) : (
          <div className="small muted">还没有打卡。</div>
        )}
        {measureOpen ? (
          <div style={{ marginTop: 10 }}>
            <div className="row2">
              <NumberField
                label="体重（kg）"
                value={measure.weightKg}
                min={0}
                max={500}
                step={0.1}
                onChange={(weightKg) => setMeasure((current) => ({ ...current, weightKg }))}
              />
              <NumberField
                label="腰围（cm）"
                value={measure.waistCm}
                min={0}
                max={300}
                step={0.5}
                onChange={(waistCm) => setMeasure((current) => ({ ...current, waistCm }))}
              />
            </div>
            <TextField
              label="备注"
              value={measure.note}
              onChange={(note) => setMeasure((current) => ({ ...current, note }))}
            />
            <div className="btnbar">
              <button className="btn primary" type="button" onClick={saveMeasure}>
                保存打卡
              </button>
              <button className="btn ghost" type="button" onClick={() => setMeasureOpen(false)}>
                取消
              </button>
            </div>
          </div>
        ) : (
          <div className="btnbar">
            <button className="btn ghost" type="button" onClick={() => setMeasureOpen(true)}>
              加一次打卡
            </button>
          </div>
        )}
      </Card>

      <Card title="最近四周">
        <div className="daygrid">
          {calendar.map((day) => (
            <button
              key={day}
              type="button"
              className={`chip${date === day ? ' on' : ''}`}
              style={{ minHeight: 38, padding: '4px 2px', fontSize: 12 }}
              onClick={() => setDate(day)}
              title={day}
            >
              <div>{Number(day.slice(8))}</div>
              <div style={{ height: 4 }}>
                {hasLog(day) ? <span style={{ color: 'var(--accent-deep)' }}>•</span> : null}
              </div>
            </button>
          ))}
        </div>
      </Card>

      <div className="btnbar">
        <button className="btn ghost" type="button" onClick={() => go('/train')}>
          回运动页
        </button>
      </div>
    </div>
  );
}

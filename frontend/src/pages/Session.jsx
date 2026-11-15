import { useMemo, useRef, useState } from 'react';
import { Card, Empty, Notice } from '../components/ui';
import { alternatives, exerciseById } from '../lib/exercises';
import { makeSlot, setLogsForSheet, sheetForDate, sheetStats } from '../lib/plan';
import { todayISO } from '../lib/storage';

function readNumber(value, fallback = null) {
  if (value === '' || value === null || value === undefined) return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export default function Session({ state, update, go }) {
  const today = todayISO();
  const sheet = sheetForDate(state, today);
  const logs = useMemo(() => setLogsForSheet(state, sheet), [state, sheet]);
  const stats = useMemo(() => sheetStats(sheet, logs), [sheet, logs]);
  const [draft, setDraft] = useState({});
  const inputRefs = useRef({});
  const inputKey = (slot, index, field) => `${slot.id}:${index}:${field}`;
  const [swapSlotId, setSwapSlotId] = useState(null);
  const [extraDone, setExtraDone] = useState([]);
  const [message, setMessage] = useState('');

  if (!sheet) {
    return (
      <Empty title="今天还没有训练清单">
        回运动页选几个部位，先生成今天的清单。
        <div className="btnbar">
          <button className="btn primary" type="button" onClick={() => go('/train')}>
            回运动页
          </button>
        </div>
      </Empty>
    );
  }

  const logFor = (slot, index) =>
    logs.find((log) => log.slotId === slot.id && log.setIdx === index) ?? null;

  const valueOf = (slot, index, field) => {
    const key = `${slot.id}:${index}`;
    const local = draft[key]?.[field];
    if (local !== undefined) return local;
    const log = logFor(slot, index);
    if (field === 'weight') return log?.weightKg ?? slot.setPlan[index]?.weightKg ?? '';
    if (field === 'reps') return log?.reps ?? slot.setPlan[index]?.reps ?? '';
    return log?.rpe ?? '';
  };

  const setValue = (slot, index, field, value) => {
    const key = `${slot.id}:${index}`;
    setDraft((current) => ({ ...current, [key]: { ...current[key], [field]: value } }));
  };

  const patchSheet = (updater) => {
    update((current) => ({
      ...current,
      sheets: current.sheets.map((item) => (item.id === sheet.id ? updater(item) : item)),
    }));
  };

  const logSet = (slot, index) => {
    // 以输入框里的实际值为准：有些输入方式不会触发 React 的 onChange
    const weight = readNumber(
      inputRefs.current[inputKey(slot, index, 'weight')]?.value,
      readNumber(valueOf(slot, index, 'weight'), null),
    );
    const reps = readNumber(
      inputRefs.current[inputKey(slot, index, 'reps')]?.value,
      readNumber(valueOf(slot, index, 'reps'), null),
    );
    const rpe = readNumber(
      inputRefs.current[inputKey(slot, index, 'rpe')]?.value,
      readNumber(valueOf(slot, index, 'rpe'), null),
    );
    if (reps === null) {
      setMessage('先填这一组做了几次');
      return;
    }
    const log = {
      slotId: slot.id,
      sheetId: sheet.id,
      exId: slot.exId,
      date: sheet.date,
      setIdx: index,
      weightKg: weight,
      reps,
      targetReps: slot.setPlan[index]?.reps ?? reps,
      rpe,
      toFailure: false,
      ts: new Date().toISOString(),
    };
    update((current) => ({
      ...current,
      setLogs: [
        ...current.setLogs.filter(
          (item) =>
            !(
              item.sheetId === sheet.id &&
              item.slotId === slot.id &&
              item.setIdx === index
            ),
        ),
        log,
      ],
    }));
    setDraft((current) => {
      const next = { ...current };
      delete next[`${slot.id}:${index}`];
      return next;
    });
    setMessage('');
  };

  const addSet = (slot) => {
    const last = slot.setPlan[slot.setPlan.length - 1];
    patchSheet((item) => ({
      ...item,
      slots: item.slots.map((entry) =>
        entry.id === slot.id
          ? {
              ...entry,
              sets: entry.sets + 1,
              setPlan: [
                ...entry.setPlan,
                { weightKg: last?.weightKg ?? null, reps: last?.reps ?? 8 },
              ],
            }
          : entry,
      ),
    }));
  };

  const cutSet = (slot) => {
    if (slot.setPlan.length <= 1) return;
    const nextLength = slot.setPlan.length - 1;
    patchSheet((item) => ({
      ...item,
      slots: item.slots.map((entry) =>
        entry.id === slot.id
          ? { ...entry, sets: nextLength, setPlan: entry.setPlan.slice(0, nextLength) }
          : entry,
      ),
    }));
    update((current) => ({
      ...current,
      setLogs: current.setLogs.filter(
        (log) => !(log.sheetId === sheet.id && log.slotId === slot.id && log.setIdx >= nextLength),
      ),
    }));
  };

  const skipSlot = (slot) => {
    patchSheet((item) => ({
      ...item,
      skipped: item.skipped.includes(slot.id)
        ? item.skipped.filter((id) => id !== slot.id)
        : [...item.skipped, slot.id],
    }));
  };

  const swap = (slot, exercise) => {
    if (!exercise) return;
    const next = makeSlot(exercise, state.profile, 0);
    patchSheet((item) => ({
      ...item,
      slots: item.slots.map((entry) =>
        entry.id === slot.id
          ? { ...next, id: slot.id, setPlan: entry.setPlan.map(() => ({ ...next.setPlan[0] })) }
          : entry,
      ),
    }));
    update((current) => ({
      ...current,
      setLogs: current.setLogs.filter(
        (log) => !(log.sheetId === sheet.id && log.slotId === slot.id),
      ),
    }));
    setSwapSlotId(null);
  };

  const logCardio = (slot) => {
    const log = {
      id: `act-${Date.now().toString(36)}`,
      date: sheet.date,
      name: slot.name,
      minutes: Math.round((slot.durationSec ?? 600) / 60),
      kind: 'cardio',
      feel: 4,
      areas: [],
      exIds: slot.exId ? [slot.exId] : [],
      note: '',
      ts: new Date().toISOString(),
    };
    update((current) => ({ ...current, activityLogs: [...current.activityLogs, log] }));
    setExtraDone((current) => [...current, slot.id]);
  };

  const mainSlots = sheet.slots.filter((slot) => slot.kind === 'main');
  const warmup = sheet.slots.find((slot) => slot.kind === 'warmup');
  const cooldown = sheet.slots.find((slot) => slot.kind === 'cooldown');
  const cardioSlots = sheet.slots.filter((slot) => slot.kind === 'cardio');

  return (
    <div>
      <Card tight>
        <div className="sheetmeta">
          <span>{sheet.focus}</span>
          <span>{sheet.budgetMinutes} 分钟</span>
          <span>
            {stats.sets}/{stats.planned} 组
          </span>
          <span>{stats.percent}%</span>
        </div>
        <div className="progress" style={{ marginTop: 8 }}>
          <span style={{ width: `${stats.percent}%` }} />
        </div>
      </Card>

      {message ? <Notice>{message}</Notice> : null}

      {warmup ? (
        <Card title="热身">
          <div className="small">{warmup.name}</div>
          <div className="faint">{warmup.note}</div>
          <div className="faint">{Math.round(warmup.durationSec / 60)} 分钟</div>
        </Card>
      ) : null}

      {mainSlots.map((slot, slotIndex) => {
        const skipped = sheet.skipped.includes(slot.id);
        const exercise = exerciseById(slot.exId);
        const doneCount = logs.filter((log) => log.slotId === slot.id).length;
        const swapOptions = swapSlotId === slot.id ? alternatives(exercise, state.profile).slice(0, 6) : [];
        return (
          <Card key={slot.id} className={skipped ? 'muted' : ''}>
            <div className="sheetmeta" style={{ justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, color: 'var(--text)' }}>
                {slotIndex + 1}. {slot.name}
              </span>
              <span>
                {doneCount}/{slot.setPlan.length} 组
              </span>
            </div>
            <div className="faint">{slot.note}</div>
            {slot.cautionNote ? <Notice tone="privacy">{slot.cautionNote}</Notice> : null}
            {slot.form ? <div className="faint">动作要点：{slot.form}</div> : null}

            {skipped ? (
              <div className="small muted" style={{ marginTop: 8 }}>
                今天跳过了这个动作。
              </div>
            ) : (
              <div className="setlist">
                {slot.setPlan.map((plan, index) => {
                  const done = Boolean(logFor(slot, index));
                  return (
                    <div className="setline" key={`${slot.id}-${index}`}>
                      <input
                        ref={(element) => {
                          inputRefs.current[inputKey(slot, index, 'weight')] = element;
                        }}
                        style={{ flex: 1, minWidth: 0 }}
                        type="number"
                        inputMode="decimal"
                        placeholder="重量"
                        value={valueOf(slot, index, 'weight')}
                        onChange={(event) => setValue(slot, index, 'weight', event.target.value)}
                      />
                      <input
                        ref={(element) => {
                          inputRefs.current[inputKey(slot, index, 'reps')] = element;
                        }}
                        style={{ flex: 1, minWidth: 0 }}
                        type="number"
                        inputMode="numeric"
                        placeholder={`次数 ${plan.reps}`}
                        value={valueOf(slot, index, 'reps')}
                        onChange={(event) => setValue(slot, index, 'reps', event.target.value)}
                      />
                      <input
                        ref={(element) => {
                          inputRefs.current[inputKey(slot, index, 'rpe')] = element;
                        }}
                        style={{ width: 62 }}
                        type="number"
                        inputMode="decimal"
                        placeholder="RPE"
                        value={valueOf(slot, index, 'rpe')}
                        onChange={(event) => setValue(slot, index, 'rpe', event.target.value)}
                      />
                      <button
                        className={`setbtn${done ? ' done' : ''}`}
                        type="button"
                        onClick={() => logSet(slot, index)}
                      >
                        {done ? '已记' : '记下'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="btnbar">
              <button className="btn ghost" type="button" onClick={() => addSet(slot)}>
                加一组
              </button>
              <button className="btn ghost" type="button" onClick={() => cutSet(slot)}>
                减一组
              </button>
              <button className="btn ghost" type="button" onClick={() => skipSlot(slot)}>
                {skipped ? '恢复' : '跳过'}
              </button>
              <button
                className="btn ghost"
                type="button"
                onClick={() => setSwapSlotId(swapSlotId === slot.id ? null : slot.id)}
              >
                换动作
              </button>
            </div>

            {swapOptions.length ? (
              <div className="swaplist" style={{ marginTop: 8 }}>
                {swapOptions.map((option) => (
                  <button
                    key={option.id}
                    className="chip"
                    type="button"
                    style={{ display: 'block', width: '100%', marginBottom: 6, textAlign: 'left' }}
                    onClick={() => swap(slot, option)}
                  >
                    {option.name} · {option.equipment.join('·')}
                  </button>
                ))}
              </div>
            ) : null}
          </Card>
        );
      })}

      {cardioSlots.map((slot) => (
        <Card key={slot.id} title="有氧">
          <div className="small">{slot.name}</div>
          <div className="faint">{slot.note}</div>
          <div className="faint">{Math.round(slot.durationSec / 60)} 分钟</div>
          <div className="btnbar">
            <button
              className="btn ghost"
              type="button"
              disabled={extraDone.includes(slot.id)}
              onClick={() => logCardio(slot)}
            >
              {extraDone.includes(slot.id) ? '已记下' : '记下这次有氧'}
            </button>
          </div>
        </Card>
      ))}

      {cooldown ? (
        <Card title="收尾">
          <div className="small">{cooldown.name}</div>
          <div className="faint">{cooldown.note}</div>
          <div className="faint">{Math.round(cooldown.durationSec / 60)} 分钟</div>
        </Card>
      ) : null}

      <div className="btnbar">
        <button className="btn primary" type="button" onClick={() => go('/log')}>
          练完了，看记录
        </button>
        <button className="btn ghost" type="button" onClick={() => go('/train')}>
          先回运动页
        </button>
      </div>
    </div>
  );
}

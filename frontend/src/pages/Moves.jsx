import { useMemo, useState } from 'react';
import { Card, Notice, Pills } from '../components/ui';
import {
  AREA_OPTIONS,
  areaOfExercise,
  cautionFor,
  exerciseSummary,
  filterExercises,
  formatWeight,
  starterWeight,
} from '../lib/exercises';
import { buildSheet, makeSlot, sheetForDate } from '../lib/plan';
import { todayISO } from '../lib/storage';

const FILTERS = ['全部', ...AREA_OPTIONS];

export default function Moves({ state, update, go }) {
  const [area, setArea] = useState('全部');
  const [query, setQuery] = useState('');
  const [favOnly, setFavOnly] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [message, setMessage] = useState('');

  const list = useMemo(() => {
    const text = query.trim();
    return filterExercises(state.profile, area === '全部' ? null : area).filter((exercise) => {
      if (favOnly && !state.favorites.includes(exercise.id)) return false;
      if (!text) return true;
      return (
        exercise.name.includes(text) ||
        exercise.muscles.some((muscle) => muscle.includes(text)) ||
        exercise.equipment.some((equipment) => equipment.includes(text))
      );
    });
  }, [state.profile, state.favorites, area, query, favOnly]);

  const toggleFavorite = (id) => {
    update((current) => ({
      ...current,
      favorites: current.favorites.includes(id)
        ? current.favorites.filter((item) => item !== id)
        : [...current.favorites, id],
    }));
  };

  const addToToday = (exercise) => {
    const today = todayISO();
    let sheet = sheetForDate(state, today);
    if (!sheet) {
      sheet = buildSheet(state, { date: today, wantAreas: [areaOfExercise(exercise)] });
    }
    if (sheet.slots.some((slot) => slot.exId === exercise.id)) {
      setMessage(`${exercise.name} 已经在今天的清单里了。`);
      return;
    }
    const index = sheet.slots.filter((slot) => slot.kind === 'main').length;
    const slot = makeSlot(exercise, state.profile, index);
    const nextSheet = { ...sheet, slots: [...sheet.slots, slot] };
    update((current) => ({
      ...current,
      sheets: [...current.sheets.filter((item) => item.date !== today), nextSheet],
    }));
    setMessage(`已把 ${exercise.name} 加入今天。`);
  };

  return (
    <div>
      <Card tight>
        <input
          type="search"
          placeholder="搜动作、肌群或器械"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div style={{ marginTop: 10 }}>
          <Pills options={FILTERS} value={area} onChange={setArea} />
        </div>
        <div className="chips" style={{ marginTop: 10 }}>
          <button
            className={`chip${favOnly ? ' on' : ''}`}
            type="button"
            aria-pressed={favOnly}
            onClick={() => setFavOnly(!favOnly)}
          >
            只看收藏
          </button>
          <span className="faint" style={{ alignSelf: 'center' }}>
            {list.length} 个动作
          </span>
        </div>
      </Card>

      {message ? <Notice>{message}</Notice> : null}

      <div className="sec">
        {list.map((exercise) => {
          const isFav = state.favorites.includes(exercise.id);
          const open = expanded === exercise.id;
          const weight = starterWeight(exercise, state.profile);
          return (
            <div key={exercise.id}>
              <div className="mv-row">
                <button
                  className="mv-main"
                  type="button"
                  onClick={() => setExpanded(open ? null : exercise.id)}
                >
                  <div className="mv-name">
                    {exercise.name}
                    {exercise.heavy ? <span className="tag">主项</span> : null}
                    <span className="faint">{areaOfExercise(exercise)}</span>
                  </div>
                  <div className="mv-meta faint">{exerciseSummary(exercise)}</div>
                  <div className="mv-meta faint">
                    {exercise.sets} 组 × {exercise.reps} 次 · 休息 {Math.round(exercise.restSec / 60)} 分钟
                    {weight ? ` · 起始 ${formatWeight(weight, exercise.unit)}` : ''}
                  </div>
                </button>
                <button
                  className={`mv-fav${isFav ? ' on' : ''}`}
                  type="button"
                  aria-pressed={isFav}
                  onClick={() => toggleFavorite(exercise.id)}
                >
                  {isFav ? '已收藏' : '收藏'}
                </button>
                <button className="mv-add" type="button" onClick={() => addToToday(exercise)}>
                  加入今日
                </button>
              </div>
              {open ? (
                <div className="card tight" style={{ marginTop: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
                  <div className="small">{exercise.form}</div>
                  <div className="faint" style={{ marginTop: 6 }}>
                    目标肌群：{exercise.muscles.join(' / ')}
                  </div>
                  <div className="faint">器械：{exercise.equipment.join(' / ')}</div>
                  {cautionFor(exercise, state.profile) ? (
                    <Notice tone="privacy">{cautionFor(exercise, state.profile)}</Notice>
                  ) : null}
                  <div className="btnbar">
                    <button className="btn ghost" type="button" onClick={() => addToToday(exercise)}>
                      加入今日
                    </button>
                    <button className="btn ghost" type="button" onClick={() => go('/train')}>
                      回运动页
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

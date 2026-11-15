import { useState } from 'react';
import { Card, Chips, NumberField } from '../components/ui';
import { buildSheet } from '../lib/plan';
import { todayISO } from '../lib/storage';

const AREAS = ['胸', '背', '肩', '手臂', '腿', '臀', '核心', '有氧'];

const PHOTOS = [
  { area: '胸', image: '/part-chest.jpg', hint: '推类为主' },
  { area: '背', image: '/part-back.jpg', hint: '拉类为主' },
  { area: '手臂', image: '/part-arm.jpg', hint: '二头三头' },
  { area: '核心', image: '/part-core.jpg', hint: '稳定与抗旋' },
];

export default function Pick({ state, update, go }) {
  const [areas, setAreas] = useState(() => {
    const saved = state.profile.dayAreas?.[todayISO()];
    if (Array.isArray(saved)) return saved;
    return typeof saved === 'string' ? saved.split('、').filter(Boolean) : [];
  });
  const [minutes, setMinutes] = useState(state.profile.sessionMinutes ?? 45);

  const toggleArea = (area) => {
    setAreas((current) =>
      current.includes(area)
        ? current.filter((item) => item !== area)
        : [...current, area].slice(0, 3),
    );
  };

  const generate = (direct = false) => {
    const sheet = buildSheet(
      { ...state },
      {
        date: todayISO(),
        totalMinutes: minutes,
        wantAreas: direct ? [] : areas,
        direct,
        focus: direct ? '自由训练' : undefined,
      },
    );
    update((current) => ({
      ...current,
      sheets: [...current.sheets.filter((item) => item.date !== sheet.date), sheet],
      profile: {
        ...current.profile,
        dayAreas: { ...current.profile.dayAreas, [todayISO()]: areas.join('、') },
      },
    }));
    go('/session');
  };

  return (
    <div>
      <Card title="今天练哪里">
        <div className="faint" style={{ marginBottom: 8 }}>
          点几个部位就排几个动作，最多 3 个。选得越少，单块练得越透。
        </div>
        <Chips options={AREAS} value={areas} onChange={(next) => setAreas(next.slice(0, 3))} />
        <div className="picked-row" style={{ marginTop: 10 }}>
          <span className="picked-label">已选</span>
          {areas.length ? (
            areas.map((area) => (
              <span className="chip on" key={area}>
                {area}
              </span>
            ))
          ) : (
            <span className="faint">还没选，直接开练会按全身排</span>
          )}
        </div>
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
          <button className="btn primary" type="button" onClick={() => generate(false)}>
            按这些部位排
          </button>
          <button className="btn ghost" type="button" onClick={() => generate(true)}>
            直接开练
          </button>
        </div>
      </Card>

      <div className="sec">
        <div className="mv-head">按部位看</div>
        {PHOTOS.map((item) => (
          <button
            key={item.area}
            type="button"
            className="sec-photo"
            style={{
              backgroundImage: `linear-gradient(90deg, #170d13d9, #170d1360), url(${item.image})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
            onClick={() => toggleArea(item.area)}
          >
            <span style={{ fontSize: 20, fontWeight: 750 }}>{item.area}</span>
            <span className="faint" style={{ color: '#fff', opacity: 0.8 }}>
              {item.hint}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

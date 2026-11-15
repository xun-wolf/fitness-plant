import { Card, Empty, Notice } from '../components/ui';
import { buildFramework, localGoal } from '../lib/plan';
import { todayISO, weekdayName } from '../lib/storage';

export default function Plan({ state, update, go }) {
  const { framework } = state;
  if (!framework) {
    return (
      <Empty title="还没有周框架">
        回到运动页生成一份，或先完成建档。框架会按你一周能练的天数排，不套固定课表。
        <div className="btnbar">
          <button className="btn primary" type="button" onClick={() => go('/train')}>
            回运动页
          </button>
        </div>
      </Empty>
    );
  }

  const goal = framework.goal ?? state.profile.goal ?? localGoal(state.profile);

  const regenerate = () => {
    const next = buildFramework(state.profile, {
      id: framework.id,
      startDate: framework.startDate,
    });
    update((current) => ({ ...current, framework: next }));
  };

  return (
    <div>
      <Card title="这份框架怎么来的">
        <div className="small muted">{goal.summary}</div>
        {goal.priorityAreas?.length ? (
          <div className="faint" style={{ marginTop: 6 }}>
            优先部位：{goal.priorityAreas.join(' / ')}
          </div>
        ) : null}
        <div className="kv" style={{ marginTop: 10 }}>
          <span>开始日期</span>
          <span>{framework.startDate ?? todayISO()}</span>
        </div>
        <div className="kv">
          <span>周期</span>
          <span>{framework.weeksTotal} 周</span>
        </div>
        <div className="kv">
          <span>每周训练</span>
          <span>{framework.days?.length ?? 0} 天</span>
        </div>
      </Card>

      <Card title="每周怎么排">
        {framework.days?.map((day) => (
          <div className="weekrow" key={day.weekday}>
            <div className="muted" style={{ minWidth: 54 }}>
              {weekdayName(day.weekday)}
            </div>
            <div>
              <div className="small">{day.focus}</div>
              <div className="faint">{day.exerciseIds?.length ?? 0} 个动作 · 热身 {day.warmupMin ?? 6} 分钟</div>
            </div>
          </div>
        ))}
      </Card>

      <Card title="四周节奏">
        {framework.weeks?.map((week) => (
          <div className="kv" key={week.index} style={{ display: 'block' }}>
            <div style={{ fontWeight: 650 }}>{week.theme}</div>
            <div className="faint">{week.intent}</div>
          </div>
        ))}
      </Card>

      <Card title="执行规则">
        {framework.rules?.map((rule) => (
          <div className="kv" key={rule} style={{ display: 'block' }}>
            <div className="small muted">{rule}</div>
          </div>
        ))}
      </Card>

      {framework.assumed?.length ? (
        <Notice tone="privacy">
          这份计划的假设：{framework.assumed.join('；')}。任何一条不符合，就回档案改，再重新生成。
        </Notice>
      ) : null}

      <div className="btnbar">
        <button className="btn primary" type="button" onClick={() => go('/train')}>
          回运动页
        </button>
        <button className="btn ghost" type="button" onClick={regenerate}>
          按当前档案重排
        </button>
      </div>
    </div>
  );
}

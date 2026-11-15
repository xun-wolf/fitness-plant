import { useMemo, useState } from 'react';
import { Card, Notice, NumberField, Pills, TextArea, TextField } from '../components/ui';
import {
  MEAL_SLOTS,
  NUTRIENTS,
  calcTargets,
  dietVerdict,
  foodMid,
  mealLabel,
  mealTotals,
  searchFoods,
} from '../lib/nutrition';
import { addDays, shortDate, todayISO } from '../lib/storage';

const SLOT_OPTIONS = MEAL_SLOTS.map((slot) => ({ key: slot.key, label: slot.label }));

export default function Diet({ state, update, go }) {
  const [date, setDate] = useState(todayISO());
  const [query, setQuery] = useState('');
  const [slot, setSlot] = useState('breakfast');
  const [manual, setManual] = useState(false);
  const [draft, setDraft] = useState({
    name: '',
    kcal: null,
    proteinG: null,
    carbsG: null,
    fatG: null,
    sugarG: null,
    sodiumMg: null,
    note: '',
  });

  const targets = useMemo(() => calcTargets(state.profile), [state.profile]);
  const meals = useMemo(
    () => state.mealLogs.filter((meal) => meal.date === date),
    [state.mealLogs, date],
  );
  const totals = useMemo(() => mealTotals(meals), [meals]);
  const verdict = dietVerdict(targets, totals);
  const results = useMemo(() => searchFoods(query), [query]);

  const addFood = (food) => {
    const macros = foodMid(food);
    const log = {
      id: `meal-${Date.now().toString(36)}`,
      date,
      slot,
      name: food.label,
      ...macros,
      note: food.portion,
      ts: new Date().toISOString(),
    };
    update((current) => ({ ...current, mealLogs: [...current.mealLogs, log] }));
  };

  const addManual = () => {
    if (!draft.name.trim()) return;
    const log = {
      id: `meal-${Date.now().toString(36)}`,
      date,
      slot,
      name: draft.name.trim(),
      kcal: draft.kcal ?? 0,
      proteinG: draft.proteinG ?? 0,
      carbsG: draft.carbsG ?? 0,
      fatG: draft.fatG ?? 0,
      sugarG: draft.sugarG ?? 0,
      sodiumMg: draft.sodiumMg ?? 0,
      note: draft.note,
      ts: new Date().toISOString(),
    };
    update((current) => ({ ...current, mealLogs: [...current.mealLogs, log] }));
    setDraft({
      name: '',
      kcal: null,
      proteinG: null,
      carbsG: null,
      fatG: null,
      sugarG: null,
      sodiumMg: null,
      note: '',
    });
    setManual(false);
  };

  const removeMeal = (id) => {
    update((current) => ({
      ...current,
      mealLogs: current.mealLogs.filter((meal) => meal.id !== id),
    }));
  };

  return (
    <div>
      <Card tight>
        <div className="picked-row" style={{ justifyContent: 'space-between' }}>
          <button className="btn ghost" type="button" onClick={() => setDate(addDays(date, -1))}>
            ‹ 前一天
          </button>
          <div>
            <div style={{ fontWeight: 700 }}>{shortDate(date)}</div>
            <div className="faint">{date}</div>
          </div>
          <button className="btn ghost" type="button" onClick={() => setDate(addDays(date, 1))}>
            后一天 ›
          </button>
        </div>
      </Card>

      {targets ? (
        <Card title="今天的参考">
          <div className="kv">
            <span>基础代谢</span>
            <span className="num">{targets.bmr} kcal</span>
          </div>
          <div className="kv">
            <span>日常消耗</span>
            <span className="num">{targets.tdee} kcal</span>
          </div>
          <div className="kv">
            <span>参考摄入</span>
            <span className="num">
              {targets.target} kcal · 蛋白 {targets.protein}g
            </span>
          </div>
          <div className="faint" style={{ marginTop: 6 }}>
            参考值不会低于 {targets.floor} kcal；这是估算，不是处方。
          </div>
        </Card>
      ) : (
        <Notice tone="privacy">档案里缺少性别、年龄、身高或体重，先补上才能算热量参考。饮食记录本身不受影响。</Notice>
      )}

      <Card title="今天吃了什么">
        <div className="kv">
          <span>热量</span>
          <span className="num">
            {Math.round(totals.kcal)} {targets ? `/ ${targets.target}` : ''} kcal
          </span>
        </div>
        <div className="kv">
          <span>蛋白质</span>
          <span className="num">
            {Math.round(totals.proteinG)}g {targets ? `/ ${targets.protein}g` : ''}
          </span>
        </div>
        {NUTRIENTS.filter((item) => item.key !== 'protein').map((item) => {
          const value = item.key === 'salt' ? totals.sodiumMg : totals[`${item.key}G`];
          return (
            <div className="kv" key={item.key}>
              <span>{item.label}</span>
              <span className="num">
                {Math.round(value ?? 0)}
                {item.unit}
              </span>
            </div>
          );
        })}
        {verdict ? (
          <Notice tone={verdict.tone === 'high' ? 'privacy' : ''}>{verdict.text}</Notice>
        ) : null}
      </Card>

      {MEAL_SLOTS.map((mealSlot) => {
        const items = meals.filter((meal) => meal.slot === mealSlot.key);
        return (
          <Card key={mealSlot.key} title={mealSlot.label}>
            {items.length ? (
              items.map((meal) => (
                <div className="kv" key={meal.id}>
                  <span>
                    {meal.name}
                    <span className="faint">
                      {' '}
                      · {Math.round(meal.kcal)} kcal · 蛋白 {Math.round(meal.proteinG)}g
                    </span>
                  </span>
                  <button className="btn ghost" type="button" onClick={() => removeMeal(meal.id)}>
                    删
                  </button>
                </div>
              ))
            ) : (
              <div className="small muted">还没记。</div>
            )}
            <div className="btnbar">
              <button
                className="btn ghost"
                type="button"
                onClick={() => {
                  setSlot(mealSlot.key);
                  setQuery('');
                }}
              >
                往这一餐加
              </button>
            </div>
          </Card>
        );
      })}

      <Card title="搜食物">
        <div className="faint" style={{ marginBottom: 8 }}>
          现在加到哪里：
          <Pills options={SLOT_OPTIONS} value={slot} onChange={setSlot} />
        </div>
        <input
          type="search"
          placeholder="例：米饭 / 鸡胸 / 奶茶"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div style={{ marginTop: 10 }}>
          {results.map((food) => (
            <div className="kv" key={food.label}>
              <span>
                {food.label}
                <span className="faint"> · {food.portion}</span>
                <div className="faint">
                  {Math.round((food.low + food.high) / 2)} kcal · 蛋白{' '}
                  {Math.round((food.nut.protein[0] + food.nut.protein[1]) / 2)}g
                </div>
              </span>
              <button className="btn ghost" type="button" onClick={() => addFood(food)}>
                加入
              </button>
            </div>
          ))}
          {results.length === 0 ? <div className="small muted">没搜到，换一个关键词。</div> : null}
        </div>
        <div className="btnbar">
          <button className="btn ghost" type="button" onClick={() => setManual(!manual)}>
            没有这个食物，手动记
          </button>
          <button className="btn ghost" type="button" onClick={() => go('/train')}>
            回运动页
          </button>
        </div>
      </Card>

      {manual ? (
        <Card title="手动记一餐">
          <TextField
            label="吃了什么"
            value={draft.name}
            onChange={(name) => setDraft((current) => ({ ...current, name }))}
          />
          <div className="row2">
            <NumberField
              label="热量（kcal）"
              value={draft.kcal}
              min={0}
              max={99999}
              onChange={(kcal) => setDraft((current) => ({ ...current, kcal }))}
            />
            <NumberField
              label="蛋白质（g）"
              value={draft.proteinG}
              min={0}
              max={9999}
              onChange={(proteinG) => setDraft((current) => ({ ...current, proteinG }))}
            />
          </div>
          <div className="row2">
            <NumberField
              label="碳水（g）"
              value={draft.carbsG}
              min={0}
              max={9999}
              onChange={(carbsG) => setDraft((current) => ({ ...current, carbsG }))}
            />
            <NumberField
              label="脂肪（g）"
              value={draft.fatG}
              min={0}
              max={9999}
              onChange={(fatG) => setDraft((current) => ({ ...current, fatG }))}
            />
          </div>
          <div className="row2">
            <NumberField
              label="糖（g）"
              value={draft.sugarG}
              min={0}
              max={9999}
              onChange={(sugarG) => setDraft((current) => ({ ...current, sugarG }))}
            />
            <NumberField
              label="钠（mg）"
              value={draft.sodiumMg}
              min={0}
              max={99999}
              onChange={(sodiumMg) => setDraft((current) => ({ ...current, sodiumMg }))}
            />
          </div>
          <TextArea
            label="备注"
            value={draft.note}
            rows={2}
            onChange={(note) => setDraft((current) => ({ ...current, note }))}
          />
          <div className="btnbar">
            <button className="btn primary" type="button" onClick={addManual}>
              保存
            </button>
            <button className="btn ghost" type="button" onClick={() => setManual(false)}>
              取消
            </button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

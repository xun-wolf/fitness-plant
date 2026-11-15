import foods from '../data/foods.json';

export const NUTRIENTS = [
  { key: 'protein', label: '蛋白', unit: 'g' },
  { key: 'carbs', label: '碳水', unit: 'g' },
  { key: 'fat', label: '脂肪', unit: 'g' },
  { key: 'sugar', label: '糖', unit: 'g' },
  { key: 'salt', label: '钠', unit: 'mg' },
];

export const MEAL_SLOTS = [
  { key: 'breakfast', label: '早餐' },
  { key: 'lunch', label: '午餐' },
  { key: 'dinner', label: '晚餐' },
  { key: 'snack', label: '加餐' },
];

export const ACTIVITY_KINDS = [
  { key: 'cardio', label: '有氧' },
  { key: 'sport', label: '球类' },
  { key: 'lift', label: '举铁' },
  { key: 'walk', label: '走路' },
  { key: 'other', label: '其他' },
];

export function activityLabel(kind) {
  return ACTIVITY_KINDS.find((item) => item.key === kind)?.label ?? '其他';
}

export function mealLabel(slot) {
  return MEAL_SLOTS.find((item) => item.key === slot)?.label ?? '加餐';
}

export function calcTargets(profile) {
  const weight = Number(profile?.weightKg);
  const height = Number(profile?.heightCm);
  const age = Number(profile?.age);
  const sex = profile?.sex;
  if (!weight || !height || !age || !sex) return null;
  const bmr = 10 * weight + 6.25 * height - 5 * age + (sex === 'male' ? 5 : -161);
  const steps = Number(profile?.dailySteps) || 0;
  const activity = steps >= 12000 ? 1.725 : steps >= 8000 ? 1.55 : steps >= 4000 ? 1.375 : 1.2;
  const tdee = bmr * activity;
  const kind = profile?.goal?.kindKey ?? 'health';
  const floor = sex === 'male' ? 2000 : 1600;
  let target = tdee;
  if (kind === 'fatLoss') target = tdee - 300;
  if (kind === 'muscle') target = tdee + 200;
  target = Math.max(floor, Math.round(target));
  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    target,
    floor,
    protein: Math.round(weight * (kind === 'muscle' ? 1.8 : 1.6)),
    kind,
  };
}

export function searchFoods(query) {
  const text = String(query ?? '').trim().toLowerCase();
  if (!text) return foods.slice(0, 12);
  return foods
    .filter(
      (food) =>
        food.label.toLowerCase().includes(text) ||
        food.keys.some((key) => key.toLowerCase().includes(text)),
    )
    .slice(0, 20);
}

export function foodMid(food) {
  const mid = (range) => (Array.isArray(range) ? (Number(range[0]) + Number(range[1])) / 2 : 0);
  return {
    kcal: Math.round((food.low + food.high) / 2),
    proteinG: Math.round(mid(food.nut.protein)),
    carbsG: Math.round(mid(food.nut.carbs)),
    fatG: Math.round(mid(food.nut.fat)),
    sugarG: Math.round(mid(food.nut.sugar)),
    sodiumMg: Math.round(mid(food.nut.salt)),
  };
}

export function mealTotals(meals) {
  return meals.reduce(
    (sum, meal) => ({
      kcal: sum.kcal + (Number(meal.kcal) || 0),
      proteinG: sum.proteinG + (Number(meal.proteinG) || 0),
      carbsG: sum.carbsG + (Number(meal.carbsG) || 0),
      fatG: sum.fatG + (Number(meal.fatG) || 0),
      sugarG: sum.sugarG + (Number(meal.sugarG) || 0),
      sodiumMg: sum.sodiumMg + (Number(meal.sodiumMg) || 0),
    }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, sugarG: 0, sodiumMg: 0 },
  );
}

export function dietVerdict(targets, totals) {
  if (!targets) return null;
  const diff = totals.kcal - targets.target;
  if (Math.abs(diff) <= targets.target * 0.1) {
    return { tone: 'ok', text: `今天离参考值很近，保持这个量就行（${targets.target} kcal）` };
  }
  if (diff < 0) {
    return { tone: 'low', text: `比参考值低 ${Math.abs(diff)} kcal，先看看是不是漏记了` };
  }
  return { tone: 'high', text: `比参考值高 ${diff} kcal，明天按平常吃就行，不用刻意补` };
}

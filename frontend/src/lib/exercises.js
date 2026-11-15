import exercises from '../data/exercises.json';

export const EXERCISES = exercises;
export const EX_BY_ID = new Map(exercises.map((exercise) => [exercise.id, exercise]));

export const AREA_OPTIONS = ['胸', '背', '肩', '手臂', '腿', '臀', '核心', '全身', '有氧'];
export const TRAIN_AREAS = ['胸', '背', '肩', '手臂', '腿', '臀', '核心'];

export const INJURY_OPTIONS = [
  { key: 'knee', label: '膝' },
  { key: 'lowBack', label: '腰' },
  { key: 'shoulder', label: '肩' },
  { key: 'ankle', label: '踝' },
];

const HOME_EQUIPMENT = ['哑铃', '自重', '引体杆'];

const AREA_TESTS = {
  胸: /胸/,
  背: /背|菱形|后链|斜方/,
  肩: /三角|肩/,
  手臂: /二头|三头|臂/,
  腿: /股四|腘绳|小腿|臀/,
  臀: /臀|腘绳|后链/,
  核心: /核心|腹/,
};

export function exerciseById(id) {
  return EX_BY_ID.get(id) ?? null;
}

export function matchesArea(exercise, area) {
  if (!exercise) return false;
  if (area === '有氧') return exercise.pattern === 'cardio';
  if (area === '全身') return true;
  const test = AREA_TESTS[area];
  return test ? test.test(exercise.muscles[0] ?? '') : false;
}

export function allowedByInjury(exercise, profile) {
  const injuries = profile?.injuries ?? [];
  const avoid = exercise.avoid ?? [];
  return !avoid.some((item) => injuries.includes(item));
}

export function allowedByEquipment(exercise, profile) {
  if (!profile?.homeOnly) return true;
  return exercise.equipment.some((item) => HOME_EQUIPMENT.includes(item));
}

export function allowedExercise(exercise, profile) {
  if (!exercise) return false;
  if (profile?.noCardio && exercise.pattern === 'cardio') return false;
  return allowedByInjury(exercise, profile) && allowedByEquipment(exercise, profile);
}

export function filterExercises(profile, area) {
  return EXERCISES.filter((exercise) => {
    if (!allowedExercise(exercise, profile)) return false;
    return !area || area === '全身' ? true : matchesArea(exercise, area);
  });
}

export function alternatives(exercise, profile) {
  if (!exercise) return [];
  return EXERCISES.filter(
    (candidate) =>
      candidate.id !== exercise.id &&
      candidate.pattern === exercise.pattern &&
      allowedExercise(candidate, profile),
  ).sort((a, b) => {
    const sameEquipment = (item) =>
      item.equipment.filter((equipment) => exercise.equipment.includes(equipment)).length;
    const sharedMuscles = (item) =>
      item.muscles.filter((muscle) => exercise.muscles.includes(muscle)).length;
    return sameEquipment(b) - sameEquipment(a) || sharedMuscles(b) - sharedMuscles(a);
  });
}

export function levelOf(profile) {
  const years = Number(profile?.experienceYears ?? 0);
  if (years >= 2) return 2;
  if (years >= 1) return 1;
  return 0;
}

export function starterWeight(exercise, profile) {
  if (!exercise || exercise.unit === '自重' || exercise.unit === '无') return null;
  const level = levelOf(profile);
  const sex = profile?.sex === 'female' ? 'female' : 'male';
  const table = exercise.starter ?? {};
  const value = table[level]?.[sex] ?? table[0]?.[sex] ?? table[0]?.male ?? null;
  if (value === null || value === undefined) return null;
  return Math.round((Number(value) / 2.5)) * 2.5 || null;
}

export function roundWeight(value) {
  if (!Number.isFinite(Number(value))) return null;
  return Math.round((Number(value) / 2.5)) * 2.5;
}

export function formatWeight(weight, unit = 'kg') {
  if (weight === null || weight === undefined || weight === '') return '自重';
  if (unit === '每手kg') return `${weight}kg/手`;
  if (unit === '自重' || unit === '无') return '自重';
  return `${weight}kg`;
}

export function cautionFor(exercise, profile) {
  const injuries = profile?.injuries ?? [];
  return injuries
    .map((injury) => exercise?.caution?.[injury])
    .filter(Boolean)
    .join('；');
}

export function areaOfExercise(exercise) {
  if (!exercise) return '全身';
  return AREA_OPTIONS.find((area) => area !== '全身' && matchesArea(exercise, area)) ?? '全身';
}

export function exerciseSummary(exercise) {
  if (!exercise) return '';
  return `${exercise.muscles.slice(0, 2).join('·')} · ${exercise.equipment.join('·')}`;
}

export function pickByPattern(patterns, profile, used = new Set()) {
  for (const pattern of patterns) {
    const pool = EXERCISES.filter(
      (exercise) =>
        exercise.pattern === pattern &&
        allowedExercise(exercise, profile) &&
        !used.has(exercise.id),
    ).sort((a, b) => Number(b.heavy) - Number(a.heavy));
    if (pool.length) return pool[0];
  }
  return null;
}

export function pickForAreas(areas, profile, used = new Set(), limit = 5) {
  const picked = [];
  for (const area of areas) {
    const pool = filterExercises(profile, area)
      .filter((exercise) => !used.has(exercise.id) && !picked.some((item) => item.id === exercise.id))
      .sort((a, b) => Number(b.heavy) - Number(a.heavy) || b.muscles.length - a.muscles.length);
    const candidate = pool[0];
    if (candidate) {
      picked.push(candidate);
      used.add(candidate.id);
    }
    if (picked.length >= limit) break;
  }
  if (picked.length < limit) {
    const rest = EXERCISES.filter(
      (exercise) =>
        allowedExercise(exercise, profile) &&
        !used.has(exercise.id) &&
        areas.some((area) => matchesArea(exercise, area)),
    );
    for (const exercise of rest) {
      picked.push(exercise);
      used.add(exercise.id);
      if (picked.length >= limit) break;
    }
  }
  return picked;
}

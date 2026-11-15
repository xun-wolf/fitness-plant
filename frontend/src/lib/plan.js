import {
  EXERCISES,
  allowedExercise,
  alternatives,
  cautionFor,
  pickByPattern,
  pickForAreas,
  roundWeight,
  starterWeight,
  exerciseById,
} from './exercises';
import { addDays, todayISO, uid, weekdayName, weekdayOf } from './storage';

export const FOCUS_PATTERNS = {
  '全身 A': ['squat', 'horizontalPush', 'verticalPull', 'core'],
  '全身 B': ['hinge', 'verticalPush', 'horizontalPull', 'core'],
  '上肢推': ['horizontalPush', 'verticalPush', 'chestIso', 'triceps'],
  '上肢拉': ['verticalPull', 'horizontalPull', 'biceps', 'core'],
  下肢: ['squat', 'hinge', 'lunge', 'legIso', 'calfRaise'],
  胸: ['horizontalPush', 'chestIso', 'triceps', 'core'],
  背: ['verticalPull', 'horizontalPull', 'biceps', 'core'],
  腿: ['squat', 'hinge', 'lunge', 'legIso', 'calfRaise'],
  臀: ['hipThrust', 'hinge', 'lunge', 'legIso', 'core'],
  肩臂: ['verticalPush', 'shoulderIso', 'biceps', 'triceps'],
  核心: ['core', 'core', 'cardio'],
  有氧与活动度: ['cardio', 'core'],
  自由训练: ['squat', 'horizontalPush', 'verticalPull', 'hinge', 'core'],
};

const AREA_PATTERNS = {
  胸: ['horizontalPush', 'chestIso', 'triceps'],
  背: ['verticalPull', 'horizontalPull', 'biceps'],
  肩: ['verticalPush', 'shoulderIso'],
  手臂: ['biceps', 'triceps'],
  腿: ['squat', 'hinge', 'lunge', 'legIso'],
  臀: ['hipThrust', 'hinge', 'lunge'],
  核心: ['core'],
  有氧: ['cardio'],
  全身: ['squat', 'horizontalPush', 'verticalPull', 'core'],
};

const FOCUS_BY_COUNT = {
  1: ['全身 A'],
  2: ['全身 A', '全身 B'],
  3: ['上肢推', '下肢', '上肢拉'],
  4: ['上肢推', '下肢', '上肢拉', '臀'],
  5: ['胸', '背', '腿', '肩臂', '核心'],
  6: ['胸', '背', '腿', '肩臂', '核心', '有氧与活动度'],
};

export function inferGoalKind(wish = '') {
  if (/减脂|减重|瘦|掉秤|刷脂|降体脂/.test(wish)) return 'fatLoss';
  if (/增肌|变壮|增重|力量|三大项|围度/.test(wish)) return 'muscle';
  return 'health';
}

export function localGoal(profile) {
  const wish = (profile.goalWish || '').trim();
  const kindKey = inferGoalKind(wish);
  const priorityAreas =
    kindKey === 'fatLoss'
      ? ['腿', '背', '核心']
      : kindKey === 'muscle'
        ? ['胸', '背', '腿']
        : ['腿', '背', '核心'];
  return {
    kindKey,
    summary: wish || '把训练变成能长期执行的习惯，先把每周的节奏稳住',
    priorityAreas,
  };
}

function weeklyFocuses(count) {
  return FOCUS_BY_COUNT[Math.max(1, Math.min(6, count))] ?? FOCUS_BY_COUNT[3];
}

function trainingDays(profile) {
  const days = Array.isArray(profile.weekdays) && profile.weekdays.length
    ? [...profile.weekdays]
    : [1, 3, 5];
  return [...new Set(days)].sort((a, b) => a - b);
}

function weekPlan(weeksTotal) {
  const weeks = [];
  for (let index = 1; index <= weeksTotal; index += 1) {
    if (weeksTotal >= 6 && index === weeksTotal) {
      weeks.push({
        index,
        theme: `第 ${index} 周 · 减量周`,
        intent: '把关节和腰背的累积负担放掉，为下一轮递增腾出空间',
        progression: '主项重量 −10%，每个动作减 1 组，RPE 不超过 6',
        rpeBase: 6,
      });
      continue;
    }
    if (index === 1) {
      weeks.push({
        index,
        theme: `第 ${index} 周 · 摸底`,
        intent: '按表做完，把每个动作的实际重量和次数记下来，之后所有推算都依赖这一周',
        progression: '所有重量按「能标准做完且还剩 3 次」来定，不确定就轻一档，本周不加重量',
        rpeBase: 6.5,
      });
      continue;
    }
    const base = index <= Math.ceil(weeksTotal * 0.33);
    const build = index <= Math.ceil(weeksTotal * 0.66);
    weeks.push({
      index,
      theme: `第 ${index} 周 · ${base ? '建立' : build ? '加量' : '巩固'}`,
      intent: base
        ? '把动作做稳，组间休息不拖，记录每一组的实际重量'
        : build
          ? '主项按上一周的完成度递增，辅助动作先加次数再加重量'
          : '把最稳的重量做扎实，留一点余力给下一轮',
      progression: build ? '全部做满目标次数且 RPE ≤ 8 时，主项 +2.5%，辅助先加次数' : '保持重量，专注动作质量与呼吸',
      rpeBase: base ? 7 : build ? 7.5 : 8,
    });
  }
  return weeks;
}

export function buildFramework(profile, options = {}) {
  const days = trainingDays(profile);
  const focuses = weeklyFocuses(days.length);
  const weeksTotal = options.weeksTotal ?? 4;
  const used = new Set();
  const frameworkDays = days.map((weekday, index) => {
    const focus = focuses[index % focuses.length];
    const patterns = FOCUS_PATTERNS[focus] ?? FOCUS_PATTERNS['全身 A'];
    const exerciseIds = [];
    for (const pattern of patterns) {
      const exercise = pickByPattern([pattern], profile, used);
      if (exercise) {
        exerciseIds.push(exercise.id);
        used.add(exercise.id);
      }
    }
    const main = exerciseIds.map(exerciseById).find((exercise) => exercise?.kind === 'compound') ?? null;
    return {
      weekday,
      focus,
      role: focus,
      headline: `${weekdayName(weekday)} · ${focus}`,
      mainLiftId: main?.id ?? null,
      exerciseIds,
      substitutions: main ? alternatives(main, profile).slice(0, 3).map((item) => item.id) : [],
      warmupMin: 6,
      mainMin: Math.max(18, (Number(profile.sessionMinutes) || 45) - 16),
      cardioMin: profile.noCardio ? 0 : 8,
      cooldownMin: 5,
    };
  });

  return {
    id: options.id ?? uid('fw'),
    createdAt: options.createdAt ?? new Date().toISOString(),
    startDate: options.startDate ?? todayISO(),
    weeksTotal,
    days: frameworkDays,
    weeks: weekPlan(weeksTotal),
    rules: [
      `一周练 ${days.length} 天，同一肌群两次刺激之间尽量间隔 48 小时以上`,
      '主项在全部做满目标次数且 RPE ≤ 8 时，下一次加 2.5%；辅助动作先加次数，到区间上限再加重',
      '连续 2 周完成度低于 70%，或同一位置反复疼痛，就把当周重量减 10% 并减 1 组',
      '每次训练至少留 1–2 组余力，动作变形就停，不用力竭换进度',
    ],
    goal: profile.goal ?? localGoal(profile),
    assumed: [
      '默认每个动作都能标准完成目标次数',
      '重量按保守起始值给，第一次做请再轻一档',
      profile.noCardio ? '你选择了不做有氧，计划里不安排有氧块' : '有氧按能说话但不能唱歌的强度安排',
    ],
  };
}

export function makeSlot(exercise, profile, index = 0) {
  return slotFromExercise(exercise, profile, index);
}

function slotFromExercise(exercise, profile, index) {
  const sets = exercise.kind === 'compound' ? 4 : 3;
  const base = starterWeight(exercise, profile);
  const ramp = Boolean(exercise.ramp && base);
  const setPlan = Array.from({ length: sets }, (_, setIndex) => ({
    weightKg: base
      ? ramp
        ? roundWeight(base * (0.6 + setIndex * (0.4 / Math.max(1, sets - 1))))
        : base
      : null,
    reps: exercise.reps,
  }));
  const totalReps = sets * exercise.reps;
  return {
    id: uid(`slot${index}`),
    kind: 'main',
    exId: exercise.id,
    name: exercise.name,
    muscles: exercise.muscles,
    equipment: exercise.equipment.join('·'),
    startSec: 0,
    durationSec: sets * (exercise.reps * 4 + exercise.restSec),
    sets,
    restSec: exercise.restSec,
    setPlan,
    prIntent: Boolean(exercise.heavy),
    note: `${exercise.muscles.slice(0, 2).join('·')} · ${exercise.equipment.join('·')}`,
    cautionNote: cautionFor(exercise, profile),
    unit: exercise.unit,
    form: exercise.form,
    totalReps,
  };
}

function simpleSlot(kind, name, durationSec, note) {
  return {
    id: uid(kind),
    kind,
    exId: null,
    name,
    muscles: [],
    equipment: '',
    startSec: 0,
    durationSec,
    sets: 0,
    restSec: 0,
    setPlan: [],
    prIntent: false,
    note,
    cautionNote: '',
    unit: '',
    form: '',
    totalReps: 0,
  };
}

function warmupFor(focus) {
  if (/腿|下肢|臀/.test(focus)) {
    return ['动态活动度：髋屈肌 + 踝背屈 + 臀中肌', '每个方向 8–10 次，做到关节能打开而不是拉到痛'];
  }
  if (/推|胸|肩|臂/.test(focus)) {
    return ['动态活动度：胸椎旋转 + 肩绕环 + 前锯肌', '肩在无痛范围内绕环，随后 10 次肩胛前推'];
  }
  if (/拉|上肢|背/.test(focus)) {
    return ['动态活动度：胸椎旋转 + 肩袖外旋 + 背阔拉伸', '外旋用轻阻力带，每侧 12 次，不憋气'];
  }
  return ['动态活动度：髋 + 胸椎 + 肩组合', '每个方向 8 次，把今天要用到的关节都过一遍'];
}

function patternsFor(focus, areas) {
  if (areas.length) {
    return [...new Set(areas.flatMap((area) => AREA_PATTERNS[area] ?? []))];
  }
  return FOCUS_PATTERNS[focus] ?? FOCUS_PATTERNS['全身 A'];
}

export function buildSheet(state, options = {}) {
  const { profile } = state;
  const date = options.date ?? todayISO();
  const weekday = weekdayOf(date);
  const framework = state.framework;
  const frameworkDay = framework?.days?.find((day) => day.weekday === weekday) ?? null;
  const areas = options.wantAreas ?? [];
  const focus = options.focus ?? (areas.length ? areas.join(' · ') : frameworkDay?.focus ?? '自由训练');
  const totalMinutes = Math.max(15, Number(options.totalMinutes) || Number(profile.sessionMinutes) || 45);
  const mainCount = totalMinutes <= 30 ? 3 : totalMinutes <= 45 ? 4 : totalMinutes <= 60 ? 5 : 6;
  const patterns = patternsFor(focus, areas);
  const used = new Set();
  const picked = [];

  for (const pattern of patterns) {
    const exercise = pickByPattern([pattern], profile, used);
    if (exercise) {
      picked.push(exercise);
      used.add(exercise.id);
    }
    if (picked.length >= mainCount) break;
  }

  if (picked.length < mainCount) {
    const fill = pickForAreas(
      areas.length ? areas : [focus === '自由训练' ? '全身' : focus],
      profile,
      used,
      mainCount,
    );
    picked.push(...fill);
  }

  const warmup = warmupFor(focus);
  const slots = [simpleSlot('warmup', warmup[0], 360, warmup[1])];

  picked.slice(0, mainCount).forEach((exercise, index) => {
    slots.push(slotFromExercise(exercise, profile, index));
  });

  const wantsCardio =
    !profile.noCardio &&
    (areas.includes('有氧') || focus.includes('有氧') || focus === '自由训练');
  if (wantsCardio) {
    const cardio = EXERCISES.find(
      (exercise) => exercise.pattern === 'cardio' && allowedExercise(exercise, profile),
    );
    if (cardio) {
      slots.push({
        ...simpleSlot('cardio', cardio.name, 600, '能说话但不能唱歌的强度，做完还能正常吃饭'),
        exId: cardio.id,
        muscles: cardio.muscles,
        equipment: cardio.equipment.join('·'),
        sets: 1,
        setPlan: [{ weightKg: null, reps: cardio.reps }],
        unit: cardio.unit,
        form: cardio.form,
      });
    }
  }

  slots.push(simpleSlot('cooldown', '收尾：慢走 + 呼吸 + 今天最紧的部位拉伸', 300, '每个拉伸 30 秒，不追疼痛感'));

  return {
    id: uid('sheet'),
    createdAt: new Date().toISOString(),
    date,
    weekday,
    focus,
    input: {
      totalMinutes,
      wantArea: areas.join('、'),
      free: Boolean(options.free),
      direct: Boolean(options.direct),
    },
    budgetMinutes: totalMinutes,
    assumed: [
      '重量按保守起始值给，第一次做请再轻一档',
      profile.noCardio ? '不做有氧：计划里没有有氧块' : '有氧按低强度稳态安排',
    ],
    slots,
    overrides: {},
    skipped: [],
    loadAdjustPct: 1,
    flags: [
      ...(profile.homeOnly ? ['homeOnly'] : []),
      ...(profile.noCardio ? ['noCardio'] : []),
    ],
    dropped: [],
  };
}

export function sheetForDate(state, date = todayISO()) {
  return state.sheets.find((sheet) => sheet.date === date) ?? null;
}

export function upsertSheet(state, sheet) {
  const sheets = state.sheets.filter((item) => item.date !== sheet.date && item.id !== sheet.id);
  return { ...state, sheets: [...sheets, sheet] };
}

export function setLogsForSheet(state, sheet) {
  if (!sheet) return [];
  return state.setLogs.filter((log) => log.sheetId === sheet.id && log.date === sheet.date);
}

export function sheetStats(sheet, logs = []) {
  if (!sheet) return { sets: 0, planned: 0, minutes: 0, volume: 0, percent: 0 };
  const planned = sheet.slots
    .filter((slot) => slot.kind === 'main' && !sheet.skipped.includes(slot.id))
    .reduce((sum, slot) => sum + slot.setPlan.length, 0);
  const done = logs.length;
  const volume = logs.reduce(
    (sum, log) => sum + (Number(log.weightKg) || 0) * (Number(log.reps) || 0),
    0,
  );
  const minutes = Math.round(
    sheet.slots.reduce((sum, slot) => sum + (Number(slot.durationSec) || 0), 0) / 60,
  );
  return {
    sets: done,
    planned,
    minutes,
    volume: Math.round(volume),
    percent: planned ? Math.min(100, Math.round((done / planned) * 100)) : 0,
  };
}

export function frameworkWeek(framework, date = todayISO()) {
  if (!framework?.startDate) return null;
  const start = new Date(`${framework.startDate}T12:00:00`).getTime();
  const current = new Date(`${date}T12:00:00`).getTime();
  const week = Math.floor((current - start) / (7 * 86400000)) + 1;
  return framework.weeks?.find((item) => item.index === Math.max(1, week)) ?? null;
}

export function upcomingDays(framework, count = 7, from = todayISO()) {
  const days = [];
  for (let index = 0; index < count; index += 1) {
    const date = addDays(from, index);
    const weekday = weekdayOf(date);
    const plan = framework?.days?.find((day) => day.weekday === weekday) ?? null;
    days.push({ date, weekday, plan });
  }
  return days;
}

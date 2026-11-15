export const STORAGE_KEY = 'fitplan.v1';

export const EMPTY_PROFILE = {
  sex: null,
  age: null,
  heightCm: null,
  weightKg: null,
  bodyFatPct: null,
  experienceYears: null,
  lastSolidBlock: null,
  injuries: [],
  injuriesAnswered: false,
  commercialGym: null,
  extraEquipment: null,
  weekdays: null,
  sessionMinutes: null,
  goalWish: '',
  goal: null,
  sleepHours: null,
  dailySteps: null,
  dietRestrictions: null,
  noCardio: false,
  homeOnly: false,
  avoidNames: [],
  dayAreas: {},
};

export const DEFAULT_SETTINGS = {
  baseURL: 'https://api.deepseek.com/v1',
  apiKey: '',
  model: 'deepseek-chat',
  useAI: false,
};

export const DEFAULT_STATE = {
  version: 1,
  profile: { ...EMPTY_PROFILE },
  framework: null,
  sheets: [],
  setLogs: [],
  settings: { ...DEFAULT_SETTINGS },
  onboardingDone: false,
  picked: [],
  pickedDate: '',
  favorites: [],
  activityLogs: [],
  mealLogs: [],
  measureLogs: [],
};

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const arrayOfStrings = (value) => (Array.isArray(value) ? value.filter((item) => typeof item === 'string') : []);

function normalizeProfile(value) {
  const profile = { ...EMPTY_PROFILE, ...(isObject(value) ? value : {}) };
  profile.injuries = arrayOfStrings(profile.injuries);
  profile.avoidNames = arrayOfStrings(profile.avoidNames);
  profile.weekdays = Array.isArray(profile.weekdays)
    ? profile.weekdays.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    : null;
  profile.dayAreas = isObject(profile.dayAreas)
    ? Object.fromEntries(Object.entries(profile.dayAreas).filter(([, area]) => typeof area === 'string'))
    : {};
  profile.goalWish = typeof profile.goalWish === 'string' ? profile.goalWish : '';
  return profile;
}

function normalizeState(raw) {
  const source = isObject(raw) ? raw : {};
  return {
    ...DEFAULT_STATE,
    ...source,
    version: 1,
    profile: normalizeProfile(source.profile),
    settings: { ...DEFAULT_SETTINGS, ...(isObject(source.settings) ? source.settings : {}) },
    onboardingDone: source.onboardingDone === true,
    framework: isObject(source.framework) ? source.framework : null,
    sheets: Array.isArray(source.sheets) ? source.sheets : [],
    setLogs: Array.isArray(source.setLogs) ? source.setLogs : [],
    picked: arrayOfStrings(source.picked),
    pickedDate: typeof source.pickedDate === 'string' ? source.pickedDate : '',
    favorites: arrayOfStrings(source.favorites),
    activityLogs: Array.isArray(source.activityLogs) ? source.activityLogs : [],
    mealLogs: Array.isArray(source.mealLogs) ? source.mealLogs : [],
    measureLogs: Array.isArray(source.measureLogs) ? source.measureLogs : [],
  };
}

export function loadState() {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    return text ? normalizeState(JSON.parse(text)) : normalizeState(null);
  } catch {
    return normalizeState(null);
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeState(state)));
  } catch {
    // 本机存储满了也不该打断训练
  }
}

export function exportJSON(state) {
  const safe = normalizeState(state);
  safe.settings = { ...safe.settings, apiKey: '' };
  return JSON.stringify({ ...safe, exportedAt: new Date().toISOString() }, null, 2);
}

export function importJSON(text) {
  const parsed = JSON.parse(text);
  if (!isObject(parsed) || !isObject(parsed.profile)) {
    throw new Error('文件里没有档案数据，可能不是本应用导出的 JSON');
  }
  return normalizeState({ ...parsed, version: 1 });
}

export function uid(prefix) {
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}

export function dateISO(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayISO() {
  return dateISO(new Date());
}

export function parseDate(iso) {
  return new Date(`${iso}T12:00:00`);
}

export function addDays(iso, amount) {
  const date = parseDate(iso);
  date.setDate(date.getDate() + amount);
  return dateISO(date);
}

export function weekdayOf(iso) {
  return parseDate(iso).getDay();
}

export const WEEKDAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export function weekdayName(day) {
  return WEEKDAY_NAMES[day] ?? '';
}

export function shortDate(iso) {
  return iso ? iso.slice(5).replace('-', '/') : '';
}

export function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('zh-CN', { hour12: false });
}

export function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('zh-CN');
}

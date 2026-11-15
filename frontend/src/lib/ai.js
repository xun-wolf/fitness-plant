export function aiReady(settings) {
  return Boolean(
    settings?.useAI &&
      String(settings?.baseURL ?? '').trim() &&
      String(settings?.apiKey ?? '').trim() &&
      String(settings?.model ?? '').trim(),
  );
}

function endpoint(settings) {
  const base = String(settings.baseURL ?? '').trim().replace(/\/+$/, '');
  if (base.endsWith('/chat/completions')) return base;
  return `${base}/chat/completions`;
}

export async function chat(settings, messages, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeout ?? 45000);
  try {
    const response = await fetch(endpoint(settings), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: settings.model,
        messages,
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens ?? 1200,
      }),
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`模型接口返回 ${response.status}：${text.slice(0, 200)}`);
    }
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error('模型接口返回的不是 JSON');
    }
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new Error('模型没有返回内容');
    }
    return content.trim();
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('模型接口超时，换一个网络或稍后再试');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function parseJSON(text) {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('模型没有按 JSON 回复');
  return JSON.parse(cleaned.slice(start, end + 1));
}

const SYSTEM_PROMPT = `你是一个健身计划助手，不是医生，也不是注册营养师。
只做训练安排，不做诊断，不开药，不给补剂剂量。
不安排极限重量、不鼓励带伤硬练；出现疼痛、麻木、关节刺痛要建议停止并就医。
不给出低于女性 1600 kcal/天、男性 2000 kcal/天 的热量建议，不设计超过 24 小时的断食。
只输出 JSON，不要输出解释性文字。`;

export async function interpretGoal(profile, settings) {
  const content = await chat(
    settings,
    [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `请把下面这个人的愿望翻译成可执行的训练目标。只输出 JSON：
{
  "kindKey": "fatLoss | muscle | health",
  "summary": "一句话说明这个愿望实际意味着练什么",
  "priorityAreas": ["要优先发展的部位，2-4 个，用中文"]
}

档案：
${JSON.stringify(
  {
    sex: profile.sex,
    age: profile.age,
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    experienceYears: profile.experienceYears,
    weekdays: profile.weekdays,
    sessionMinutes: profile.sessionMinutes,
    injuries: profile.injuries,
    homeOnly: profile.homeOnly,
    noCardio: profile.noCardio,
    goalWish: profile.goalWish,
  },
  null,
  2,
)}`,
      },
    ],
    { maxTokens: 500, temperature: 0.2 },
  );
  const parsed = parseJSON(content);
  const kindKey = ['fatLoss', 'muscle', 'health'].includes(parsed.kindKey) ? parsed.kindKey : 'health';
  const priorityAreas = Array.isArray(parsed.priorityAreas)
    ? parsed.priorityAreas.filter((area) => typeof area === 'string').slice(0, 4)
    : [];
  return {
    kindKey,
    summary: typeof parsed.summary === 'string' ? parsed.summary : '',
    priorityAreas,
  };
}

export async function testConnection(settings) {
  const content = await chat(
    settings,
    [{ role: 'user', content: '只回两个字：可用' }],
    { maxTokens: 8, timeout: 20000 },
  );
  return content.slice(0, 40);
}

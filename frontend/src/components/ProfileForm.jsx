import { useState } from 'react';
import { EMPTY_PROFILE } from '../lib/storage';
import { INJURY_OPTIONS } from '../lib/exercises';
import { Card, Chips, Field, NumberField, TextArea, TextField } from './ui';

const WEEKDAYS = [
  { key: 1, label: '一' },
  { key: 2, label: '二' },
  { key: 3, label: '三' },
  { key: 4, label: '四' },
  { key: 5, label: '五' },
  { key: 6, label: '六' },
  { key: 0, label: '日' },
];

const YES_NO = [
  { key: 'yes', label: '有' },
  { key: 'no', label: '没有' },
];

export default function ProfileForm({ profile, onSave, onSkip, submitLabel = '保存档案' }) {
  const [draft, setDraft] = useState(() => ({ ...EMPTY_PROFILE, ...profile }));
  const [step, setStep] = useState(0);
  const patch = (value) => setDraft((current) => ({ ...current, ...value }));

  const save = () => {
    const next = {
      ...draft,
      injuriesAnswered: true,
      commercialGym:
        draft.commercialGym === 'yes' ? true : draft.commercialGym === 'no' ? false : null,
    };
    onSave(next);
  };

  const skip = () => {
    const next = {
      ...draft,
      age: null,
      heightCm: null,
      weightKg: null,
      bodyFatPct: null,
      injuriesAnswered: true,
    };
    (onSkip ?? onSave)(next);
  };

  return (
    <div>
      <div className="tabs">
        {['身体数据', '训练安排', '目标与生活'].map((label, index) => (
          <button
            key={label}
            type="button"
            className="tab"
            aria-pressed={step === index}
            onClick={() => setStep(index)}
          >
            {label}
          </button>
        ))}
      </div>

      {step === 0 ? (
        <Card title="身体数据">
          <Field label="性别">
            <Chips
              options={[
                { key: 'male', label: '男' },
                { key: 'female', label: '女' },
              ]}
              value={draft.sex}
              multiple={false}
              onChange={(sex) => patch({ sex })}
            />
          </Field>
          <div className="row2">
            <NumberField label="年龄" value={draft.age} min={10} max={120} onChange={(age) => patch({ age })} />
            <NumberField
              label="身高（cm）"
              value={draft.heightCm}
              min={100}
              max={250}
              onChange={(heightCm) => patch({ heightCm })}
            />
          </div>
          <div className="row2">
            <NumberField
              label="体重（kg）"
              value={draft.weightKg}
              min={25}
              max={300}
              step={0.1}
              onChange={(weightKg) => patch({ weightKg })}
            />
            <NumberField
              label="体脂率（%）"
              value={draft.bodyFatPct}
              min={3}
              max={70}
              step={0.1}
              onChange={(bodyFatPct) => patch({ bodyFatPct })}
            />
          </div>
          <div className="faint">这些数据只用来估算起始重量和热量参考，随时可以改。</div>
        </Card>
      ) : null}

      {step === 1 ? (
        <Card title="训练安排">
          <div className="row2">
            <NumberField
              label="训练年限"
              value={draft.experienceYears}
              min={0}
              max={60}
              step={0.5}
              onChange={(experienceYears) => patch({ experienceYears })}
            />
            <NumberField
              label="一次练多久（分钟）"
              value={draft.sessionMinutes}
              min={10}
              max={180}
              onChange={(sessionMinutes) => patch({ sessionMinutes })}
            />
          </div>
          <Field label="一周练哪几天">
            <Chips
              options={WEEKDAYS}
              value={draft.weekdays ?? []}
              onChange={(weekdays) => patch({ weekdays })}
            />
          </Field>
          <Field label="有伤病或需要回避的部位" hint="选了以后，计划会避开对应风险动作，并给出替代提示">
            <Chips
              options={INJURY_OPTIONS}
              value={draft.injuries}
              onChange={(injuries) => patch({ injuries })}
            />
          </Field>
          <Field label="有商业健身房吗">
            <Chips
              options={YES_NO}
              value={draft.commercialGym === true ? 'yes' : draft.commercialGym === false ? 'no' : null}
              multiple={false}
              onChange={(value) => patch({ commercialGym: value })}
            />
          </Field>
          <TextField
            label="家里还有别的器械吗"
            value={draft.extraEquipment}
            placeholder="例如：哑铃 20kg、弹力带、单杠"
            onChange={(extraEquipment) => patch({ extraEquipment })}
          />
          <Field label="限制条件">
            <Chips
              options={[
                { key: 'home', label: '只在家练' },
                { key: 'noCardio', label: '不做有氧' },
              ]}
              value={[
                ...(draft.homeOnly ? ['home'] : []),
                ...(draft.noCardio ? ['noCardio'] : []),
              ]}
              onChange={(values) =>
                patch({ homeOnly: values.includes('home'), noCardio: values.includes('noCardio') })
              }
            />
          </Field>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card title="目标与生活">
          <TextArea
            label="想练成什么样"
            value={draft.goalWish}
            rows={4}
            placeholder="例如：想减掉一点肚子，但不想掉力量；一周只能练三次"
            onChange={(goalWish) => patch({ goalWish })}
          />
          <div className="row2">
            <NumberField
              label="平均睡几个小时"
              value={draft.sleepHours}
              min={3}
              max={14}
              step={0.5}
              onChange={(sleepHours) => patch({ sleepHours })}
            />
            <NumberField
              label="每天大概走多少步"
              value={draft.dailySteps}
              min={0}
              max={60000}
              step={500}
              onChange={(dailySteps) => patch({ dailySteps })}
            />
          </div>
          <TextArea
            label="饮食限制"
            value={draft.dietRestrictions}
            rows={2}
            placeholder="例如：乳糖不耐、不吃牛肉、食堂为主"
            onChange={(dietRestrictions) => patch({ dietRestrictions })}
          />
        </Card>
      ) : null}

      <div className="btnbar">
        {step > 0 ? (
          <button className="btn ghost" type="button" onClick={() => setStep(step - 1)}>
            上一步
          </button>
        ) : (
          <button className="btn ghost" type="button" onClick={skip}>
            先跳过身体数据
          </button>
        )}
        {step < 2 ? (
          <button className="btn primary" type="button" onClick={() => setStep(step + 1)}>
            下一步
          </button>
        ) : (
          <button className="btn primary" type="button" onClick={save}>
            {submitLabel}
          </button>
        )}
      </div>
    </div>
  );
}

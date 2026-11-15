import { useState } from 'react';
import ProfileForm from '../components/ProfileForm';
import { aiReady, interpretGoal } from '../lib/ai';
import { buildFramework, localGoal } from '../lib/plan';

export default function Setup({ state, update, go }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const finish = async (profile, skipFramework = false) => {
    setBusy(true);
    setError('');
    let goal = localGoal(profile);
    if (!skipFramework && aiReady(state.settings)) {
      try {
        goal = await interpretGoal(profile, state.settings);
      } catch (err) {
        setError(`大模型没读成，先用本地规则生成：${err.message}`);
      }
    }
    const nextProfile = { ...profile, goal };
    const framework = skipFramework ? null : buildFramework(nextProfile);
    update((current) => ({
      ...current,
      profile: nextProfile,
      framework,
      onboardingDone: true,
    }));
    setBusy(false);
    go('/train');
  };

  const skip = (profile) => {
    update((current) => ({
      ...current,
      profile: { ...profile, goal: localGoal(profile) },
      onboardingDone: true,
    }));
    go('/train');
  };

  return (
    <div>
      <button className="btn ghost backbtn" type="button" onClick={() => go('/welcome')}>
        ‹ 返回欢迎页
      </button>
      {error ? <div className="notice danger">{error}</div> : null}
      {busy ? <div className="card faint">正在生成你的周框架…</div> : null}
      <ProfileForm
        profile={state.profile}
        submitLabel="保存并生成周框架"
        onSave={(profile) => finish(profile, false)}
        onSkip={skip}
      />
    </div>
  );
}

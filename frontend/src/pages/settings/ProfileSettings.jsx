import { useState } from 'react';
import ProfileForm from '../../components/ProfileForm';
import { Notice } from '../../components/ui';
import { buildFramework, localGoal } from '../../lib/plan';

export default function ProfileSettings({ state, update, go }) {
  const [message, setMessage] = useState('');

  const save = (profile) => {
    const goal = localGoal(profile);
    const nextProfile = { ...profile, goal };
    update((current) => {
      const framework = current.framework
        ? buildFramework(nextProfile, {
            id: current.framework.id,
            startDate: current.framework.startDate,
          })
        : null;
      return { ...current, profile: nextProfile, framework, onboardingDone: true };
    });
    setMessage('档案已保存；周框架按新档案重排了，今天的清单如果已经生成，可以回运动页换一份。');
    go('/settings');
  };

  return (
    <div>
      {message ? <Notice>{message}</Notice> : null}
      <ProfileForm profile={state.profile} onSave={save} submitLabel="保存档案" />
      <div className="btnbar">
        <button className="btn ghost" type="button" onClick={() => go('/settings')}>
          回设置
        </button>
      </div>
    </div>
  );
}

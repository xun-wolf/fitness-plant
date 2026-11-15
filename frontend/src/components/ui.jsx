export function TopBar({ title, sub, back, onBack, right }) {
  return (
    <header className="topbar">
      {back ? (
        <button className="btn ghost backbtn" type="button" onClick={onBack}>
          ‹ 返回
        </button>
      ) : null}
      <div>
        <h1>{title}</h1>
        {sub ? <div className="sub">{sub}</div> : null}
      </div>
      <div className="spacer" />
      {right}
    </header>
  );
}

export function Card({ title, children, className = '', tight = false }) {
  return (
    <section className={`card${tight ? ' tight' : ''}${className ? ` ${className}` : ''}`}>
      {title ? <h3>{title}</h3> : null}
      {children}
    </section>
  );
}

export function Field({ label, hint, children }) {
  return (
    <div className="field">
      {label ? <label>{label}</label> : null}
      {children}
      {hint ? <div className="faint" style={{ marginTop: 4 }}>{hint}</div> : null}
    </div>
  );
}

export function NumberField({ label, value, onChange, min, max, step = 1, placeholder, hint }) {
  return (
    <Field label={label} hint={hint}>
      <input
        type="number"
        inputMode="decimal"
        value={value ?? ''}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))}
      />
    </Field>
  );
}

export function TextField({ label, value, onChange, placeholder, hint, type = 'text' }) {
  return (
    <Field label={label} hint={hint}>
      <input
        type={type}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

export function TextArea({ label, value, onChange, placeholder, hint, rows = 3 }) {
  return (
    <Field label={label} hint={hint}>
      <textarea
        rows={rows}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

export function Chips({ options, value, onChange, multiple = true }) {
  const selected = multiple ? (Array.isArray(value) ? value : []) : value;
  const isOn = (key) => (multiple ? selected.includes(key) : selected === key);
  const toggle = (key) => {
    if (!multiple) {
      onChange(key);
      return;
    }
    onChange(selected.includes(key) ? selected.filter((item) => item !== key) : [...selected, key]);
  };
  return (
    <div className="chips">
      {options.map((option) => {
        const key = typeof option === 'string' ? option : option.key;
        const label = typeof option === 'string' ? option : option.label;
        return (
          <button
            key={key}
            type="button"
            className={`chip${isOn(key) ? ' on' : ''}`}
            aria-pressed={isOn(key)}
            onClick={() => toggle(key)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function Pills({ options, value, onChange }) {
  return (
    <div className="pills">
      {options.map((option) => {
        const key = typeof option === 'string' ? option : option.key;
        const label = typeof option === 'string' ? option : option.label;
        return (
          <button
            key={key}
            type="button"
            className="pill"
            aria-pressed={value === key}
            onClick={() => onChange(key)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function Notice({ children, tone = '' }) {
  return <div className={`notice${tone ? ` ${tone}` : ''}`}>{children}</div>;
}

export function Empty({ title, children }) {
  return (
    <div className="card">
      <h3>{title}</h3>
      <div className="small muted">{children}</div>
    </div>
  );
}

export function Loading({ text = '正在读取…' }) {
  return <div className="card faint">{text}</div>;
}

const ICONS = {
  dumbbell: (
    <>
      <path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10" />
    </>
  ),
  moves: (
    <>
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v6M8 10h8M12 13l-3 5M12 13l3 5" />
    </>
  ),
  log: (
    <>
      <path d="M5 5h14M5 10h14M5 15h9M5 20h6" />
    </>
  ),
  diet: (
    <>
      <path d="M4 11h16a8 8 0 0 1-8 8 8 8 0 0 1-8-8Z" />
      <path d="M9 11c0-3 1-5 3-7" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
    </>
  ),
  back: <path d="M15 5l-7 7 7 7" />,
  check: <path d="M5 13l4 4L19 7" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
};

export function Icon({ name }) {
  return (
    <svg
      className="ico"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name] ?? ICONS.dumbbell}
    </svg>
  );
}

import { useState, type ReactNode } from 'react';

type CheckState = {
  tos: boolean;
  privacy: boolean;
  noAdvice: boolean;
  transactional: boolean;
  marketing: boolean;
};

type LegalAcceptanceProps = {
  onChange: (allRequired: boolean) => void;
};

export function LegalAcceptance({ onChange }: LegalAcceptanceProps) {
  const [checks, setChecks] = useState<CheckState>({
    tos: false,
    privacy: false,
    noAdvice: false,
    transactional: false,
    marketing: false,
  });

  const set = (key: keyof CheckState) => {
    const next = { ...checks, [key]: !checks[key] };
    setChecks(next);
    onChange(next.tos && next.privacy && next.noAdvice && next.transactional);
  };

  const Checkbox = ({ id, required, children }: { id: keyof CheckState; required?: boolean; children: ReactNode }) => (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14, cursor: 'pointer' }}>
      <input
        type="checkbox"
        checked={checks[id]}
        onChange={() => set(id)}
        required={required}
        style={{ marginTop: 3, flexShrink: 0, accentColor: '#1A2A44', width: 16, height: 16 }}
      />
      <span style={{ fontSize: 13, color: '#444', lineHeight: 1.6 }}>
        {required && <span style={{ color: '#C0392B', marginRight: 4 }}>*</span>}
        {children}
      </span>
    </label>
  );

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 12, fontFamily: 'var(--font-mono)' }}>
        Legal Acceptance
      </div>

      <Checkbox id="tos" required>
        I have read and unconditionally accept the{' '}
        <a href="/legal#tos" target="_blank" rel="noreferrer" style={{ color: '#1A2A44', fontWeight: 600 }}>Terms of Service</a>,
        including the automatic renewal policy, non-refund policy, and limitation of liability.
        I acknowledge my Subscription renews automatically and I am solely responsible for cancelling before my Billing Date.
      </Checkbox>

      <Checkbox id="privacy" required>
        I have read the{' '}
        <a href="/legal#privacy" target="_blank" rel="noreferrer" style={{ color: '#1A2A44', fontWeight: 600 }}>Privacy Policy</a>{' '}
        and{' '}
        <a href="/legal#cookies" target="_blank" rel="noreferrer" style={{ color: '#1A2A44', fontWeight: 600 }}>Cookie Policy</a>{' '}
        and consent to the processing of my personal data as described.
      </Checkbox>

      <Checkbox id="noAdvice" required>
        I acknowledge that Nautilus is an information and analytics platform only.
        Nothing provided constitutes financial or investment advice.
        All investment decisions are at my sole risk.{' '}
        <strong>Non-use during a billing period does not entitle me to a refund.</strong>
      </Checkbox>

      <Checkbox id="transactional" required>
        I agree to receive transactional emails (billing alerts, account notifications, service communications) from Nautilus.
      </Checkbox>

      <Checkbox id="marketing">
        I would like to receive market intelligence newsletters from Nautilus. (Optional)
      </Checkbox>

      <p style={{ fontSize: 12, color: '#888', marginTop: 12, lineHeight: 1.6 }}>
        By creating your account, you confirm you are at least 18 years of age, have read and accepted the{' '}
        <a href="/legal" target="_blank" rel="noreferrer" style={{ color: '#1A2A44' }}>Terms of Service, Privacy Policy, and Cookie Policy</a>,
        and understand that Nautilus does not provide financial advice.
        Your Subscription renews automatically. You may cancel at any time in your account settings.
      </p>
    </div>
  );
}

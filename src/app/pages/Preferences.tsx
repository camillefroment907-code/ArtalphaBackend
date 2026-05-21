import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { getToken } from '../../lib/auth';

const BACKEND = import.meta.env.VITE_API_URL || 'https://artalpha-backend-production.up.railway.app';

const CATEGORIES = [
  { label: 'Peinture', icon: '🎨' },
  { label: 'Estampes & Éditions', icon: '🖨️' },
  { label: 'Sculpture', icon: '🗿' },
  { label: 'Photographie', icon: '📷' },
  { label: 'Dessin & Papier', icon: '✏️' },
  { label: 'Art urbain', icon: '🏙️' },
];

const BUDGETS = [
  { key: 'under_500', label: '< €500', sub: 'Premier achat' },
  { key: '500_2k', label: '€500 – €2 000', sub: 'Artistes émergents' },
  { key: '2k_10k', label: '€2 000 – €10 000', sub: 'Marché confirmé' },
  { key: '10k_50k', label: '€10 000 – €50 000', sub: 'Accès blue chip' },
  { key: 'above_50k', label: '> €50 000', sub: 'Niveau institutionnel' },
];

const HORIZONS = [
  { value: 'short', label: 'Court terme', sub: '< 2 ans' },
  { value: 'medium', label: 'Moyen terme', sub: '2–5 ans' },
  { value: 'long', label: 'Long terme', sub: '5+ ans' },
];

export default function Preferences() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const lang = i18n.language?.startsWith('fr') ? 'fr' : 'en';

  const [categories, setCategories] = useState<string[]>([]);
  const [budget, setBudget] = useState('');
  const [horizon, setHorizon] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load existing preferences
  useEffect(() => {
    const token = getToken();
    if (!token) { navigate('/app/login'); return; }
    fetch(`${BACKEND}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        if (data.preferred_categories?.length) setCategories(data.preferred_categories);
        if (data.investment_budget) setBudget(data.investment_budget);
        if (data.investment_horizon) setHorizon(data.investment_horizon);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggleCategory = (cat: string) => {
    setCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const handleSave = async () => {
    const token = getToken();
    if (!token) return;
    setSaving(true);
    try {
      await fetch(`${BACKEND}/api/auth/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          preferred_categories: categories,
          investment_budget: budget || null,
          investment_horizon: horizon || null,
        }),
      });
      setSaved(true);
      setTimeout(() => navigate('/app/dashboard'), 1200);
    } catch {
      setSaving(false);
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 57px)' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#9CA3AF' }}>Chargement…</div>
    </div>
  );

  return (
    <div style={{ minHeight: 'calc(100vh - 57px)', background: '#FAFAF8' }}>

      {/* Header */}
      <div style={{ padding: '32px 48px 24px', borderBottom: '1px solid #E8E4DC', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#9CA3AF', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '6px' }}>
            Ma Sélection
          </div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '26px', fontWeight: 600, color: '#1A2A44', margin: 0 }}>
            Mes préférences
          </h1>
        </div>
        <button
          onClick={() => navigate('/app/dashboard')}
          style={{ fontSize: '13px', color: '#6B7280', background: 'none', border: '1px solid #E8E4DC', borderRadius: '6px', padding: '8px 16px', cursor: 'pointer' }}
        >
          ← Retour
        </button>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '48px' }}>

        {/* Categories */}
        <div style={{ marginBottom: '48px' }}>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '18px', fontWeight: 600, color: '#1A2A44', margin: '0 0 6px' }}>
            Catégories qui vous intéressent
          </h2>
          <p style={{ fontSize: '13px', color: '#6B7280', margin: '0 0 20px' }}>
            Sélectionnez une ou plusieurs catégories
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            {CATEGORIES.map(cat => {
              const active = categories.includes(cat.label);
              return (
                <div
                  key={cat.label}
                  onClick={() => toggleCategory(cat.label)}
                  style={{
                    padding: '14px 16px', borderRadius: '8px', cursor: 'pointer',
                    border: `1px solid ${active ? '#1A2A44' : '#E8E4DC'}`,
                    background: active ? '#1A2A44' : 'white',
                    transition: 'all 0.15s',
                    display: 'flex', alignItems: 'center', gap: '10px',
                  }}
                >
                  <span style={{ fontSize: '18px' }}>{cat.icon}</span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: active ? 'white' : '#1A2A44' }}>
                    {cat.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Budget */}
        <div style={{ marginBottom: '48px' }}>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '18px', fontWeight: 600, color: '#1A2A44', margin: '0 0 6px' }}>
            Budget par œuvre
          </h2>
          <p style={{ fontSize: '13px', color: '#6B7280', margin: '0 0 20px' }}>
            Votre fourchette habituelle
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {BUDGETS.map(b => {
              const active = budget === b.key;
              return (
                <div
                  key={b.key}
                  onClick={() => setBudget(b.key)}
                  style={{
                    padding: '14px 20px', borderRadius: '8px', cursor: 'pointer',
                    border: `1px solid ${active ? '#1A2A44' : '#E8E4DC'}`,
                    background: active ? '#1A2A44' : 'white',
                    transition: 'all 0.15s',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: '14px', fontWeight: 600, color: active ? 'white' : '#1A2A44' }}>{b.label}</span>
                  <span style={{ fontSize: '12px', color: active ? 'rgba(255,255,255,0.6)' : '#9CA3AF', fontFamily: 'var(--font-mono)' }}>{b.sub}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Horizon */}
        <div style={{ marginBottom: '48px' }}>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '18px', fontWeight: 600, color: '#1A2A44', margin: '0 0 6px' }}>
            Horizon d'investissement
          </h2>
          <p style={{ fontSize: '13px', color: '#6B7280', margin: '0 0 20px' }}>
            Sur quelle durée envisagez-vous de conserver vos œuvres ?
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            {HORIZONS.map(h => {
              const active = horizon === h.value;
              return (
                <div
                  key={h.value}
                  onClick={() => setHorizon(h.value)}
                  style={{
                    padding: '16px', borderRadius: '8px', cursor: 'pointer',
                    border: `1px solid ${active ? '#1A2A44' : '#E8E4DC'}`,
                    background: active ? '#1A2A44' : 'white',
                    transition: 'all 0.15s', textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '14px', fontWeight: 600, color: active ? 'white' : '#1A2A44', marginBottom: '4px' }}>{h.label}</div>
                  <div style={{ fontSize: '11px', color: active ? 'rgba(255,255,255,0.6)' : '#9CA3AF', fontFamily: 'var(--font-mono)' }}>{h.sub}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving || saved}
          style={{
            width: '100%', padding: '16px',
            background: saved ? '#059669' : '#1A2A44',
            color: saved ? 'white' : '#C6A85A',
            border: 'none', borderRadius: '8px',
            fontSize: '14px', fontWeight: 700,
            cursor: saving || saved ? 'default' : 'pointer',
            transition: 'all 0.2s', letterSpacing: '0.04em',
          }}
        >
          {saved ? '✓ Préférences enregistrées — redirection…' : saving ? 'Enregistrement…' : 'Enregistrer mes préférences →'}
        </button>

      </div>
    </div>
  );
}

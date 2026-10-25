import { useState } from 'react';

const CATEGORIES = ['Peinture', 'Photographie', 'Sculpture', 'Estampes', 'Design', 'Céramique'];
const STYLES = ['Contemporain', 'Moderne', 'Classique', 'Abstrait', 'Figuratif', 'Minimaliste'];
const PERIODS = ['Avant 1900', '1900–1945', '1945–2000', 'Depuis 2000'];
type Taste = { categories: string[]; styles: string[]; periods: string[]; budget: string };
const INITIAL: Taste = { categories: [], styles: [], periods: [], budget: '' };
export default function ArtisticTasteV2() {
  const [taste, setTaste] = useState<Taste>(INITIAL);
  const [complete, setComplete] = useState(false);
  const toggle = (key: 'categories' | 'styles' | 'periods', value: string) => {
    setComplete(false);
    setTaste(prev => ({ ...prev, [key]: prev[key].includes(value) ? prev[key].filter(v => v !== value) : [...prev[key], value] }));
  };
  const groups = [
    { key: 'categories' as const, label: 'Quels types d’œuvres aimez-vous ?', values: CATEGORIES },
    { key: 'styles' as const, label: 'Quels univers vous attirent ?', values: STYLES },
    { key: 'periods' as const, label: 'Quelles périodes vous intéressent ?', values: PERIODS },
  ];
  const budget = Number(taste.budget);
  const valid = taste.categories.length > 0 && taste.styles.length > 0 && taste.periods.length > 0 && taste.budget.trim() !== '' && Number.isFinite(budget) && budget > 0;
  return <main style={{ minHeight: '100vh', padding: '60px 20px', background: '#F7F5F0', color: '#1A2A44', fontFamily: 'Inter,Arial,sans-serif' }}>
    <div style={{ maxWidth: 780, margin: '0 auto' }}>
      <a href="/v2" style={{ color: '#1A2A44', fontSize: 13 }}>← Nautilus</a>
      <p style={{ fontSize: 12, letterSpacing: 3, marginTop: 42 }}>VOTRE UNIVERS ARTISTIQUE</p>
      <h1 style={{ font: '400 clamp(32px,5vw,52px) Georgia,serif' }}>L’art qui vous ressemble</h1>
      <p style={{ lineHeight: 1.7 }}>Quelques choix pour dessiner votre profil. Aucune inscription nécessaire : les réponses restent dans cette page et ne sont envoyées à aucun serveur.</p>
      {groups.map(group => <section key={group.key} style={{ marginTop: 36 }}>
        <h2 style={{ font: '400 23px Georgia,serif' }}>{group.label}</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {group.values.map(value => {
            const selected = taste[group.key].includes(value);
            return <button key={value} type="button" aria-pressed={selected} onClick={() => toggle(group.key, value)}
              style={{ padding: '12px 18px', borderRadius: 30, border: '1px solid #A9B0B8', background: selected ? '#1A2A44' : 'white', color: selected ? 'white' : '#1A2A44', cursor: 'pointer', fontSize: 14 }}>{value}</button>;
          })}
        </div>
      </section>)}
      <section style={{ marginTop: 36 }}>
        <label htmlFor="budget" style={{ display: 'block', font: '400 23px Georgia,serif', marginBottom: 12 }}>Quel est votre budget maximum par œuvre ?</label>
        <input id="budget" type="number" min="1" step="1" value={taste.budget} onChange={e => { setComplete(false); setTaste(prev => ({ ...prev, budget: e.target.value })); }}
          placeholder="Ex. 1500" style={{ padding: 14, borderRadius: 8, border: '1px solid #A9B0B8', fontSize: 16, width: '100%', maxWidth: 300 }} /> <span>€</span>
      </section>
      <button type="button" disabled={!valid} onClick={() => setComplete(true)}
        style={{ marginTop: 34, padding: '15px 24px', border: 0, borderRadius: 8, background: valid ? '#1A2A44' : '#AAB0B7', color: 'white', cursor: valid ? 'pointer' : 'not-allowed', fontSize: 15 }}>Découvrir mon profil</button>
      {complete && valid && <section aria-live="polite" style={{ marginTop: 28, padding: 24, background: 'white', borderRadius: 12 }}>
        <h2 style={{ font: '400 27px Georgia,serif' }}>Votre profil artistique</h2>
        <p><strong>Œuvres :</strong> {taste.categories.join(', ')}</p>
        <p><strong>Styles :</strong> {taste.styles.join(', ')}</p>
        <p><strong>Périodes :</strong> {taste.periods.join(', ')}</p>
        <p><strong>Budget :</strong> {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(budget)}</p>
        <p>Ce profil est une première étape. Les recommandations de lots seront disponibles après l'intégration de catalogues autorisés.</p>
      </section>}
      <p style={{ marginTop: 30, fontSize: 12, lineHeight: 1.7, color: '#57606C' }}>Aucune donnée d'enchères externe, aucun cookie de suivi et aucun compte requis pour cette démonstration. Vos choix ne sont pas enregistrés après la fermeture de la page.</p>
    </div>
  </main>;
}

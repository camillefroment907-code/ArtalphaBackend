import { useSEO } from '../../lib/useSEO';

export default function ArtistsFollowing() {
  useSEO({
    title: 'Artistes à suivre — Nautilus',
    description: "La sélection éditoriale Nautilus — artistes dont la cote évolue et opportunités que le marché n'a pas encore intégrées.",
  });

  return (
    <main style={{
      maxWidth: '860px', margin: '0 auto',
      padding: '52px 24px 100px',
    }}>

      {/* Eyebrow */}
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: '11px',
        letterSpacing: '0.14em', textTransform: 'uppercase',
        color: 'var(--text-3)', marginBottom: '20px',
      }}>
        Artistes à suivre
      </div>

      {/* Title */}
      <h1 style={{
        fontFamily: 'var(--font-serif)', fontSize: '36px',
        fontWeight: 400, color: 'var(--navy)',
        margin: '0 0 20px', lineHeight: 1.15,
      }}>
        La sélection Nautilus
      </h1>

      {/* Description */}
      <p style={{
        fontFamily: 'var(--font-serif)', fontSize: '16px',
        fontStyle: 'italic', color: 'var(--text-2)',
        lineHeight: 1.65, maxWidth: '560px',
        margin: '0 0 56px', padding: 0,
      }}>
        Chaque semaine, Nautilus identifie les artistes dont la cote évolue, les ventes
        à venir et les opportunités que le marché n'a pas encore intégrées.
      </p>

      {/* Placeholder */}
      <div style={{
        padding: '64px 48px',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        textAlign: 'center',
        background: 'var(--bg-subtle)',
      }}>
        <div style={{
          fontFamily: 'var(--font-serif)', fontSize: '32px',
          color: 'var(--border)', marginBottom: '20px',
        }}>
          ◇
        </div>
        <div style={{
          fontFamily: 'var(--font-serif)', fontSize: '18px',
          color: 'var(--navy)', marginBottom: '10px',
        }}>
          Bientôt disponible
        </div>
        <div style={{
          fontSize: '13px', color: 'var(--text-3)',
          lineHeight: 1.65, maxWidth: '380px',
          margin: '0 auto',
        }}>
          Notre analyse passe en revue les signaux de marché pour identifier
          les artistes qui méritent votre attention maintenant.
        </div>
      </div>

    </main>
  );
}

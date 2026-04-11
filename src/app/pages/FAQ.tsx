import { useState, useMemo } from 'react';
import { Link } from 'react-router';

// ── Data ─────────────────────────────────────────────────────────────────────

interface QA { q: string; a: string; }
interface Section { id: string; title: string; items: QA[]; }

const SECTIONS: Section[] = [
  {
    id: 'compte',
    title: 'Compte & Inscription',
    items: [
      {
        q: 'Comment créer un compte Nautilus ?',
        a: 'Cliquez sur "Sign Up" en haut à droite de la page d\'accueil. Renseignez votre email et un mot de passe. Vous serez redirigé vers une courte étape de configuration de votre profil d\'investissement (budget, horizon, type de collectionneur). Votre compte est activé immédiatement.',
      },
      {
        q: 'Comment me connecter à mon compte ?',
        a: 'Rendez-vous sur <a href="https://artalpha.io/app/login">artalpha.io/app/login</a> et entrez votre email et mot de passe. Si vous avez oublié votre mot de passe, utilisez le lien "Mot de passe oublié" sur la page de connexion.',
      },
      {
        q: 'Comment modifier mon profil ?',
        a: 'Dans la section <a href="https://artalpha.io/app/portfolio">Portfolio</a>, vous trouverez vos informations de compte. Vous pouvez mettre à jour votre nom, email, et préférences d\'investissement.',
      },
      {
        q: 'Comment supprimer mon compte ?',
        a: 'Dans <a href="https://artalpha.io/app/portfolio">artalpha.io/app/portfolio</a>, faites défiler jusqu\'à la section "Danger Zone" en bas de page. Cliquez sur "Delete Account", tapez DELETE pour confirmer. Cette action est irréversible.',
      },
      {
        q: 'Mes données sont-elles sécurisées ?',
        a: 'Oui. Vos données sont stockées sur des serveurs sécurisés (Railway/Neon PostgreSQL). Vos mots de passe sont hachés avec bcrypt. Nous ne vendons jamais vos données à des tiers.',
      },
    ],
  },
  {
    id: 'abonnements',
    title: 'Abonnements & Facturation',
    items: [
      {
        q: 'Quels sont les plans disponibles ?',
        a: 'Nautilus propose 4 plans : <strong>Collector</strong> (€9/mois) pour débuter, <strong>Investor</strong> (€29/mois) pour les opportunités avancées et l\'agent IA, <strong>Family Office</strong> (€99/mois) pour les investisseurs sérieux avec accès complet, et <strong>Institutional</strong> (sur devis) pour les maisons de vente et family offices institutionnels.',
      },
      {
        q: "Y a-t-il un essai gratuit ?",
        a: 'Oui, tous les plans payants incluent un essai gratuit de 7 jours. Aucune carte de crédit requise pour démarrer l\'essai.',
      },
      {
        q: 'Comment upgrader mon abonnement ?',
        a: 'Rendez-vous sur <a href="https://artalpha.io/app/pricing">artalpha.io/app/pricing</a>, sélectionnez le plan souhaité et cliquez sur "Upgrade". Le changement est immédiat et la différence est proratisée sur votre prochain cycle de facturation.',
      },
      {
        q: 'Comment downgrader mon abonnement ?',
        a: 'Sur <a href="https://artalpha.io/app/pricing">artalpha.io/app/pricing</a>, sélectionnez un plan inférieur. Le downgrade prend effet à la prochaine échéance de facturation. Vous conservez votre accès actuel jusqu\'à cette date.',
      },
      {
        q: "Puis-je changer de plan en cours d'abonnement annuel ?",
        a: 'Upgrade : oui, immédiatement, avec prorata. Downgrade : non, le changement prendra effet à la prochaine échéance annuelle. Vous conservez votre accès actuel jusqu\'à cette date.',
      },
      {
        q: 'Comment annuler mon abonnement ?',
        a: 'Dans <a href="https://artalpha.io/app/portfolio">artalpha.io/app/portfolio</a>, section Subscription, cliquez sur "Manage Subscription". Vous pouvez annuler depuis le portail Stripe. Votre accès reste actif jusqu\'à la fin de la période payée.',
      },
      {
        q: 'Quels moyens de paiement sont acceptés ?',
        a: 'Carte bancaire (Visa, Mastercard, American Express) via Stripe. Les paiements sont sécurisés et conformes PCI-DSS.',
      },
      {
        q: 'Puis-je obtenir une facture ?',
        a: 'Oui. Après chaque paiement, une facture est envoyée automatiquement à votre email. Vous pouvez également les retrouver dans le portail Stripe accessible depuis <a href="https://artalpha.io/app/portfolio">artalpha.io/app/portfolio</a>.',
      },
      {
        q: "Que se passe-t-il si mon paiement échoue ?",
        a: "Vous recevez un email d'alerte immédiatement. Stripe retente automatiquement le paiement. Votre accès est maintenu temporairement. Si le paiement n'est pas régularisé, votre compte passe en plan gratuit.",
      },
    ],
  },
  {
    id: 'opportunites',
    title: 'Opportunités & Lots',
    items: [
      {
        q: 'Comment fonctionne la page Opportunités ?',
        a: 'La page <a href="https://artalpha.io/app/opportunities">artalpha.io/app/opportunities</a> affiche deux onglets : "Alpha Opportunities" (lots sous-évalués détectés par l\'IA) et "Live Auctions" (tous les lots à venir). Les données sont mises à jour toutes les 15 minutes.',
      },
      {
        q: "Qu'est-ce que le Deal Score ?",
        a: "Le Deal Score (0-100) est calculé par notre algorithme en combinant 5 facteurs : décote par rapport à l'estimation basse, décote par rapport au prix marché de l'artiste, score de liquidité de l'artiste, réputation de la maison de vente, et complétude des données. Score ≥ 65 = opportunité sérieuse. Score ≥ 80 = exceptionnel.",
      },
      {
        q: 'Que signifient les tiers EXCEPTIONAL / STRONG / INTERESTING ?',
        a: '<strong>EXCEPTIONAL</strong> (score ≥ 80) : opportunité rare, fort signal d\'achat. <strong>STRONG</strong> (65-79) : bonne opportunité, signal positif. <strong>INTERESTING</strong> (45-64) : mérite attention, à analyser selon votre profil.',
      },
      {
        q: 'Comment utiliser les filtres ?',
        a: "Dans la sidebar gauche de la page Opportunités, vous pouvez filtrer par date d'enchère, fourchette de prix, source, catégorie, artiste, maison de vente et score minimum. Les filtres se combinent et se mettent à jour en temps réel.",
      },
      {
        q: 'Puis-je voir les lots déjà vendus ?',
        a: "Les lots passés ne sont pas affichés dans le feed principal. Seuls les lots avec une date d'enchère future (ou sans date) apparaissent.",
      },
      {
        q: "Combien de lots puis-je voir selon mon plan ?",
        a: "Plan gratuit : 3 lots. Collector : 10 lots. Investor et au-dessus : illimité.",
      },
      {
        q: "D'où proviennent les données des lots ?",
        a: "Nautilus agrège les données de 10 sources : Drouot, Interenchères, Invaluable, LiveAuctioneers, Sotheby's, Christie's, Bonhams, eBay, Artsy et Catawiki. Les données sont mises à jour toutes les 15 minutes.",
      },
      {
        q: "Comment accéder au détail d'un lot ?",
        a: "Cliquez sur n'importe quelle carte de lot pour ouvrir la page de détail. Vous y trouverez l'analyse complète, les projections de valeur (selon votre plan) et le lien vers la source originale.",
      },
    ],
  },
  {
    id: 'agent',
    title: 'Agent IA',
    items: [
      {
        q: "Qu'est-ce que l'Agent IA ?",
        a: "L'Agent IA est votre conseiller personnel automatisé. Il surveille en continu les nouveaux lots et vous envoie des recommandations personnalisées (STRONG BUY, BUY, WATCH) basées sur vos critères : budget, artiste favori, catégorie, horizon d'investissement. Disponible sur les plans Investor et au-dessus.",
      },
      {
        q: "Comment créer une alerte Agent IA ?",
        a: 'Rendez-vous sur <a href="https://artalpha.io/app/agent">artalpha.io/app/agent</a>. Cliquez sur "+ Créer une alerte". Définissez un nom, vos critères (artiste, catégorie, budget, horizon) et enregistrez. L\'agent analysera les nouveaux lots toutes les 15 minutes.',
      },
      {
        q: "Combien d'alertes puis-je créer ?",
        a: "Investor : 1 alerte. Family Office : 5 alertes. Institutional : illimité.",
      },
      {
        q: "Quand est-ce que je reçois des recommandations ?",
        a: 'Les recommandations apparaissent dans <a href="https://artalpha.io/app/agent">artalpha.io/app/agent</a> après chaque cycle de scan (toutes les 15 minutes). Si vous avez activé les alertes email, vous recevez aussi un email à chaque nouvelle recommandation.',
      },
      {
        q: "Comment fonctionne le score de conviction ?",
        a: "Le score de conviction (0-100) est calculé par GPT-4o en analysant l'adéquation entre le lot et vos critères. Il prend en compte : la pertinence artistique, la qualité financière du lot (deal score), l'horizon temporel et votre tolérance au risque. Score ≥ 80 = forte conviction.",
      },
      {
        q: "Puis-je modifier ou supprimer une alerte ?",
        a: 'Oui. Dans <a href="https://artalpha.io/app/agent">artalpha.io/app/agent</a>, cliquez sur l\'icône crayon pour modifier ou × pour supprimer. La suppression efface aussi toutes les recommandations associées.',
      },
      {
        q: 'Comment marquer une recommandation comme "achetée" ?',
        a: 'Dans <a href="https://artalpha.io/app/agent">artalpha.io/app/agent</a>, cliquez sur "Marquer acheté" sous la recommandation. Vous pouvez ensuite ajouter l\'œuvre à votre portfolio depuis <a href="https://artalpha.io/app/portfolio">artalpha.io/app/portfolio</a>.',
      },
    ],
  },
  {
    id: 'larry',
    title: 'Larry (Chatbot IA)',
    items: [
      {
        q: 'Qui est Larry ?',
        a: "Larry est votre conseiller privé en investissement art, intégré à Nautilus. Il connaît l'histoire de l'art, le marché des enchères mondial, la cotation des artistes et les opportunités actuelles en base. Il vous aide à analyser des lots, comprendre le marché et prendre de meilleures décisions d'investissement.",
      },
      {
        q: 'Sur quels plans Larry est-il disponible ?',
        a: "Larry est disponible sur les plans Investor (30 messages/mois), Family Office (200 messages/mois) et Institutional (illimité).",
      },
      {
        q: 'Larry peut-il m\'envoyer des liens vers des lots ?',
        a: "Oui. Quand vous demandez des recommandations de lots, Larry puise dans la base de données Nautilus en temps réel et vous fournit des liens directs vers les lots correspondants.",
      },
      {
        q: 'Les conversations avec Larry sont-elles sauvegardées ?',
        a: "Oui, les 30 derniers jours de conversation sont conservés. Au-delà, les messages sont automatiquement supprimés.",
      },
      {
        q: 'Larry peut-il se tromper ?',
        a: "Larry est configuré pour ne citer que des lots réels présents en base Nautilus. Pour les questions de marché générales, il s'appuie sur ses connaissances GPT-4o. Comme tout conseil, ses recommandations sont indicatives et ne constituent pas un conseil financier réglementé.",
      },
    ],
  },
  {
    id: 'portfolio',
    title: 'Portfolio',
    items: [
      {
        q: 'Comment ajouter une œuvre à mon portfolio ?',
        a: 'Dans <a href="https://artalpha.io/app/portfolio">artalpha.io/app/portfolio</a>, cliquez sur "+ Add an artwork". Renseignez le titre, l\'artiste, le prix d\'achat, et optionnellement la date, le médium et des notes. L\'œuvre apparaît immédiatement dans votre collection.',
      },
      {
        q: 'Puis-je lier une œuvre de mon portfolio à un lot Nautilus ?',
        a: "Oui. Lors de l'ajout d'une œuvre, vous pouvez renseigner un lot_id pour lier l'œuvre à un lot existant en base.",
      },
      {
        q: 'Comment modifier ou supprimer une œuvre de mon portfolio ?',
        a: 'Cliquez sur le bouton "Edit" de l\'œuvre pour modifier ses informations. Cliquez sur "×" pour supprimer (confirmation requise).',
      },
      {
        q: 'Comment voir les statistiques de mon portfolio ?',
        a: 'En haut de <a href="https://artalpha.io/app/portfolio">artalpha.io/app/portfolio</a>, le strip de statistiques affiche : total investi, valeur estimée totale, rendement global, et nombre d\'œuvres.',
      },
    ],
  },
  {
    id: 'alertes',
    title: 'Alertes',
    items: [
      {
        q: "Quelle est la différence entre les Alertes et l'Agent IA ?",
        a: 'Les <a href="https://artalpha.io/app/alerts">Alertes</a> sont des notifications simples basées sur des critères (artiste, catégorie, score, prix). L\'<a href="https://artalpha.io/app/agent">Agent IA</a> est plus avancé : il utilise GPT-4o pour analyser chaque lot et générer une recommandation personnalisée avec raisonnement.',
      },
      {
        q: 'Comment créer une alerte simple ?',
        a: 'Dans <a href="https://artalpha.io/app/alerts">artalpha.io/app/alerts</a>, sélectionnez le type d\'alerte (Artiste, Catégorie, Prix, Score), renseignez vos critères et cliquez sur "Add Alert". Vous serez notifié par email dès qu\'un lot correspondant apparaît.',
      },
      {
        q: "Combien d'alertes simples puis-je créer ?",
        a: "Plan gratuit : 1 alerte. Collector : 5 alertes. Investor : 20 alertes. Family Office et au-dessus : illimité.",
      },
      {
        q: 'Comment activer ou désactiver une alerte ?',
        a: 'Dans <a href="https://artalpha.io/app/alerts">artalpha.io/app/alerts</a>, cliquez sur le bouton "● Active" / "○ Paused" à droite de l\'alerte pour basculer son état.',
      },
    ],
  },
  {
    id: 'technique',
    title: 'Technique',
    items: [
      {
        q: 'À quelle fréquence les données sont-elles mises à jour ?',
        a: "Toutes les 15 minutes via notre pipeline automatisé. La barre de statut en haut de la page Opportunités indique la dernière mise à jour.",
      },
      {
        q: 'Sur quels navigateurs Nautilus fonctionne-t-il ?',
        a: "Chrome, Firefox, Safari, Edge (versions récentes). L'interface est optimisée pour desktop. Une version mobile est en cours de développement.",
      },
      {
        q: 'Puis-je utiliser Nautilus sur mobile ?',
        a: "L'interface est responsive et utilisable sur mobile, mais optimisée pour desktop. Une application mobile native est prévue.",
      },
      {
        q: 'Comment contacter le support ?',
        a: 'Via le formulaire de contact sur <a href="https://artalpha.io/contact">artalpha.io/contact</a>, ou directement par email. Pour les clients Institutional, un accès prioritaire au support est inclus.',
      },
      {
        q: 'Nautilus est-il disponible en anglais ?',
        a: "Oui. L'interface est disponible en français et en anglais. Larry répond dans votre langue automatiquement.",
      },
    ],
  },
];

// ── Components ────────────────────────────────────────────────────────────────

function AccordionItem({ item, open, onToggle }: { item: QA; open: boolean; onToggle: () => void }) {
  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '14px 0',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          gap: '16px',
        }}
      >
        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--navy)', lineHeight: 1.4 }}>
          {item.q}
        </span>
        <span style={{
          flexShrink: 0,
          fontSize: '12px',
          color: 'var(--gold)',
          transition: 'transform 0.2s',
          display: 'inline-block',
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        }}>▼</span>
      </button>
      {open && (
        <div
          style={{ padding: '0 0 16px 0', fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.8 }}
          dangerouslySetInnerHTML={{ __html: item.a }}
        />
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function FAQ() {
  const [query, setQuery] = useState('');
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});

  const toggle = (key: string) =>
    setOpenItems(prev => ({ ...prev, [key]: !prev[key] }));

  const filtered = useMemo(() => {
    if (!query.trim()) return SECTIONS;
    const q = query.toLowerCase();
    return SECTIONS.map(sec => ({
      ...sec,
      items: sec.items.filter(
        item => item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q)
      ),
    })).filter(sec => sec.items.length > 0);
  }, [query]);

  const totalResults = filtered.reduce((n, s) => n + s.items.length, 0);

  return (
    <div style={{ minHeight: '100vh', background: '#fff', fontFamily: 'var(--font-sans, sans-serif)' }}>

      {/* Navbar */}
      <nav style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: '#fff',
        borderBottom: '1px solid var(--border)',
        padding: '0 48px',
        height: '64px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontFamily: 'var(--font-serif, serif)', fontSize: '20px', fontWeight: 700, color: 'var(--navy)' }}>
            Nautilus
          </span>
        </Link>
        <div style={{ display: 'flex', gap: '32px', alignItems: 'center', fontSize: '13px' }}>
          <Link to="/" style={{ color: 'var(--text-2)', textDecoration: 'none' }}>Accueil</Link>
          <Link to="/pricing" style={{ color: 'var(--text-2)', textDecoration: 'none' }}>Pricing</Link>
          <Link
            to="/app/login"
            style={{
              padding: '8px 20px',
              background: 'var(--navy)',
              color: '#fff',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '13px',
            }}
          >
            Se connecter
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ textAlign: 'center', padding: '64px 24px 48px', borderBottom: '1px solid var(--border)' }}>
        <h1 style={{
          fontFamily: 'var(--font-serif, serif)',
          fontSize: '42px',
          fontWeight: 700,
          color: 'var(--navy)',
          margin: '0 0 12px',
          letterSpacing: '-0.02em',
        }}>
          Centre d'aide
        </h1>
        <p style={{ color: 'var(--text-2)', fontSize: '16px', margin: '0 0 32px' }}>
          Toutes les réponses pour utiliser Nautilus
        </p>
        {/* Search */}
        <div style={{
          maxWidth: '560px',
          margin: '0 auto',
          position: 'relative',
        }}>
          <span style={{
            position: 'absolute',
            left: '16px',
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '16px',
            pointerEvents: 'none',
          }}>🔍</span>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Rechercher dans la FAQ…"
            style={{
              width: '100%',
              padding: '14px 16px 14px 44px',
              fontSize: '14px',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              outline: 'none',
              color: 'var(--text-1)',
              boxSizing: 'border-box',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => (e.currentTarget.style.borderColor = 'var(--navy)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
          />
          {query && (
            <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-2)' }}>
              {totalResults} résultat{totalResults !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>

      {/* Body: sidebar + content */}
      <div style={{
        maxWidth: '1100px',
        margin: '0 auto',
        padding: '48px 24px 96px',
        display: 'grid',
        gridTemplateColumns: '220px 1fr',
        gap: '64px',
        alignItems: 'start',
      }}>

        {/* Sidebar nav */}
        <nav style={{ position: 'sticky', top: '80px' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-2)', textTransform: 'uppercase', margin: '0 0 12px' }}>
            Sections
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {SECTIONS.map(sec => (
              <a
                key={sec.id}
                href={`#${sec.id}`}
                style={{
                  display: 'block',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  color: 'var(--text-2)',
                  textDecoration: 'none',
                  transition: 'background 0.15s, color 0.15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'var(--surface, #f5f4f1)';
                  e.currentTarget.style.color = 'var(--navy)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--text-2)';
                }}
              >
                {sec.title}
              </a>
            ))}
          </div>
        </nav>

        {/* FAQ content */}
        <div>
          {filtered.length === 0 ? (
            <p style={{ color: 'var(--text-2)', fontSize: '14px' }}>
              Aucun résultat pour « {query} ». Essayez un autre mot-clé ou{' '}
              <Link to="/contact" style={{ color: 'var(--navy)' }}>contactez-nous</Link>.
            </p>
          ) : (
            filtered.map(sec => (
              <section
                key={sec.id}
                id={sec.id}
                style={{ marginBottom: '48px', borderBottom: '1px solid var(--border)', paddingBottom: '32px' }}
              >
                <h2 style={{
                  fontFamily: 'var(--font-serif, serif)',
                  fontSize: '22px',
                  fontWeight: 700,
                  color: 'var(--navy)',
                  margin: '0 0 16px',
                }}>
                  {sec.title}
                </h2>
                {sec.items.map((item, i) => {
                  const key = `${sec.id}-${i}`;
                  return (
                    <AccordionItem
                      key={key}
                      item={item}
                      open={!!openItems[key]}
                      onToggle={() => toggle(key)}
                    />
                  );
                })}
              </section>
            ))
          )}
        </div>
      </div>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--border)',
        padding: '32px 48px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '13px',
        color: 'var(--text-2)',
      }}>
        <span style={{ fontFamily: 'var(--font-serif, serif)', fontWeight: 700, color: 'var(--navy)' }}>Nautilus</span>
        <div style={{ display: 'flex', gap: '24px' }}>
          <Link to="/about" style={{ color: 'var(--text-2)', textDecoration: 'none' }}>About</Link>
          <Link to="/contact" style={{ color: 'var(--text-2)', textDecoration: 'none' }}>Contact</Link>
          <Link to="/pricing" style={{ color: 'var(--text-2)', textDecoration: 'none' }}>Pricing</Link>
        </div>
        <span style={{ fontSize: '11px', letterSpacing: '0.1em' }}>© 2026 NAUTILUS</span>
      </footer>

      <style>{`
        a { color: var(--navy); }
        @media (max-width: 768px) {
          .faq-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

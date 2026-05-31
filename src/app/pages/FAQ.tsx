import { useState, useMemo } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useSEO } from '../../lib/useSEO';
import { Logo } from '../components/Logo';

const FAQ_DATA = {
  fr: [
    {
      category: 'À propos de Nautilus',
      questions: [
        {
          q: "Qu'est-ce que Nautilus ?",
          a: "Nautilus est une plateforme d'intelligence de marché pour les collectionneurs et investisseurs en art. Nous agrégeons les données de 14+ maisons de vente mondiales et plateformes de marché primaire, puis nous scorons chaque lot de 0 à 100 selon l'écart de prix par rapport aux ventes comparables, la dynamique de l'artiste et la demande du marché. Pensez à un outil de type Bloomberg Terminal — mais dédié à l'art.",
        },
        {
          q: 'À qui s\'adresse Nautilus ?',
          a: "Nautilus est conçu pour toute personne qui approche l'art comme un investissement : les collectionneurs individuels avec des budgets de 500 € à 1 M€+, les family offices allouant des capitaux aux actifs alternatifs, les gestionnaires de patrimoine conseillant des clients avec des positions en art, et les fonds d'art ayant besoin d'un flux d'opportunités systématique.",
        },
        {
          q: 'Nautilus est-il disponible en français ?',
          a: "Oui. Nautilus est entièrement disponible en français et en anglais. Vous pouvez changer de langue à tout moment depuis les paramètres ou le toggle en haut à droite de la plateforme.",
        },
        {
          q: 'Nautilus constitue-t-il un conseil financier ?',
          a: "Non. Nautilus fournit de l'intelligence de marché et de l'analyse de données — pas des conseils financiers ou d'investissement. Nos scores et analyses sont des outils informationnels pour soutenir votre propre recherche et prise de décision. L'investissement en art comporte des risques, et les performances passées ne garantissent pas les résultats futurs.",
        },
        {
          q: 'Comment Nautilus se différencie-t-il des autres plateformes d\'art ?',
          a: "La plupart des outils de données en art (Artprice, Artnet) se concentrent sur les résultats historiques. Nautilus se concentre sur les opportunités en temps réel : identifier les lots sous-évalués avant que le marteau ne tombe. Notre score de conviction et notre calcul de max bid sont conçus pour vous aider à prendre une décision d'achat informée — pas seulement à comprendre ce qui s'est passé.",
        },
      ],
    },
    {
      category: 'Le score de conviction',
      questions: [
        {
          q: 'Comment fonctionne le score Nautilus ?',
          a: "Chaque lot reçoit un score de conviction de 0 à 100. Le score combine : le prix actuel par rapport aux ventes historiques comparables (écart de prix), la dynamique de marché de l'artiste (résultats récents, tier de galerie, demande institutionnelle), les facteurs spécifiques au lot (technique, dimensions, provenance, état), et les signaux de timing de marché. Un score de 83+ est 'Exceptionnel' — notre niveau de conviction le plus élevé.",
        },
        {
          q: 'Quelle est la fiabilité du score ?',
          a: "Nos signaux sont basés sur les ventes réelles aux enchères. Les performances passées ne garantissent pas les résultats futurs.",
        },
        {
          q: "Qu'est-ce que le Max Bid calculé par Nautilus ?",
          a: "Le Max Bid est le prix maximum que notre modèle vous recommande de payer pour un lot donné, frais acheteur inclus. Il est calculé à partir de l'analyse des ventes comparables sur 24 mois, de la rareté de l'œuvre, et du potentiel d'appréciation. Dépasser ce seuil augmente significativement le risque de surpayer.",
        },
        {
          q: 'Pourquoi certains lots scorent 85/100 et d\'autres 40/100 ?',
          a: "Le score reflète la combinaison de la sous-évaluation et de la qualité d'investissement. Un lot peut être sous-pricé (prix bas par rapport à l'estimation) mais scorer faiblement si l'artiste a une faible liquidité ou une demande en déclin. Un score élevé requiert à la fois un écart de prix significatif ET de solides fondamentaux artistiques.",
        },
      ],
    },
    {
      category: 'Plans & Tarifs',
      questions: [
        {
          q: 'Quelle est la différence entre les plans ?',
          a: "Le plan Gratuit donne accès à 3 opportunités par jour et aux scores de base. Le plan Starter (Collector) débloque jusqu'à 15 opportunités par jour et les alertes email. Le plan Investor donne accès à toutes les opportunités, les alertes en temps réel, l'analyse d'artistes et le suivi de portefeuille. Le plan Pro ajoute l'accès API, les rapports personnalisés et la priorité support. Le plan Institutionnel offre une configuration sur mesure pour les fonds et family offices.",
        },
        {
          q: 'Y a-t-il un essai gratuit ?',
          a: "Oui. Tous les nouveaux comptes bénéficient d'un essai gratuit de 7 jours sur le plan Investor, sans carte bancaire requise. Vous pouvez explorer toutes les fonctionnalités avant de décider.",
        },
        {
          q: 'Puis-je changer de plan à tout moment ?',
          a: "Oui. Vous pouvez upgrader immédiatement (effet pro-rata). Les downgrades sur les plans annuels prennent effet à la fin de votre période de facturation — vous conservez votre accès actuel jusque-là.",
        },
        {
          q: 'Y a-t-il une garantie satisfait ou remboursé ?',
          a: "Oui. Si Nautilus n'identifie pas une opportunité rentable correspondant à votre profil dans vos 30 premiers jours, nous remboursons votre abonnement intégralement. Sans questions.",
        },
        {
          q: 'Proposez-vous des tarifs institutionnels ?',
          a: "Oui. Pour les fonds d'art, family offices et acheteurs institutionnels avec des besoins spécifiques, contactez-nous à contact@get-nautilus.com pour des tarifs personnalisés et un accès API.",
        },
        {
          q: 'La facturation est-elle mensuelle ou annuelle ?',
          a: "Les deux options sont disponibles. La facturation annuelle offre une réduction significative par rapport au mensuel. Vous pouvez basculer entre les deux à tout moment.",
        },
      ],
    },
    {
      category: 'Données & Couverture',
      questions: [
        {
          q: 'Quelles maisons de vente Nautilus couvre-t-il ?',
          a: "Nous couvrons actuellement : Christie's, Sotheby's, Phillips, Bonhams, Drouot, Artcurial, Invaluable, LiveAuctioneers, Heritage Auctions, Artsy, ArtMarketAPI, Catawiki, Interenchères, et plusieurs maisons régionales — 14+ sources au total. Nous ajoutons régulièrement de nouvelles sources.",
        },
        {
          q: 'Combien de lots sont analysés en temps réel ?',
          a: "Nautilus analyse actuellement plus de 29 000 lots actifs, avec des dizaines de milliers de nouveaux lots ingérés chaque semaine. Notre pipeline fonctionne en continu et reflète les données les plus récentes disponibles pour chaque source.",
        },
        {
          q: 'À quelle fréquence les données sont-elles mises à jour ?',
          a: "Notre pipeline tourne en continu. Les nouveaux lots sont ingérés dès leur publication par les maisons de vente. Les scores sont recalculés toutes les heures pour les lots actifs. Les données de résultats (lots vendus) sont mises à jour dans les heures suivant la vente.",
        },
        {
          q: 'Nautilus couvre-t-il le marché primaire (galeries) ?',
          a: "Oui, partiellement. Nous couvrons des plateformes de marché primaire sélectionnées dont Artsper, Saatchi Art, Catawiki et Singulart. La couverture complète des galeries est en développement.",
        },
        {
          q: 'Jusqu\'où remontent les données historiques ?',
          a: "Notre base de données contient plus d'un million de résultats d'enchères historiques sur les 24 derniers mois pour les principales maisons. Ces données alimentent le calcul des prix comparables et les projections de CAGR par artiste.",
        },
      ],
    },
    {
      category: 'Alertes & Notifications',
      questions: [
        {
          q: 'Comment fonctionnent les alertes ?',
          a: "Nautilus vous envoie une alerte dès qu'un lot correspondant à vos critères (budget, artistes suivis, score minimum) est détecté. Les alertes sont disponibles par email et Telegram. Vous configurez vos préférences depuis la page Paramètres.",
        },
        {
          q: 'Puis-je recevoir des alertes sur des artistes spécifiques ?',
          a: "Oui. Depuis votre profil, vous pouvez ajouter des artistes à votre liste de surveillance. Nautilus vous alertera à chaque nouveau lot de ces artistes, indépendamment de leur score.",
        },
        {
          q: 'Comment configurer les alertes Telegram ?',
          a: "Depuis la page Paramètres > Notifications, entrez votre Telegram Chat ID. Vous pouvez obtenir votre Chat ID en démarrant une conversation avec notre bot @NautilusAlertsBot et en tapant /start.",
        },
        {
          q: 'Puis-je définir un score minimum pour les alertes ?',
          a: "Oui. Vous pouvez définir un seuil de score minimum (par exemple, n'être alerté que pour les lots scorés 70+). Cela vous permet de ne recevoir que les opportunités les plus pertinentes selon votre niveau d'exigence.",
        },
      ],
    },
    {
      category: 'Portefeuille & Suivi',
      questions: [
        {
          q: 'Que permet le suivi de portefeuille ?',
          a: "Le module portefeuille vous permet d'enregistrer vos acquisitions et de suivre leur évolution de valeur estimée dans le temps. Pour chaque œuvre, Nautilus calcule un retour estimé basé sur les ventes comparables récentes et projette la valeur sur différents horizons.",
        },
        {
          q: 'Puis-je ajouter des œuvres que je n\'ai pas achetées via Nautilus ?',
          a: "Oui. Vous pouvez ajouter manuellement toute œuvre à votre portefeuille — qu'elle ait été achetée via Nautilus, en galerie, ou directement auprès d'un artiste. Renseignez le titre, l'artiste, le prix d'achat et la date, et Nautilus fait le reste.",
        },
        {
          q: 'Qu\'est-ce que la liste de favoris (wishlist) ?',
          a: "La wishlist vous permet de sauvegarder des lots qui vous intéressent sans les ajouter à votre portefeuille. Nautilus vous notifie si un lot similaire (même artiste, même technique) réapparaît dans une prochaine vente.",
        },
      ],
    },
    {
      category: 'Compte & Sécurité',
      questions: [
        {
          q: 'Comment créer un compte ?',
          a: "Cliquez sur 'Commencer gratuitement' depuis la page d'accueil. Vous pouvez vous inscrire avec votre email ou via Google. L'inscription prend moins de 60 secondes.",
        },
        {
          q: 'Mes données sont-elles sécurisées ?',
          a: "Oui. Nautilus utilise un chiffrement SSL/TLS pour toutes les communications. Vos données personnelles et financières ne sont jamais partagées avec des tiers. Nous sommes conformes au RGPD.",
        },
        {
          q: 'Comment résilier mon abonnement ?',
          a: "Vous pouvez résilier à tout moment depuis votre profil > Abonnement > Annuler. Vous conservez l'accès jusqu'à la fin de votre période de facturation en cours. Aucun frais supplémentaire ne sera prélevé.",
        },
      ],
    },
  ],
  en: [
    {
      category: 'About Nautilus',
      questions: [
        {
          q: 'What is Nautilus?',
          a: "Nautilus is a market intelligence platform for art collectors and investors. We aggregate data from 14+ global auction houses and primary market platforms, then score every lot from 0 to 100 based on price vs comparable sales, artist momentum, and market demand. Think of it as a Bloomberg Terminal — built exclusively for art.",
        },
        {
          q: 'Who is Nautilus for?',
          a: "Nautilus is built for anyone who approaches art as an investment: individual collectors with budgets from €500 to €1M+, family offices allocating to alternative assets, wealth managers advising clients with art holdings, and art funds needing systematic deal flow.",
        },
        {
          q: 'Is Nautilus available in French?',
          a: "Yes. Nautilus is fully available in both French and English. You can switch languages at any time from the settings or using the toggle in the top right of the platform.",
        },
        {
          q: 'Is Nautilus financial advice?',
          a: "No. Nautilus provides market intelligence and data analysis — not financial or investment advice. Our scores and analyses are informational tools to support your own research and decision-making. Art investment carries risk, and past performance does not guarantee future results.",
        },
        {
          q: 'How does Nautilus differ from other art data platforms?',
          a: "Most art data tools (Artprice, Artnet) focus on historical results. Nautilus focuses on real-time opportunities: identifying undervalued lots before the hammer falls. Our Conviction Score and Max Bid calculation are designed to help you make an informed buying decision — not just understand what happened in the past.",
        },
      ],
    },
    {
      category: 'The Conviction Score',
      questions: [
        {
          q: 'How does the Nautilus score work?',
          a: "Every lot receives a Conviction Score from 0 to 100. The score combines: current price vs comparable historical sales (price gap), artist market momentum (recent auction results, gallery tier, institutional demand), lot-specific factors (medium, size, provenance, condition), and market timing signals. A score of 83+ is 'Exceptional' — our highest conviction tier.",
        },
        {
          q: 'How accurate is the score?',
          a: "Our signals are based on real auction sales data. Past performance does not guarantee future results.",
        },
        {
          q: "What is Nautilus's calculated Max Bid?",
          a: "The Max Bid is the maximum price our model recommends you pay for a given lot, including buyer's premium. It is calculated from comparable sales analysis over 24 months, work rarity, and appreciation potential. Exceeding this threshold significantly increases the risk of overpaying.",
        },
        {
          q: 'Why do some lots score 85/100 while others score 40/100?',
          a: "The score reflects the combination of undervaluation and investment quality. A lot can be underpriced (low current price vs estimate) but score low if the artist has poor liquidity or declining demand. A high score requires both a meaningful price gap AND strong underlying artist fundamentals.",
        },
      ],
    },
    {
      category: 'Plans & Pricing',
      questions: [
        {
          q: 'What is the difference between plans?',
          a: "The Free plan gives access to 3 opportunities per day and basic scores. The Starter (Collector) plan unlocks up to 15 opportunities per day and email alerts. The Investor plan provides access to all opportunities, real-time alerts, artist analytics and portfolio tracking. The Pro plan adds API access, custom reports and priority support. The Institutional plan offers a custom setup for funds and family offices.",
        },
        {
          q: 'Is there a free trial?',
          a: "Yes. All new accounts receive a free 7-day trial on the Investor plan, no credit card required. You can explore all features before deciding.",
        },
        {
          q: 'Can I upgrade or downgrade at any time?',
          a: "You can upgrade at any time and the change takes effect immediately (prorated). Downgrades on annual plans take effect at the end of your billing period — you keep your current access until then.",
        },
        {
          q: 'Is there a money-back guarantee?',
          a: "Yes. If Nautilus doesn't identify a profitable opportunity matching your profile within your first 30 days, we refund your subscription in full. No questions asked.",
        },
        {
          q: 'Do you offer institutional pricing?',
          a: "Yes. For art funds, family offices, and institutional buyers with custom needs, contact us at contact@get-nautilus.com for tailored pricing and API access.",
        },
        {
          q: 'Is billing monthly or annual?',
          a: "Both options are available. Annual billing offers a significant discount over monthly. You can switch between the two at any time.",
        },
      ],
    },
    {
      category: 'Data & Coverage',
      questions: [
        {
          q: 'Which auction houses does Nautilus cover?',
          a: "We currently cover: Christie's, Sotheby's, Phillips, Bonhams, Drouot, Artcurial, Invaluable, LiveAuctioneers, Heritage Auctions, Artsy, ArtMarketAPI, Catawiki, Interenchères, and several regional houses — 14+ sources in total. We add new sources regularly.",
        },
        {
          q: 'How many lots are analyzed in real time?',
          a: "Nautilus currently analyzes over 29,000 active lots, with tens of thousands of new lots ingested every week. Our pipeline runs continuously and reflects the most current data available from each source.",
        },
        {
          q: 'How often is data updated?',
          a: "Our pipeline runs continuously. New lots are ingested as soon as they are published by auction houses. Scores are recalculated hourly for active lots. Result data (sold lots) is updated within hours of the sale.",
        },
        {
          q: 'Does Nautilus cover the primary market (galleries)?',
          a: "Yes, partially. We cover select primary market platforms including Artsper, Saatchi Art, Catawiki, and Singulart. Full gallery coverage is in development.",
        },
        {
          q: 'How far back does the historical data go?',
          a: "Our database contains over one million historical auction results covering the past 24 months for the major houses. This data feeds the comparable price calculation and per-artist CAGR projections.",
        },
      ],
    },
    {
      category: 'Alerts & Notifications',
      questions: [
        {
          q: 'How do alerts work?',
          a: "Nautilus sends you an alert as soon as a lot matching your criteria (budget, tracked artists, minimum score) is detected. Alerts are available by email and Telegram. You configure your preferences from the Settings page.",
        },
        {
          q: 'Can I receive alerts for specific artists?',
          a: "Yes. From your profile, you can add artists to your watchlist. Nautilus will alert you for every new lot by those artists, regardless of their score.",
        },
        {
          q: 'How do I set up Telegram alerts?',
          a: "From Settings > Notifications, enter your Telegram Chat ID. You can get your Chat ID by starting a conversation with our bot @NautilusAlertsBot and typing /start.",
        },
        {
          q: 'Can I set a minimum score for alerts?',
          a: "Yes. You can set a minimum score threshold (e.g., only be alerted for lots scoring 70+). This lets you receive only the most relevant opportunities according to your standards.",
        },
      ],
    },
    {
      category: 'Portfolio & Tracking',
      questions: [
        {
          q: 'What does portfolio tracking allow?',
          a: "The portfolio module lets you record your acquisitions and track their estimated value over time. For each work, Nautilus calculates an estimated return based on recent comparable sales and projects value across different time horizons.",
        },
        {
          q: "Can I add works I didn't buy through Nautilus?",
          a: "Yes. You can manually add any artwork to your portfolio — whether purchased through Nautilus, from a gallery, or directly from an artist. Enter the title, artist, purchase price and date, and Nautilus does the rest.",
        },
        {
          q: 'What is the wishlist?',
          a: "The wishlist lets you save lots that interest you without adding them to your portfolio. Nautilus will notify you if a similar lot (same artist, same medium) reappears in an upcoming sale.",
        },
      ],
    },
    {
      category: 'Account & Security',
      questions: [
        {
          q: 'How do I create an account?',
          a: "Click 'Get started for free' from the homepage. You can sign up with your email or via Google. Registration takes less than 60 seconds.",
        },
        {
          q: 'Is my data secure?',
          a: "Yes. Nautilus uses SSL/TLS encryption for all communications. Your personal and financial data is never shared with third parties. We are GDPR compliant.",
        },
        {
          q: 'How do I cancel my subscription?',
          a: "You can cancel at any time from your profile > Subscription > Cancel. You retain access until the end of your current billing period. No additional charges will be made.",
        },
      ],
    },
  ],
};

export default function FAQ() {
  const { i18n } = useTranslation();
  const lang: 'fr' | 'en' = i18n.language?.startsWith('fr') ? 'fr' : 'en';
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const sections = FAQ_DATA[lang];

  const faqSchema = useMemo(() => ({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: sections.flatMap(section =>
      section.questions.map((q: { q: string; a: string }) => ({
        '@type': 'Question',
        name: q.q,
        acceptedAnswer: { '@type': 'Answer', text: q.a },
      }))
    ),
  }), [sections]);

  useSEO({
    title: lang === 'fr' ? 'FAQ · Nautilus' : 'FAQ · Nautilus',
    description: lang === 'fr'
      ? 'Toutes les réponses à vos questions sur Nautilus — score de conviction, plans, couverture, alertes et portefeuille.'
      : 'Answers to your questions about Nautilus — conviction score, plans, data coverage, alerts and portfolio tracking.',
    schema: faqSchema,
  });

  const toggle = (key: string) => setOpen(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)', height: '64px', padding: '0 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link to="/" style={{ textDecoration: 'none' }}>
          <Logo variant="horizontal" color="dark" size={24} />
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Language toggle */}
          <div style={{ display: 'flex', gap: '2px', background: 'var(--bg-subtle)', borderRadius: '6px', padding: '2px', border: '1px solid var(--border)' }}>
            {(['fr', 'en'] as const).map(l => (
              <button
                key={l}
                onClick={() => { i18n.changeLanguage(l); localStorage.setItem('i18nextLng', l); }}
                style={{
                  padding: '4px 10px',
                  borderRadius: '4px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.08em',
                  background: lang === l ? 'var(--navy)' : 'transparent',
                  color: lang === l ? 'white' : 'var(--text-3)',
                  transition: 'all 0.15s',
                }}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
          <Link to="/app/signup" style={{ background: 'var(--navy)', color: 'white', padding: '8px 20px', borderRadius: '6px', textDecoration: 'none', fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em' }}>
            {lang === 'fr' ? 'COMMENCER' : 'GET ACCESS'}
          </Link>
        </div>
      </header>

      {/* Hero */}
      <div style={{ background: 'var(--navy)', padding: '60px 40px', textAlign: 'center' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.2em', color: '#C6A85A', fontFamily: 'var(--font-mono)', marginBottom: '16px' }}>
            FAQ
          </div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 600, color: 'white', lineHeight: 1.2, marginBottom: '16px' }}>
            {lang === 'fr' ? 'Questions fréquentes' : 'Frequently asked questions'}
          </h1>
          <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>
            {lang === 'fr'
              ? 'Tout ce que vous devez savoir sur Nautilus, le score de conviction et notre fonctionnement.'
              : 'Everything you need to know about Nautilus, the Conviction Score, and how we work.'}
          </p>
        </div>
      </div>

      {/* FAQ content */}
      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '60px 40px 80px' }}>
        {sections.map((section, si) => (
          <div key={`${lang}-${si}`} style={{ marginBottom: '48px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{ width: '4px', height: '20px', background: '#C6A85A', borderRadius: '2px', flexShrink: 0 }} />
              <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: 'var(--navy)', letterSpacing: '0.16em', textTransform: 'uppercase', margin: 0 }}>
                {section.category}
              </h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {section.questions.map((item, qi) => {
                const key = `${lang}-${si}-${qi}`;
                const isOpen = !!open[key];
                return (
                  <div key={key} style={{ background: 'white', border: `1px solid ${isOpen ? 'var(--navy)' : 'var(--border)'}`, borderRadius: '8px', overflow: 'hidden', transition: 'border-color 0.2s' }}>
                    <button
                      onClick={() => toggle(key)}
                      style={{ width: '100%', textAlign: 'left', padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}
                    >
                      <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', lineHeight: 1.4 }}>{item.q}</span>
                      <span style={{ fontSize: '18px', color: isOpen ? 'var(--navy)' : 'var(--text-3)', flexShrink: 0, transform: isOpen ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s', lineHeight: 1 }}>+</span>
                    </button>
                    {isOpen && (
                      <div style={{ padding: '0 20px 16px', fontSize: '14px', color: 'var(--text-2)', lineHeight: 1.8, borderTop: '1px solid var(--border-light)' }}>
                        {item.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Footer CTA */}
        <div style={{ marginTop: '16px', background: 'var(--navy)', borderRadius: '12px', padding: '40px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', color: 'white', marginBottom: '10px' }}>
            {lang === 'fr' ? 'Une autre question ?' : 'Still have questions?'}
          </div>
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', marginBottom: '24px' }}>
            {lang === 'fr' ? 'Notre équipe répond sous 24h.' : 'Our team responds within 24 hours.'}
          </p>
          <a
            href="mailto:contact@get-nautilus.com"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.1)', color: 'white', padding: '11px 28px', borderRadius: '6px', textDecoration: 'none', fontSize: '13px', fontWeight: 600, border: '1px solid rgba(255,255,255,0.2)' }}
          >
            {lang === 'fr' ? 'Nous contacter →' : 'Contact us →'}
          </a>
        </div>
      </div>

      <footer style={{ padding: '32px 40px', textAlign: 'center', background: 'var(--bg-subtle)', borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: '12px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
          © 2026 Nautilus · <Link to="/legal/privacy" style={{ color: 'var(--text-3)', textDecoration: 'none' }}>Privacy</Link> · <Link to="/legal/terms" style={{ color: 'var(--text-3)', textDecoration: 'none' }}>Terms</Link>
        </div>
      </footer>
    </div>
  );
}

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
          a: "Nautilus est une plateforme d'intelligence de marché pour les collectionneurs et investisseurs en art. Nous agrégeons en continu les données de plusieurs dizaines de milliers de lots aux enchères et sur le marché primaire, puis nous scorons chaque lot de 0 à 100 selon l'écart de prix par rapport aux ventes comparables, la dynamique de l'artiste et les signaux de demande du marché. L'objectif : vous donner un avantage d'information systématique pour acheter au bon prix.",
        },
        {
          q: "À qui s'adresse Nautilus ?",
          a: "Nautilus s'adresse à toute personne qui approche l'art avec une logique d'investissement : collectionneurs individuels avec des budgets de 500 € à plusieurs millions d'euros, family offices allouant des capitaux aux actifs alternatifs, gestionnaires de patrimoine accompagnant des clients avec des positions en art, ou simplement passionnés souhaitant mieux comprendre la valeur réelle de ce qu'ils achètent.",
        },
        {
          q: "Nautilus constitue-t-il un conseil financier ?",
          a: "Non. Nautilus fournit de l'intelligence de marché et de l'analyse de données — pas des conseils financiers ou d'investissement. Nos scores et analyses sont des outils informationnels pour soutenir votre propre recherche et prise de décision. L'investissement en art comporte des risques, et les performances passées ne garantissent pas les résultats futurs.",
        },
        {
          q: "Nautilus est-il disponible en français ?",
          a: "Oui. L'interface est entièrement disponible en français et en anglais. Vous pouvez changer de langue à tout moment via le sélecteur en haut à droite de la plateforme.",
        },
        {
          q: "En quoi Nautilus est-il différent d'une simple recherche en ligne ?",
          a: "Une recherche en ligne vous donne des informations dispersées, sans mise en perspective ni signal d'achat. Nautilus agrège, normalise et score des dizaines de milliers de lots simultanément, calcule automatiquement l'écart par rapport aux ventes comparables, et vous présente uniquement les opportunités les plus pertinentes selon votre profil — en quelques secondes plutôt qu'en plusieurs heures.",
        },
      ],
    },
    {
      category: "L'essai gratuit · Démarrer",
      questions: [
        {
          q: "Comment démarrer sur Nautilus ?",
          a: "Cliquez sur « Commencer gratuitement » depuis la page d'accueil ou la page Tarifs. L'inscription prend moins d'une minute — avec votre email ou via Google. Aucune carte bancaire n'est demandée pour démarrer.",
        },
        {
          q: "En quoi consiste l'essai gratuit de 7 jours ?",
          a: "Dès votre inscription, vous bénéficiez automatiquement de 7 jours complets sur le plan Investor — sans engagement ni carte bancaire. Vous avez accès à l'intégralité des fonctionnalités : flux complet de lots, scores de conviction, alertes, analyse d'artistes, Larry votre analyste IA, portefeuille et mémos d'investissement. À l'issue des 7 jours, vous choisissez librement de souscrire à un plan payant ou de continuer sur le plan Explorer (gratuit) avec des fonctionnalités réduites.",
        },
        {
          q: "Faut-il une carte bancaire pour s'inscrire ?",
          a: "Non. L'inscription et l'essai gratuit de 7 jours ne nécessitent aucune carte bancaire. Vous ne serez jamais débité sans avoir explicitement choisi un abonnement payant et renseigné vos informations de paiement.",
        },
        {
          q: "Que se passe-t-il à la fin des 7 jours d'essai ?",
          a: "À la fin de votre essai, votre compte passe automatiquement sur le plan Explorer (gratuit). Il n'y a aucun prélèvement automatique. Vous pouvez continuer à utiliser Nautilus avec 6 lots scorés par jour, ou choisir de souscrire au plan Investor pour conserver l'accès complet.",
        },
        {
          q: "Puis-je inviter des proches à essayer Nautilus ?",
          a: "Oui. Vous pouvez partager librement le lien d'inscription. Chaque nouvel utilisateur bénéficie du même essai gratuit de 7 jours sur le plan Investor, sans carte bancaire.",
        },
      ],
    },
    {
      category: 'La plateforme · Fonctionnalités',
      questions: [
        {
          q: "Comment est organisée la plateforme ?",
          a: "La plateforme est organisée autour de plusieurs espaces accessibles depuis le menu latéral : Aujourd'hui (votre briefing quotidien personnalisé), Marché (l'ensemble des lots analysés), Artistes (l'intelligence marché par artiste), Ventes urgentes (les lots qui ferment dans les 24–48 heures), Portefeuille (le suivi de vos acquisitions), Alertes (la configuration de vos notifications) et Agent (le chat direct avec Larry).",
        },
        {
          q: "Qu'est-ce que la page Aujourd'hui ?",
          a: "La page Aujourd'hui est votre tableau de bord quotidien personnalisé. Larry y sélectionne chaque jour les lots les plus pertinents selon votre profil, vous alerte sur les ventes qui ferment dans les 24 à 48 heures, et affiche les nouveaux signaux détectés depuis la veille. C'est le point de départ recommandé à chaque connexion.",
        },
        {
          q: "Qu'est-ce que Larry ?",
          a: "Larry est votre analyste IA personnel intégré à Nautilus. Il surveille le marché en continu, sélectionne chaque jour les opportunités les plus pertinentes pour votre profil, et répond à toutes vos questions en langage naturel — pour analyser un lot précis, comprendre la dynamique d'un artiste, ou évaluer si une œuvre vaut son prix. Larry est accessible depuis la page Aujourd'hui ou via l'onglet Agent.",
        },
        {
          q: "Comment fonctionnent les Convictions ?",
          a: "Les Convictions sont les recommandations à plus forte conviction de Larry pour votre profil spécifique. Chaque conviction affiche l'œuvre, l'artiste, la maison de vente, le score de 0 à 100, la décote par rapport à l'estimation basse, les signaux de personnalisation (artiste suivi, votre catégorie, dans votre budget) et la recommandation de Larry en quelques mots. Un score supérieur à 65 indique une sous-évaluation significative par rapport aux ventes comparables.",
        },
        {
          q: "Qu'est-ce que la section Ventes urgentes ?",
          a: "La section Ventes urgentes regroupe tous les lots dont la clôture est imminente (moins de 24 à 48 heures). Ils sont classés par temps restant, avec un indicateur d'urgence. C'est la section à consulter en priorité pour ne manquer aucune fenêtre d'achat.",
        },
        {
          q: "Comment fonctionne la section Artistes ?",
          a: "La section Artistes vous permet d'accéder à la fiche de tout artiste présent dans notre base : résultats récents aux enchères, dynamique de marché, lots actuellement disponibles et évolution des prix. Vous pouvez suivre un artiste pour recevoir des alertes dès qu'un nouveau lot apparaît.",
        },
        {
          q: "Qu'est-ce que Collection Match ?",
          a: "Collection Match analyse votre profil de collectionneur (catégories préférées, artistes suivis, budget, historique) et identifie les lots du moment qui correspondent le mieux à votre collection ou à vos préférences déclarées. C'est un moteur de recommandation personnalisée, distinct du classement par score global.",
        },
        {
          q: "Qu'est-ce que le Mémo d'investissement ?",
          a: "Le Mémo d'investissement est un document généré automatiquement pour chaque lot, résumant le cas d'investissement : score de conviction, comparables de marché, profil de l'artiste, signaux d'achat et recommandation de prix. Il est disponible pour les membres Investor et Pro.",
        },
      ],
    },
    {
      category: 'Le score de conviction',
      questions: [
        {
          q: "Comment fonctionne le score de 0 à 100 ?",
          a: "Le score de conviction évalue la qualité de chaque opportunité selon plusieurs dimensions : l'écart entre le prix actuel et les ventes comparables récentes (composante principale), la dynamique de marché de l'artiste (résultats récents, tendance), les caractéristiques du lot (technique, dimensions) et les signaux de timing (temps avant clôture, ventes en cours). Un score supérieur à 65 signale une sous-évaluation notable. Au-dessus de 80, l'opportunité est considérée comme exceptionnelle.",
        },
        {
          q: "Qu'est-ce que le pourcentage de décote affiché ?",
          a: "Le pourcentage de décote indique l'écart entre le prix actuel estimé (ou l'estimation basse de la maison de vente) et ce que le marché a payé pour des œuvres comparables récemment. Une décote de 20 % signifie que l'œuvre est estimée 20 % en dessous de ce que le marché paie habituellement pour des pièces équivalentes.",
        },
        {
          q: "Qu'est-ce que le Max Bid ?",
          a: "Le Max Bid est le prix maximum recommandé par notre modèle pour un lot donné, frais acheteur inclus. Il est calculé à partir des ventes comparables sur 24 mois, de la rareté relative de l'œuvre et du potentiel d'appréciation estimé. C'est le seuil au-delà duquel le risque de surpayer devient significatif.",
        },
        {
          q: "Pourquoi certains lots scorent-ils 85/100 et d'autres 40/100 ?",
          a: "Un score élevé requiert deux conditions simultanées : une décote significative par rapport aux comparables ET de solides fondamentaux d'artiste. Un lot peut être moins cher que son estimation et scorer faiblement si l'artiste a une faible liquidité de marché. Inversement, un artiste très coté avec un lot bien pricé peut scorer moyen. L'écart de prix seul ne suffit pas — la qualité sous-jacente entre en compte.",
        },
        {
          q: "Quelle est la fiabilité du score ?",
          a: "Nos signaux sont calculés à partir de ventes réelles aux enchères. Le score mesure la probabilité qu'un lot soit sous-évalué par rapport au marché actuel — il ne garantit pas un résultat futur. Les performances passées ne préjugent pas des performances futures. Nautilus est un outil d'aide à la décision, pas un oracle.",
        },
      ],
    },
    {
      category: 'Plans & Tarifs',
      questions: [
        {
          q: "Quels sont les plans disponibles ?",
          a: "Nautilus propose trois niveaux d'accès. Le plan Explorer (gratuit) : 6 lots scorés par jour, score et décote visibles, sans alertes ni analyste IA. Le plan Investor (€10/mois ou €8/mois en annuel) : accès illimité, source de vente révélée, liens enchères directs, alertes temps réel, Larry analyste IA, mémos d'investissement, suivi de portefeuille. Le plan Pro : pour les investisseurs avec des besoins avancés, analyste IA illimité, stratégies illimitées et support prioritaire. Pour les institutions, nous proposons des configurations sur mesure.",
        },
        {
          q: "Combien coûte le plan Investor ?",
          a: "Le plan Investor est à €10/mois en facturation mensuelle, ou €96/an (soit €8/mois) en facturation annuelle — une économie de €24 par an. Il s'agit d'un prix fondateur verrouillé à vie pour les premiers membres, limité à 100 places.",
        },
        {
          q: "L'essai est-il vraiment gratuit, sans carte bancaire ?",
          a: "Oui, entièrement. Les 7 premiers jours sur le plan Investor sont offerts à l'inscription, sans carte bancaire, sans engagement. Aucun prélèvement n'est effectué sans votre accord explicite.",
        },
        {
          q: "Puis-je changer de plan à tout moment ?",
          a: "Oui. Les upgrades prennent effet immédiatement. Pour les plans annuels, les downgrades prennent effet à la fin de la période de facturation en cours — vous conservez votre accès actuel jusqu'à cette date.",
        },
        {
          q: "La facturation est-elle mensuelle ou annuelle ?",
          a: "Les deux options sont disponibles pour le plan Investor. Mensuel : €10/mois. Annuel : €96/an (€8/mois), avec une économie de €24 par an. Vous pouvez basculer entre les deux depuis votre profil.",
        },
        {
          q: "Proposez-vous des tarifs pour les institutions ?",
          a: "Oui. Pour les fonds d'art, family offices et gestionnaires de patrimoine, contactez-nous à contact@get-nautilus.com pour un accompagnement personnalisé et des conditions adaptées à votre volume.",
        },
      ],
    },
    {
      category: 'Données & Couverture',
      questions: [
        {
          q: "Combien de lots Nautilus analyse-t-il ?",
          a: "Nautilus analyse en continu plusieurs dizaines de milliers de lots actifs, avec de nouveaux lots ingérés chaque jour dès leur publication. Notre pipeline fonctionne 24h/24 et reflète les données les plus récentes disponibles.",
        },
        {
          q: "Quelles ventes Nautilus couvre-t-il ?",
          a: "Nous couvrons les grandes maisons de vente aux enchères internationales et régionales, ainsi que des plateformes de marché primaire sélectionnées. Nous agrégeons régulièrement de nouvelles sources pour étendre la couverture géographique et sectorielle. Le détail des sources n'est pas communiqué publiquement.",
        },
        {
          q: "À quelle fréquence les données sont-elles mises à jour ?",
          a: "Les nouveaux lots sont ingérés dès leur publication. Les scores sont recalculés régulièrement pour tous les lots actifs. Les résultats de vente (lots adjugés) sont intégrés dans les heures suivant la clôture.",
        },
        {
          q: "Jusqu'où remontent les données historiques ?",
          a: "Notre base couvre principalement les 24 derniers mois de résultats d'enchères pour les marchés actifs. Ces données historiques servent à calculer les prix comparables et à détecter les anomalies de valorisation.",
        },
      ],
    },
    {
      category: 'Alertes & Notifications',
      questions: [
        {
          q: "Comment fonctionnent les alertes ?",
          a: "Nautilus vous envoie une notification par email dès qu'un lot correspondant à vos critères est détecté — budget, artistes suivis, score minimum, catégories préférées. Vous configurez vos préférences depuis la page Alertes.",
        },
        {
          q: "Puis-je recevoir des alertes sur des artistes spécifiques ?",
          a: "Oui. Depuis la section Artistes, vous pouvez suivre n'importe quel artiste de notre base. Nautilus vous alertera à chaque nouveau lot de cet artiste, indépendamment de son score.",
        },
        {
          q: "Puis-je définir un score minimum pour les alertes ?",
          a: "Oui. Vous pouvez configurer un seuil de score minimum depuis vos préférences d'alerte (par exemple, être alerté uniquement pour les lots scorés 65 et plus). Cela vous permet de filtrer le bruit et de ne recevoir que les signaux les plus pertinents.",
        },
        {
          q: "Les alertes sont-elles disponibles sur tous les plans ?",
          a: "Les alertes en temps réel (score ≥ 70) sont disponibles à partir du plan Investor. Le plan Explorer (gratuit) ne donne pas accès aux alertes. Sur le plan Pro, les alertes démarrent dès le score 60.",
        },
      ],
    },
    {
      category: 'Portefeuille & Suivi',
      questions: [
        {
          q: "À quoi sert le module portefeuille ?",
          a: "Le portefeuille vous permet de consigner vos acquisitions et de suivre leur valeur estimée dans le temps, sur la base des ventes comparables récentes. Pour chaque œuvre enregistrée, Nautilus calcule une estimation de valeur actuelle et un retour estimé depuis l'achat.",
        },
        {
          q: "Puis-je ajouter des œuvres que je n'ai pas achetées via Nautilus ?",
          a: "Oui. Vous pouvez ajouter manuellement n'importe quelle acquisition — peu importe comment vous l'avez achetée. Il suffit de renseigner l'artiste, le titre, le prix d'achat et la date d'acquisition.",
        },
      ],
    },
    {
      category: 'Compte & Sécurité',
      questions: [
        {
          q: "Comment créer un compte ?",
          a: "Cliquez sur « Commencer gratuitement » depuis n'importe quelle page du site. L'inscription se fait en moins d'une minute avec votre email ou via Google. Aucune carte bancaire n'est demandée.",
        },
        {
          q: "Comment réinitialiser mon mot de passe ?",
          a: "Depuis la page de connexion, cliquez sur « Mot de passe oublié ». Vous recevrez un lien de réinitialisation par email dans les minutes suivantes.",
        },
        {
          q: "Mes données sont-elles sécurisées ?",
          a: "Oui. Nautilus utilise le chiffrement SSL/TLS pour toutes les communications. Vos données personnelles ne sont jamais vendues ni partagées avec des tiers à des fins commerciales. Nous sommes conformes au RGPD.",
        },
        {
          q: "Comment résilier mon abonnement ?",
          a: "Vous pouvez résilier à tout moment depuis votre profil > Abonnement > Annuler. Vous conservez l'accès complet jusqu'à la fin de votre période de facturation en cours. Aucun frais supplémentaire ne sera prélevé.",
        },
        {
          q: "Comment contacter le support ?",
          a: "Par email à contact@get-nautilus.com. Notre équipe répond sous 24 heures ouvrées. Les membres Pro bénéficient d'un accès support prioritaire.",
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
          a: "Nautilus is a market intelligence platform for art collectors and investors. We continuously aggregate data from tens of thousands of auction lots and primary market listings, then score every lot from 0 to 100 based on price vs comparable sales, artist momentum, and market demand signals. The goal: give you a systematic information edge to buy at the right price.",
        },
        {
          q: 'Who is Nautilus for?',
          a: "Nautilus is built for anyone who approaches art with an investment mindset: individual collectors with budgets from €500 to several million euros, family offices allocating capital to alternative assets, wealth managers advising clients with art holdings, and passionate collectors who simply want to understand the real value of what they buy.",
        },
        {
          q: 'Is Nautilus financial advice?',
          a: "No. Nautilus provides market intelligence and data analysis — not financial or investment advice. Our scores and analyses are informational tools to support your own research and decision-making. Art investment carries risk, and past performance does not guarantee future results.",
        },
        {
          q: 'Is Nautilus available in French?',
          a: "Yes. The platform is fully available in both English and French. You can switch languages at any time using the selector in the top right of the platform.",
        },
        {
          q: 'How is Nautilus different from a manual search?',
          a: "A manual search gives you scattered information with no context or buy signal. Nautilus aggregates, normalises, and scores tens of thousands of lots simultaneously, automatically calculates the gap vs comparable sales, and surfaces only the most relevant opportunities for your profile — in seconds rather than hours.",
        },
      ],
    },
    {
      category: 'Free Trial · Getting Started',
      questions: [
        {
          q: 'How do I get started on Nautilus?',
          a: "Click \"Get started for free\" from the homepage or the Pricing page. Sign up in under a minute with your email or via Google. No credit card required to start.",
        },
        {
          q: 'What does the 7-day free trial include?',
          a: "From the moment you sign up, you automatically get 7 full days on the Investor plan — no commitment, no credit card. You have access to all features: complete lot feed, conviction scores, real-time alerts, artist analytics, Larry your AI analyst, portfolio tracking, and Investment Memos. After 7 days, you freely choose to subscribe to a paid plan or continue on the Explorer plan (free) with reduced features.",
        },
        {
          q: 'Do I need a credit card to sign up?',
          a: "No. Registration and the 7-day free trial require no credit card. You will never be charged without having explicitly chosen a paid subscription and entered your payment details.",
        },
        {
          q: 'What happens after the 7-day trial?',
          a: "At the end of your trial, your account automatically moves to the Explorer plan (free). There is no automatic charge. You can continue using Nautilus with 6 scored lots per day, or choose to subscribe to the Investor plan to keep full access.",
        },
        {
          q: 'Can I invite others to try Nautilus?',
          a: "Yes. You can freely share the sign-up link. Every new user gets the same free 7-day trial on the Investor plan, with no credit card required.",
        },
      ],
    },
    {
      category: 'The Platform · Features',
      questions: [
        {
          q: 'How is the platform organised?',
          a: "The platform is organised around several spaces accessible from the side menu: Today (your personalised daily briefing), Market (all analysed lots), Artists (market intelligence by artist), Urgent Sales (lots closing in 24–48 hours), Portfolio (track your acquisitions), Alerts (configure your notifications), and Agent (direct chat with Larry).",
        },
        {
          q: "What is the Today page?",
          a: "The Today page is your personalised daily dashboard. Larry selects each day the lots most relevant to your profile, alerts you to sales closing within 24 to 48 hours, and displays new signals detected since the day before. It's the recommended starting point every time you log in.",
        },
        {
          q: 'What is Larry?',
          a: "Larry is your personal AI analyst built into Nautilus. He monitors the market continuously, selects the most relevant opportunities for your profile each day, and answers any question in natural language — to analyse a specific lot, understand an artist's momentum, or assess whether a work is fairly priced. Larry is accessible from the Today page or via the Agent tab.",
        },
        {
          q: 'How do Convictions work?',
          a: "Convictions are Larry's highest-conviction recommendations for your specific profile. Each conviction shows the artwork, artist, auction house, conviction score from 0 to 100, discount vs low estimate, personalisation signals (tracked artist, your category, within your budget), and Larry's recommendation in a few words. A score above 65 signals meaningful undervaluation vs comparable sales.",
        },
        {
          q: 'What is the Urgent Sales section?',
          a: "The Urgent Sales section groups all lots closing imminently — within the next 24 to 48 hours. They are ranked by time remaining, with an urgency indicator. This is the section to check first to avoid missing any buying window.",
        },
        {
          q: 'How does the Artists section work?',
          a: "The Artists section gives you access to the profile of any artist in our database: recent auction results, market momentum, currently available lots, and price evolution. You can follow an artist to receive alerts whenever a new lot appears.",
        },
        {
          q: 'What is Collection Match?',
          a: "Collection Match analyses your collector profile (preferred categories, followed artists, budget, history) and identifies current lots that best match your existing collection or declared preferences. It is a personalised recommendation engine, distinct from the global score ranking.",
        },
        {
          q: 'What is the Investment Memo?',
          a: "The Investment Memo is a document automatically generated for each lot, summarising the investment case: conviction score, market comparables, artist profile, buy signals, and price recommendation. It is available to Investor and Pro members.",
        },
      ],
    },
    {
      category: 'The Conviction Score',
      questions: [
        {
          q: 'How does the 0–100 score work?',
          a: "The conviction score evaluates the quality of each opportunity across several dimensions: the gap between the current price and recent comparable sales (main component), artist market momentum (recent results, trend), lot characteristics (medium, dimensions), and timing signals (time to close, live auctions). A score above 65 flags notable undervaluation. Above 80, the opportunity is considered exceptional.",
        },
        {
          q: 'What does the discount percentage shown mean?',
          a: "The discount percentage shows the gap between the current estimated price (or the auction house's low estimate) and what the market has recently paid for comparable works. A 20% discount means the work is estimated 20% below what the market typically pays for equivalent pieces.",
        },
        {
          q: "What is the Max Bid?",
          a: "The Max Bid is the maximum price our model recommends paying for a given lot, including buyer's premium. It is calculated from comparable sales over 24 months, the relative rarity of the work, and estimated appreciation potential. It is the threshold beyond which the risk of overpaying becomes significant.",
        },
        {
          q: 'Why do some lots score 85/100 while others score 40/100?',
          a: "A high score requires two simultaneous conditions: a significant discount vs comparables AND strong underlying artist fundamentals. A lot can be cheaper than its estimate and still score low if the artist has poor market liquidity. Conversely, a highly regarded artist with a fairly priced lot may score moderately. The price gap alone is not enough — the underlying quality matters.",
        },
        {
          q: 'How reliable is the score?',
          a: "Our signals are calculated from real auction sales. The score measures the probability that a lot is undervalued relative to the current market — it does not guarantee a future outcome. Past performance does not predict future results. Nautilus is a decision support tool, not an oracle.",
        },
      ],
    },
    {
      category: 'Plans & Pricing',
      questions: [
        {
          q: 'What plans are available?',
          a: "Nautilus offers three tiers. Explorer (free): 6 scored lots per day, score and discount visible, no alerts or AI analyst. Investor (€10/month or €8/month annually): unlimited access, auction source revealed, direct bidding links, real-time alerts, Larry AI analyst, Investment Memos, portfolio tracking. Pro: for advanced investors — unlimited AI analyst, unlimited strategies, priority support. For institutions, we offer custom configurations.",
        },
        {
          q: 'How much does the Investor plan cost?',
          a: "The Investor plan is €10/month on a monthly basis, or €96/year (€8/month) on an annual basis — saving €24 per year. This is a founding member price, locked in for life, limited to 100 spots.",
        },
        {
          q: 'Is the trial really free — no credit card?',
          a: "Yes, entirely. The first 7 days on the Investor plan are free at sign-up, no credit card, no commitment. No charge is ever made without your explicit consent.",
        },
        {
          q: 'Can I change plans at any time?',
          a: "Yes. Upgrades take effect immediately. For annual plans, downgrades take effect at the end of the current billing period — you keep your current access until that date.",
        },
        {
          q: 'Is billing monthly or annual?',
          a: "Both options are available for the Investor plan. Monthly: €10/month. Annual: €96/year (€8/month), saving €24 per year. You can switch between the two from your profile.",
        },
        {
          q: 'Do you offer institutional pricing?',
          a: "Yes. For art funds, family offices, and wealth managers, contact us at contact@get-nautilus.com for tailored pricing and conditions suited to your volume.",
        },
      ],
    },
    {
      category: 'Data & Coverage',
      questions: [
        {
          q: 'How many lots does Nautilus analyse?',
          a: "Nautilus continuously analyses tens of thousands of active lots, with new lots ingested every day as soon as they are published. Our pipeline runs 24/7 and reflects the most current data available.",
        },
        {
          q: 'Which sales does Nautilus cover?',
          a: "We cover major international and regional auction houses, as well as selected primary market platforms. We regularly add new sources to extend geographic and sector coverage. The specific list of sources is not publicly disclosed.",
        },
        {
          q: 'How often is data updated?',
          a: "New lots are ingested as soon as they are published. Scores are recalculated regularly for all active lots. Sale results (sold lots) are integrated within hours of closing.",
        },
        {
          q: 'How far back does the historical data go?',
          a: "Our database covers primarily the last 24 months of auction results for active markets. This historical data is used to calculate comparable prices and detect valuation anomalies.",
        },
      ],
    },
    {
      category: 'Alerts & Notifications',
      questions: [
        {
          q: 'How do alerts work?',
          a: "Nautilus sends you an email notification as soon as a lot matching your criteria is detected — budget, followed artists, minimum score, preferred categories. You configure your preferences from the Alerts page.",
        },
        {
          q: 'Can I receive alerts for specific artists?',
          a: "Yes. From the Artists section, you can follow any artist in our database. Nautilus will alert you for every new lot by that artist, regardless of their score.",
        },
        {
          q: 'Can I set a minimum score for alerts?',
          a: "Yes. You can configure a minimum score threshold from your alert preferences (for example, only be alerted for lots scoring 65 and above). This filters out the noise and ensures you only receive the most relevant signals.",
        },
        {
          q: 'Are alerts available on all plans?',
          a: "Real-time alerts (score ≥ 70) are available from the Investor plan onwards. The Explorer (free) plan does not include alerts. On the Pro plan, alerts start from score 60.",
        },
      ],
    },
    {
      category: 'Portfolio & Tracking',
      questions: [
        {
          q: 'What does the portfolio module do?',
          a: "The portfolio lets you record your acquisitions and track their estimated value over time, based on recent comparable sales. For each registered work, Nautilus calculates a current estimated value and an estimated return since purchase.",
        },
        {
          q: "Can I add works I didn't buy through Nautilus?",
          a: "Yes. You can manually add any acquisition — regardless of how you bought it. Simply enter the artist, title, purchase price, and acquisition date.",
        },
      ],
    },
    {
      category: 'Account & Security',
      questions: [
        {
          q: 'How do I create an account?',
          a: "Click \"Get started for free\" from any page on the site. Sign up in under a minute with your email or via Google. No credit card required.",
        },
        {
          q: 'How do I reset my password?',
          a: "From the login page, click \"Forgot password\". You will receive a reset link by email within a few minutes.",
        },
        {
          q: 'Is my data secure?',
          a: "Yes. Nautilus uses SSL/TLS encryption for all communications. Your personal data is never sold or shared with third parties for commercial purposes. We are GDPR compliant.",
        },
        {
          q: 'How do I cancel my subscription?',
          a: "You can cancel at any time from your profile > Subscription > Cancel. You retain full access until the end of your current billing period. No further charges will be made.",
        },
        {
          q: 'How do I contact support?',
          a: "By email at contact@get-nautilus.com. Our team responds within 24 business hours. Pro members benefit from priority support access.",
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

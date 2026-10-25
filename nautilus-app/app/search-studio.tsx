'use client';
import { useEffect, useRef, useState } from 'react';
import { CATEGORIES, type Preferences, type Project } from '../lib/product';
import { STYLES, freshSearch, validSearch, searchSummary, searchQuery, searchQuestions, candidateFromSearch, type SavedSearch, type SearchBrief, type OfferInterest } from '../lib/searches';
type MutationResult = {
    searches?: SavedSearch[];
};
function exportText(text: string, name: string) { const u = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' })); const a = document.createElement('a'); a.href = u; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(u), 1000); }
export function SearchStudio({ member, signedIn, signIn, preferences, searches, onSubmit, onActivate, onCandidate, onOffers }: {
    member: boolean;
    signedIn: boolean;
    signIn: string;
    preferences: Preferences;
    searches: SavedSearch[];
    onSubmit: (body: unknown) => Promise<MutationResult | null>;
    onActivate: () => void;
    onCandidate: (p: Project) => void;
    onOffers: () => void;
}) {
    const [brief, setBrief] = useState<SearchBrief>(() => freshSearch(preferences));
    const [active, setActive] = useState('');
    const [version, setVersion] = useState(0);
    const [dirty, setDirty] = useState(false);
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState('');
    const [remove, setRemove] = useState(false);
    const initialized = useRef(false);
    useEffect(() => { if (initialized.current)
        return; initialized.current = true; try {
        const p = JSON.parse(sessionStorage.getItem('nautilus.search.draft') || 'null');
        if (validSearch(p)) {
            setBrief(p);
            setDirty(true);
        }
    }
    catch { } }, []);
    useEffect(() => { if (member && !dirty && !active && !brief.title)
        setBrief(freshSearch(preferences)); }, [preferences, member]);
    useEffect(() => { if (!dirty)
        return; const guard = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; }; window.addEventListener('beforeunload', guard); return () => window.removeEventListener('beforeunload', guard); }, [dirty]);
    function edit(p: Partial<SearchBrief>) { const b = { ...brief, ...p }; setBrief(b); setDirty(true); setNotice(''); try {
        sessionStorage.setItem('nautilus.search.draft', JSON.stringify(b));
    }
    catch { } }
    function choose(s: SavedSearch) { if (dirty) {
        setNotice('Enregistrez ou annulez vos modifications avant de changer de recherche.');
        return;
    } setActive(s.id); setVersion(s.version); setBrief(s); setRemove(false); setNotice(''); }
    function fresh() { if (dirty) {
        setNotice('Enregistrez ou annulez vos modifications avant de commencer une autre recherche.');
        return;
    } setBrief(freshSearch(preferences)); setActive(''); setVersion(0); setRemove(false); setNotice(''); }
    async function save() { if (!validSearch(brief)) {
        setNotice('Donnez un nom à votre recherche et indiquez un budget total positif.');
        return;
    } setBusy(true); const result = await onSubmit({ action: active ? 'updateSearch' : 'createSearch', id: active, version, search: brief }); setBusy(false); if (result) {
        const s = active ? result.searches?.find(s => s.id === active) : result.searches?.[0];
        if (s) {
            setActive(s.id);
            setVersion(s.version);
            setBrief(s);
        }
        setDirty(false);
        try {
            sessionStorage.removeItem('nautilus.search.draft');
        }
        catch { }
        setNotice('Recherche enregistrée. Aucune collecte, prestation ou alerte n’est lancée.');
    } }
    return <section className="section"><div className="section-title"><div><p className="eyebrow">UNE ENVIE PRÉCISE, UNE RECHERCHE PLUS JUSTE</p><h1 className="page-heading">Qu’aimeriez-vous trouver ?</h1><p className="lead">Un fauteuil pour votre salon, une première estampe, un objet singulier. Précisez ce qui compte vraiment pour vous.</p></div>{member && <button className="outline" onClick={fresh}>+ Nouvelle recherche</button>}</div><div className="notice search-notice"><strong>Votre feuille de route, dès maintenant.</strong><p>Ce brief prépare vos recherches. Nautilus ne recherche pas encore de lots à votre place et n’envoie aucune alerte. Vos critères serviront de base à une future sélection, si des sources autorisées sont disponibles.</p></div>{notice && <p className="global-message" role="status">{notice}</p>}<div className={member ? 'workspace-grid search-layout' : 'search-single search-layout'}>{member && <aside className="project-list" aria-label="Recherches enregistrées">{searches.map(s => <button key={s.id} className={active === s.id ? 'project-card selected' : 'project-card'} onClick={() => choose(s)}><span className="eyebrow">{s.category}</span><strong>{s.title}</strong><span>{s.budget.toLocaleString('fr-FR')} € tout compris · {s.status === 'active' ? 'En cours' : s.status === 'pause' ? 'En pause' : 'Terminée'}</span></button>)}{!searches.length && <p className="fine">Vos recherches enregistrées apparaîtront ici. Vous pouvez en conserver jusqu’à 10.</p>}</aside>}<div className="search-content"><section className="project-editor"><p className="eyebrow">VOS CRITÈRES PERSONNELS</p><label>Que cherchez-vous ?<input maxLength={120} value={brief.title} placeholder="Ex. Une paire de fauteuils en bois clair" onChange={e => edit({ title: e.target.value })}/></label><div className="fields"><label>Univers<select value={brief.category} onChange={e => edit({ category: e.target.value })}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></label><label>Budget total maximum (€)<input type="number" min="1" max="10000000" step="0.01" value={brief.budget} onChange={e => edit({ budget: Number(e.target.value) })}/></label></div><p className="fine">Votre enveloppe inclut les frais et le transport. Elle ne constitue pas une estimation de valeur.</p><h3>Ce qui vous attire.</h3><div className="choices">{STYLES.map(style => <button key={style} aria-pressed={brief.styles.includes(style)} onClick={() => edit({ styles: brief.styles.includes(style) ? brief.styles.filter(s => s !== style) : [...brief.styles, style] })}>{style}</button>)}</div><div className="fields"><label>Ville ou région <span className="muted">· facultatif, sans adresse précise</span><input maxLength={100} value={brief.area} placeholder="Ex. Lyon et sa région" onChange={e => edit({ area: e.target.value })}/></label><label>Récupération de l’objet<select value={brief.transport} onChange={e => edit({ transport: e.target.value as SearchBrief['transport'] })}><option value="flexible">Je suis flexible</option><option value="retrait">Je préfère le retrait sur place</option><option value="livraison">J’ai besoin d’une livraison</option></select></label></div><label>Vos contraintes et ce que vous souhaitez éviter<textarea maxLength={1500} rows={3} value={brief.constraints} placeholder="Dimensions maximales, matière, état, restaurations acceptées…" onChange={e => edit({ constraints: e.target.value })}/></label><label>État de ma recherche<select value={brief.status} onChange={e => edit({ status: e.target.value as SearchBrief['status'] })}><option value="active">En cours</option><option value="pause">En pause</option><option value="terminee">Terminée</option></select></label><p className="fine">Brouillon conservé temporairement dans cet onglet si le navigateur le permet. Les recherches enregistrées sont privées et rattachées à votre compte.</p><div className="actions">{member ? <button className="primary" disabled={busy || !validSearch(brief) || !dirty && !!active} onClick={save}>{busy ? 'Enregistrement…' : 'Enregistrer ma recherche →'}</button> : signedIn ? <button className="primary" onClick={onActivate}>Activer mon espace pour la garder →</button> : <a className="primary" href={signIn} target="_top">Me connecter pour garder ma recherche →</a>}<button className="text-button" onClick={() => { const s = searches.find(s => s.id === active); setBrief(s || freshSearch(preferences)); setDirty(false); setNotice('Modifications annulées.'); try {
        sessionStorage.removeItem('nautilus.search.draft');
    }
    catch { } }}>Annuler les modifications</button></div>{active && (!remove ? <button className="text-button danger" onClick={() => setRemove(true)}>Retirer cette recherche</button> : <div className="warning"><p>Retirer définitivement cette recherche ? Vos projets d’achat resteront dans votre carnet.</p><button disabled={busy} onClick={async () => { setBusy(true); const result = await onSubmit({ action: 'removeSearch', id: active }); setBusy(false); if (result) {
        setActive('');
        setVersion(0);
        setBrief(freshSearch(preferences));
        setDirty(false);
        setRemove(false);
        setNotice('Recherche retirée.');
        try {
            sessionStorage.removeItem('nautilus.search.draft');
        }
        catch { }
    } }}>Confirmer le retrait</button><button onClick={() => setRemove(false)}>Garder la recherche</button></div>)}</section><section className="search-roadmap"><p className="eyebrow">VOTRE FEUILLE DE ROUTE</p><h2>De l’envie au premier objet repéré.</h2><div className="next-step"><span className="eyebrow">MOTS-CLÉS À REPRENDRE DANS VOTRE RECHERCHE</span><strong>{brief.title.trim() ? searchQuery(brief) : 'Décrivez votre objet pour préparer vos mots-clés.'}</strong></div><h3>Les questions utiles pour chaque candidat.</h3><ul className="questions">{searchQuestions(brief).map(q => <li key={q}>{q}</li>)}</ul><div className="actions"><button className="outline" disabled={!validSearch(brief)} onClick={() => exportText(searchSummary(brief), 'nautilus-ma-recherche.txt')}>Télécharger ma feuille de route ↓</button><button className="primary" disabled={!validSearch(brief)} onClick={() => onCandidate(candidateFromSearch(brief))}>J’ai repéré un objet, préparer l’achat →</button></div><p className="fine">Le nouveau projet reprend votre budget et vos critères. Vous renseignerez le lot et son lien officiel. Aucun objet n’a été trouvé automatiquement.</p><div className="notice"><strong>Et si Nautilus cherchait pour vous ?</strong><p>Nous étudions une sélection adaptée aux goûts et contraintes de chacun. Vous pouvez signaler si cette future aide vous intéresserait, sans engagement.</p><button className="text-button" onClick={onOffers}>Découvrir les propositions à l’étude →</button></div></section></div></div></section>;
}
export function OfferStudy({ member, signedIn, signIn, interests, onSubmit, onActivate }: {
    member: boolean;
    signedIn: boolean;
    signIn: string;
    interests: OfferInterest[];
    onSubmit: (body: unknown) => Promise<unknown>;
    onActivate: () => void;
}) {
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState('');
    const offers = [{ id: 'monthly_9' as const, title: 'Le rendez-vous régulier', price: '9 € / mois', body: 'Pour les personnes qui aiment découvrir régulièrement : une sélection pertinente et expliquée selon leurs goûts et leur budget.', detail: 'Hypothèse : une sélection hebdomadaire, avec sources autorisées et coût total à confirmer.' }, { id: 'project_29' as const, title: 'L’aide pour un projet', price: '29 € / projet', body: 'Pour une envie précise : une recherche ciblée et de l’aide pour comparer les candidats et préparer les questions.', detail: 'Périmètre et niveau d’intervention humaine à définir avant toute commercialisation.' }];
    return <section className="section offers-page"><p className="eyebrow">CONSTRUISONS UNE AIDE QUI VAUT VRAIMENT QUELQUE CHOSE</p><h1 className="page-heading">Ce qui vous ferait gagner du temps.</h1><p className="lead">Le carnet reste gratuit pendant la bêta. Ces deux propositions sont à l’étude : elles ne sont ni disponibles à l’achat ni activées par votre choix.</p><div className="notice"><strong>Aucun paiement. Aucun abonnement. Aucun engagement.</strong><p>Votre réponse sert uniquement à évaluer l’intérêt pour ces hypothèses. Elle ne déclenche ni recherche, ni prestation, ni email. Les prix et le périmètre pourront évoluer avant une éventuelle commercialisation.</p></div>{notice && <p role="status" className="global-message">{notice}</p>}<div className="offer-grid">{offers.map(o => { const selected = interests.some(i => i.offer === o.id); return <article className="offer-card" key={o.id}><span className="eyebrow">PROPOSITION À L’ÉTUDE</span><h2>{o.title}</h2><p className="offer-price">{o.price}</p><p>{o.body}</p><p className="fine">{o.detail}</p>{member ? <button className={selected ? 'outline' : 'primary'} disabled={busy} aria-pressed={selected} onClick={async () => { setBusy(true); const result = await onSubmit({ action: 'interest', offer: o.id, interested: !selected }); setBusy(false); if (result)
        setNotice(selected ? 'Votre intérêt a été retiré.' : 'Votre intérêt est enregistré. Il ne s’agit pas d’une souscription et aucun montant ne sera prélevé.'); }}>{selected ? 'Intérêt enregistré · retirer' : 'Cette proposition m’intéresserait'}</button> : signedIn ? <button className="outline" onClick={onActivate}>Créer mon espace pour répondre</button> : <a className="outline" href={signIn} target="_top">Me connecter pour donner mon avis</a>}</article>; })}</div><p className="fine">La collecte de marques d’intérêt ne mesure pas des ventes. Une validation du paiement réel et du coût de fourniture sera nécessaire avant de conclure sur le modèle économique.</p></section>;
}

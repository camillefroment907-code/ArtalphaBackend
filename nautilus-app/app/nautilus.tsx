'use client';
import { useEffect, useState } from 'react';
import { CATEGORIES, CHECKS, defaults, createDraft, totalCost, maxHammer, nextStep, calendarEvent, validProject, type Preferences, type Project, type SavedProject } from '../lib/product';
import { SearchStudio, OfferStudy } from './search-studio';
import type { SavedSearch, OfferInterest } from '../lib/searches';
type State = {
    searches: SavedSearch[];
    offerInterests: OfferInterest[];
    member: boolean;
    preferences: Preferences | null;
    projects: SavedProject[];
};
const empty: State = { searches: [], offerInterests: [], member: false, preferences: null, projects: [] };
const eur = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n);
const statuses = { preparer: 'À préparer', surveiller: 'À surveiller', achete: 'Acheté', renonce: 'Renoncé' };
const guides = [
    { title: 'Le vrai prix d’un coup de cœur', tag: 'BUDGET', body: 'Le prix marteau correspond à votre enchère gagnante. Les frais acheteur, les frais de plateforme et les coûts annexes s’ajoutent. Relevez tous les taux TTC dans les conditions de la vente. S’ils sont progressifs ou si des taxes particulières s’appliquent, demandez un décompte à la maison de ventes.', task: 'Notez le prix marteau, tous les frais proportionnels TTC et les frais fixes dans votre carnet.' },
    { title: 'Les cinq questions avant d’enchérir', tag: 'PREMIÈRE VENTE', body: 'Quel est l’état exact ? Sur quoi repose l’attribution ? Quels sont tous les frais ? Comment récupérer l’objet ? Mon inscription à la vente est-elle validée ? Demandez des réponses écrites. Une information manquante reste une incertitude.', task: 'Cochez une vérification uniquement après l’avoir effectuée.' },
    { title: 'Design : regarder au-delà de la silhouette', tag: 'DESIGN & MOBILIER', body: 'Dimensions, stabilité, restaurations, revêtement et éventuelle signature méritent des photos complémentaires. Un meuble peut être désirable sans être attribué à un grand nom. Une attribution ou une authenticité demande l’avis d’un professionnel compétent.', task: 'Demandez des photos du dessous, des assemblages et des zones restaurées.' },
    { title: 'Art : une attribution n’est pas une certitude', tag: 'ART & ESTAMPES', body: 'Relevez les termes exacts employés dans la notice et les éléments avancés pour la provenance. Pour une estampe, demandez la technique, les dimensions, le tirage, la signature et l’état. Nautilus ne certifie ni une attribution ni l’authenticité.', task: 'Conservez la référence de la notice et notez ce qu’il reste à faire confirmer.' },
    { title: 'Bijoux : le détail qui manque', tag: 'BIJOUX & MONTRES', body: 'Poids, dimensions, métal, poinçons, interventions et documents disponibles sont des informations à demander. Pour une montre, renseignez-vous sur son fonctionnement, son entretien et les pièces remplacées. Une photo ne remplace pas un examen professionnel.', task: 'Distinguez ce qui est documenté de ce qui est seulement indiqué.' },
    { title: 'Après l’adjudication, le projet continue', tag: 'APRÈS LA VENTE', body: 'Gardez le bordereau, les échanges et les documents utiles dans un lieu adapté. Confirmez les modalités de paiement, les délais de retrait, le transport et l’assurance avec la maison. Dans Nautilus, notez l’issue de votre projet pour mieux préparer le suivant.', task: 'Passez votre projet en « Acheté » ou « Renoncé » et notez votre retour d’expérience.' },
];
function download(content: string, name: string, type: string) { const u = URL.createObjectURL(new Blob([content], { type })); const a = document.createElement('a'); a.href = u; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(u), 1000); }
function ObjectArt({ kind = 0 }: {
    kind?: number;
}) { return <svg viewBox="0 0 360 290" aria-hidden="true" className="object-art"><ellipse cx="180" cy="253" rx="110" ry="12" fill="#0b1628" opacity=".07"/>{kind === 0 ? <g fill="none" stroke="#5d4936" strokeWidth="9" strokeLinecap="round"><path d="M110 117L102 247M247 117L260 247M108 174H248"/><path d="M107 117Q178 155 250 117L235 64Q179 27 121 64Z" fill="#b8a58a" strokeWidth="5"/><path d="M109 174Q181 190 248 174L248 151Q179 169 110 151Z" fill="#b8a58a" strokeWidth="5"/><path d="M125 88Q177 115 233 88" stroke="#d5c8b5" strokeWidth="2"/></g> : kind === 1 ? <g><rect x="92" y="30" width="175" height="205" fill="#957442"/><rect x="100" y="38" width="159" height="189" fill="#f2ece0"/><rect x="118" y="56" width="123" height="153" fill="#d1d4cc"/><circle cx="175" cy="107" r="33" fill="#355a9d"/><path d="M119 196L165 139L213 175L240 145V208H119" fill="#a77451"/></g> : <g><path d="M158 54H202V95Q241 128 237 187Q234 235 180 238Q127 235 124 187Q120 128 158 95Z" fill="#9b4f33"/><ellipse cx="180" cy="54" rx="22" ry="7" fill="#593329"/><path d="M148 128Q131 187 155 218" fill="none" stroke="#bc7d5c" strokeWidth="8" strokeLinecap="round"/></g>}</svg>; }
export default function Nautilus({ signedIn, signIn, signOut,offerSignIn }: {
    signedIn: boolean;
    signIn: string;
    signOut: string;
    offerSignIn:string;
}) {
    const [view, setView] = useState('home');
    const [state, setState] = useState<State>(empty);
    const [loaded, setLoaded] = useState(!signedIn);
    const [prefs, setPrefs] = useState<Preferences>(defaults);
    const [draft, setDraft] = useState<Project>({ ...createDraft(), title: 'Mon premier coup de cœur' });
    const [active, setActive] = useState('');
    const [version, setVersion] = useState(0);
    const [dirty, setDirty] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [filter, setFilter] = useState('tous');
    const [article, setArticle] = useState<number | null>(null);
    const [confirmErase, setConfirmErase] = useState(false);
    const [confirmRemove, setConfirmRemove] = useState(false);
    const [eraseText, setEraseText] = useState('');
    const [rating, setRating] = useState(0);
    function resumeView() { if(new URLSearchParams(location.search).get('vue')==='offres')return 'offers'; try {
        return sessionStorage.getItem('nautilus.search.draft') ? 'searches' : 'workspace';
    }
    catch {
        return 'workspace';
    } }
    useEffect(() => {
        try {
            const pending = JSON.parse(sessionStorage.getItem('nautilus.pending.v2') || 'null');
            if (pending?.project && validProject(pending.project)) {
                setDraft(pending.project);
                setDirty(true);
            }
            if (pending?.preferences?.categories?.length)
                setPrefs(pending.preferences);
        }
        catch { }
        if (location.pathname === '/espace')
            setView(resumeView());
        if (signedIn) {
            fetch('/api/state', { cache: 'no-store' }).then(async (r) => {
                const s = await r.json() as State & {
                    error?: string;
                };
                if (!r.ok)
                    throw new Error(s.error);
                setState(s);
                if (s.preferences)
                    setPrefs(s.preferences);
            }).catch(e => setError(e.message || 'Chargement impossible.')).finally(() => setLoaded(true));
        }
    }, [signedIn]);
    useEffect(() => {
        if (!dirty)
            return;
        const guard = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', guard);
        return () => window.removeEventListener('beforeunload', guard);
    }, [dirty]);
    async function mutate(body: unknown) {
        setBusy(true);
        setError('');
        try {
            const r = await fetch('/api/state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            const s = await r.json() as State & {
                error?: string;
            };
            if (!r.ok)
                throw new Error(s.error || 'Enregistrement impossible.');
            setState(s);
            if (s.preferences)
                setPrefs(s.preferences);
            return s as State;
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Enregistrement impossible.');
            return null;
        }
        finally {
            setBusy(false);
        }
    }
    function keepDraft() {
        try {
            sessionStorage.setItem('nautilus.pending.v2', JSON.stringify({ project: draft, preferences: prefs }));
        }
        catch {
            setError('Le stockage temporaire est indisponible. Exportez votre brouillon avant la connexion.');
        }
    }
    function change(p: Partial<Project>) { setDraft(v => ({ ...v, ...p })); setDirty(true); setMessage(''); }
    function open(p: SavedProject) {
        if (dirty) {
            setError('Enregistrez vos modifications avant de changer de projet, ou utilisez « Annuler les modifications ».');
            return;
        }
        setActive(p.id);
        setVersion(p.version);
        setDraft(p);
        setView('workspace');
        setConfirmRemove(false);
        setMessage('');
    }
    function newProject() {
        if (dirty) {
            setError('Enregistrez ou annulez les modifications du projet en cours.');
            return;
        }
        setActive('');
        setVersion(0);
        setDraft(createDraft(prefs));
        setView('workspace');
        setError('');
        setConfirmRemove(false);
    }
    async function saveProject() {
        if (!validProject(draft)) {
            setError('Renseignez un titre, un budget positif et des montants valides. Le lien doit commencer par https://.');
            return;
        }
        const s = await mutate({ action: active ? 'update' : 'create', id: active, version, project: draft });
        if (s) {
            const p = active ? s.projects.find(p => p.id === active) : s.projects[0];
            if (p) {
                setActive(p.id);
                setVersion(p.version);
                setDraft(p);
            }
            setDirty(false);
            try {
                sessionStorage.removeItem('nautilus.pending.v2');
            }
            catch { }
            setMessage('Projet enregistré dans votre espace personnel.');
        }
    }
    async function saveProfile() {
        const s = await mutate({ action: state.member ? 'profile' : 'join', preferences: prefs, acquisition: new URLSearchParams(location.search).get('utm_source') || 'direct' });
        if (s) {
            setView(resumeView());
            if (!active && !dirty)
                setDraft(createDraft(prefs));
            setMessage('Votre espace est prêt. Préparez votre premier projet.');
        }
    }
    const visible = state.projects.filter(p => filter === 'tous' || p.status === filter);
    const relevant = guides.filter(g => !state.member || !prefs.categories.length || !CATEGORIES.includes(g.tag as any) || prefs.categories.some(c => c.toUpperCase() === g.tag));
    const pending = state.projects.filter(p => !['achete', 'renonce'].includes(p.status));
    const upcoming = pending.filter(p => p.saleAt && Date.parse(p.saleAt) > Date.now()).sort((a, b) => Date.parse(a.saleAt) - Date.parse(b.saleAt));
    const go = (v: string) => { setView(v); setArticle(null); setError(''); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    const form = <><div className="editor-head"><div><p className="eyebrow">{active ? 'VOTRE PROJET' : 'NOUVEAU PROJET'}</p><h2>{draft.title || 'Votre prochain coup de cœur'}</h2></div><span className="pill">{active ? 'Enregistré dans votre compte' : 'Brouillon non enregistré'}</span></div><div className="fields"><label>Nom de l’objet<input value={draft.title} maxLength={160} onChange={e => change({ title: e.target.value })} placeholder="Ex. Fauteuil en bois courbé"/></label><label>Univers<select value={draft.category} onChange={e => change({ category: e.target.value })}>{CATEGORIES.map(x => <option key={x}>{x}</option>)}</select></label></div><label>Lien de la fiche officielle <span className="muted">· facultatif, aucune collecte automatique</span><input type="url" value={draft.sourceUrl} maxLength={2000} placeholder="https://…" onChange={e => change({ sourceUrl: e.target.value })}/></label><div className="fields"><label>Date et heure de la vente <span className="muted">· heure de votre appareil</span><input type="datetime-local" value={draft.saleAt ? new Date(Date.parse(draft.saleAt) - new Date(draft.saleAt).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''} onChange={e => { const d = new Date(e.target.value); change({ saleAt: Number.isFinite(d.getTime()) ? d.toISOString() : '' }); }}/></label><label>Votre décision<select value={draft.status} onChange={e => change({ status: e.target.value as Project['status'] })}>{Object.entries(statuses).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label></div><h3>Jusqu’où pouvez-vous aller ?</h3><p className="muted">Le plafond part de votre budget. Il ne mesure pas la valeur de l’objet.</p><div className="fields">{([['budget', 'Votre budget total maximum (€)'], ['hammer', 'Prix marteau envisagé (€)'], ['premium', 'Tous frais proportionnels TTC (%)'], ['fixed', 'Transport et autres frais fixes (€)']] as const).map(([key, label]) => <label key={key}>{label}<input type="number" min="0" max={key === 'premium' ? 100 : 10000000} step="0.01" value={draft[key]} onChange={e => {
                const v = Number(e.target.value);
                if (Number.isFinite(v) && v >= 0 && v <= (key === 'premium' ? 100 : 10000000))
                    change({ [key]: v });
            }}/></label>)}</div><p className="fine">Les montants à zéro ne signifient pas que les frais sont gratuits. Recopiez les taux TTC des conditions de la vente, plateforme comprise, et les frais fixes. Ne rajoutez pas une seconde fois la TVA. Pour des taux progressifs ou des taxes particulières, demandez un devis à la maison.</p><div className="budget-panel"><div><span>Coût total simulé</span><strong>{eur(totalCost(draft))}</strong></div><div><span>Votre plafond marteau</span><strong>{eur(maxHammer(draft))}</strong></div></div>{draft.fixed > draft.budget ? <p className="warning" role="status">Les frais fixes dépassent déjà votre budget. Ce scénario ne permet aucun achat.</p> : totalCost(draft) > draft.budget ? <p className="warning" role="status">Ce scénario dépasse votre budget de {eur(totalCost(draft) - draft.budget)}. Réduisez le prix marteau envisagé ou revoyez votre budget.</p> : <p className="fine">Simulation arithmétique selon vos hypothèses, à confirmer avant toute enchère.</p>}<h3>Les bons réflexes avant la vente.</h3><p className="muted">Cochez uniquement ce que vous avez réellement vérifié. Aucun contrôle d’authenticité n’est effectué par Nautilus.</p>{CHECKS.map((c, i) => <label className="check" key={c}><input type="checkbox" checked={draft.checks[i]} onChange={e => change({ checks: draft.checks.map((v, j) => i === j ? e.target.checked : v) })}/><span>{c}</span></label>)}<label>Mes questions et notes<textarea value={draft.notes} maxLength={5000} rows={4} placeholder="Informations confirmées, état, incertitudes, questions à poser…" onChange={e => change({ notes: e.target.value })}/></label><div className="next-step"><span className="eyebrow">VOTRE PROCHAINE ÉTAPE</span><strong>{nextStep(draft)}</strong></div>{state.member ? <div className="actions"><button className="primary" disabled={busy || !dirty && !!active} onClick={saveProject}>{busy ? 'Enregistrement…' : 'Enregistrer mon projet →'}</button>{dirty && <button className="text-button" onClick={() => { const p = state.projects.find(p => p.id === active); setDraft(p || createDraft(prefs)); setDirty(false); setError(''); }}>Annuler les modifications</button>}<span className="fine">{dirty ? 'Modifications non enregistrées' : 'Votre projet est à jour'}</span></div> : <div className="save-prompt"><h3>Gardez votre projet pour la prochaine fois.</h3><p>Un espace gratuit pour retrouver votre carnet sur vos appareils. Aucun moyen de paiement demandé.</p>{signedIn ? <button className="primary" onClick={() => go('profile')}>Activer mon espace gratuit →</button> : <a className="primary" href={signIn} target="_top" onClick={keepDraft}>Continuer avec ChatGPT →</a>}<p className="fine">Votre brouillon est conservé temporairement dans cet onglet pendant la connexion, si le navigateur le permet. Vous pouvez aussi l’exporter.</p><button className="text-button" onClick={() => download(JSON.stringify({ version: 2, projects: [draft] }, null, 2), 'nautilus-brouillon.json', 'application/json')}>Exporter mon brouillon</button></div>}{active && <div className="secondary-actions"><button disabled={!draft.saleAt} onClick={() => {
                try {
                    download(calendarEvent(draft, active), 'nautilus-vente.ics', 'text/calendar');
                    setMessage('Rappel téléchargé : importez-le dans votre agenda et vérifiez ses réglages de notification.');
                }
                catch {
                    setError('Renseignez une date de vente.');
                }
            }}>Ajouter la vente à mon agenda ↓</button><span className="fine">Rappel proposé 24 h avant. Nautilus n’envoie aucune notification.</span>{!confirmRemove ? <button className="text-button danger" onClick={() => setConfirmRemove(true)}>Retirer ce projet</button> : <div className="warning"><p>Retirer ce projet de votre compte ? Cette action est définitive. Exportez d’abord votre carnet si vous souhaitez le garder.</p><button disabled={busy} onClick={async () => {
                    const s = await mutate({ action: 'remove', id: active });
                    if (s) {
                        setActive('');
                        setDraft(createDraft(prefs));
                        setDirty(false);
                        setConfirmRemove(false);
                        setMessage('Projet retiré.');
                    }
                }}>Confirmer le retrait</button><button onClick={() => setConfirmRemove(false)}>Garder le projet</button></div>}</div>}</>;
    return <div className="nautilus"><a className="skip" href="#main">Aller au contenu</a><header className="topbar"><a className="brand" href="/" aria-label="Nautilus, accueil"><img src="/logo.png" alt="" width="26" height="32"/><span>Nautilus</span></a><nav aria-label="Navigation principale"><button onClick={() => go('home')} aria-current={view === 'home' ? 'page' : undefined}>Découvrir</button><button onClick={() => go('searches')} aria-current={view === 'searches' ? 'page' : undefined}>Mes recherches</button><button onClick={() => go('learn')} aria-current={view === 'learn' ? 'page' : undefined}>Apprendre</button><button onClick={() => go('workspace')} aria-current={view === 'workspace' ? 'page' : undefined}>Mon carnet {state.projects.length > 0 && <span className="count">{state.projects.length}</span>}</button></nav><div className="account-actions">{state.member ? <button className="outline small" onClick={() => go('profile')}>Mon profil</button> : signedIn ? <button className="outline small" onClick={() => go('profile')}>Créer mon espace</button> : <a className="outline small" href={signIn} target="_top">Se connecter</a>}<span className="private-badge">BÊTA PRIVÉE</span></div></header><main id="main">
 {error && <div className="global-message error" role="alert">{error}<button aria-label="Fermer le message d’erreur" onClick={() => setError('')}>×</button></div>}{message && <div className="global-message" role="status">{message}</div>}
 {view === 'home' && <><section className="hero"><div><p className="eyebrow blue">LE PLAISIR DE CHINER. LA CONFIANCE EN PLUS.</p><h1>Votre premier<br />« adjugé » commence<br /><em>bien avant la vente.</em></h1><p className="lead">Un objet vous plaît. Mais les frais, l’état ou le bon prix vous font hésiter ? Nautilus vous aide à préparer votre décision, étape par étape.</p><div className="actions"><button className="primary" onClick={() => go('workspace')}>Préparer mon achat gratuitement →</button><button className="text-button" onClick={() => go('searches')}>Je cherche un objet précis →</button></div><p className="fine">Simulation sans inscription · Aucun paiement · Vous gardez la main</p></div><div className="hero-object"><span className="eyebrow">UNE ENVIE. UN PROJET. UNE DÉCISION.</span><ObjectArt /><div className="art-caption"><span>Votre prochain coup de cœur</span><small>Illustration · aucun lot proposé à la vente</small></div><div className="floating-note"><span className="gold-dot"/> Les frais comptent aussi.<br /><strong>Votre budget, tout compris.</strong></div></div></section><section className="value-strip"><p><b>01</b> Garder ce qui vous plaît</p><p><b>02</b> Comprendre ce que vous payez</p><p><b>03</b> Décider à tête reposée</p></section><section className="section"><div className="section-title"><div><p className="eyebrow">UN COMPAGNON, DU DÉCLIC À LA DÉCISION</p><h2>Le coup de cœur mérite<br />un peu de méthode.</h2></div><p>Vous découvrez un objet sur un site de vente.<br />Vous préparez votre achat dans Nautilus.<br />Vous enchérissez auprès de la maison.</p></div><div className="three-grid">{[['Un carnet qui vous ressemble', 'Rassemblez vos liens, vos envies et vos questions. Retrouvez vos projets dans un espace personnel.', '↗'], ['Un budget sans angle mort', 'Simulez les frais et calculez votre plafond marteau à partir de votre budget total.', '＋'], ['La bonne prochaine étape', 'Un rapport d’état à demander ? Un transport à prévoir ? Votre dossier vous aide à avancer.', '✓']].map(([t, b, icon]) => <article className="feature" key={t}><span className="feature-icon">{icon}</span><h3>{t}</h3><p>{b}</p></article>)}</div></section><section className="editorial"><div><p className="eyebrow">LA CONFIANCE SE CONSTRUIT</p><h2>Vous n’avez pas besoin<br />de tout savoir.<br /><em>De poser les bonnes questions, si.</em></h2><p>Des repères simples, adaptés à vos envies. Sans score magique, sans promesse de plus-value.</p><button className="primary" onClick={() => go('learn')}>Les essentiels pour commencer →</button></div><ObjectArt kind={1}/></section><section className="section"><p className="eyebrow">UN ESPACE QUI GRANDIT AVEC VOS ENVIES</p><h2>Pourquoi revenir ? Parce que votre projet avance.</h2><div className="three-grid">{[['Avant la vente', 'Affinez votre budget et les questions à poser.'], ['À l’approche du jour J', 'Retrouvez les points à vérifier et ajoutez la vente à votre agenda.'], ['Après votre décision', 'Notez ce que vous avez acheté ou laissé passer, puis préparez la prochaine envie.']].map(([t, b]) => <article className="feature" key={t}><h3>{t}</h3><p>{b}</p></article>)}</div></section><section className="closing"><p className="eyebrow">GRATUIT PENDANT LA BÊTA</p><h2>Commencez par une envie.</h2><p>Le carnet, la simulation de frais et les essentiels sont accessibles dans cette version. Aucune carte bancaire demandée.</p><button className="primary" onClick={() => go('workspace')}>Faire ma première simulation →</button></section></>}
 {view === 'workspace' && <section className="section workspace-page"><div className="section-title"><div><p className="eyebrow">VOS ENVIES, LES IDÉES CLAIRES</p><h1 className="page-heading">{state.member ? 'Votre carnet personnel.' : 'Préparez votre premier achat.'}</h1><p className="muted">{state.member ? 'Enregistré dans votre compte, accessible après connexion.' : 'Faites une simulation librement. L’inscription permet ensuite d’enregistrer vos projets.'}</p></div>{state.member && <button className="primary" disabled={busy} onClick={newProject}>+ Nouveau projet</button>}</div>{!loaded ? <p role="status">Ouverture de votre espace…</p> : <>{state.member && <div className="overview"><div><strong>{pending.length}</strong><span>projets en cours</span></div><div><strong>{state.projects.filter(p => p.preparedAt).length}</strong><span>dossiers préparés au moins une fois</span></div><div><strong>{upcoming[0] ? new Date(upcoming[0].saleAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '—'}</strong><span>prochaine vente renseignée</span></div></div>}<div className={state.member ? 'workspace-grid' : 'guest-grid'}>{state.member && <aside className="project-list"><label className="visually-hidden" htmlFor="filter">Filtrer les projets</label><select id="filter" value={filter} onChange={e => setFilter(e.target.value)}><option value="tous">Tous mes projets</option>{Object.entries(statuses).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>{visible.map(p => <button className={active === p.id ? 'project-card selected' : 'project-card'} key={p.id} onClick={() => open(p)}><span className="eyebrow">{p.category}</span><strong>{p.title}</strong><span>{statuses[p.status]} · {p.checks.filter(Boolean).length}/5</span><small>{nextStep(p)}</small></button>)}{!visible.length && <p className="fine">Votre prochain projet commence ici. Donnez-lui un nom, un budget et une première question.</p>}<button className="text-button" onClick={() => download(JSON.stringify({ version: 3, preferences: state.preferences, projects: state.projects, searches: state.searches, offerInterests: state.offerInterests }, null, 2), 'nautilus-mes-donnees.json', 'application/json')}>Exporter mon carnet ↓</button>{state.projects.length >= 2 && <button className="outline" onClick={() => go('compare')}>Comparer mes envies →</button>}</aside>}<section className="project-editor" aria-label="Préparation d’un achat">{form}</section>{!state.member && <aside className="guest-aside"><ObjectArt kind={2}/><h3>Un objet repéré ailleurs ?</h3><p>Gardez le lien officiel à portée de main. Renseignez les informations vous-même : Nautilus ne récupère ni photo ni description.</p><p className="fine">Aucune vente n’est organisée ici. Votre inscription chez Nautilus ne vous inscrit pas auprès des maisons de ventes.</p></aside>}</div></>}</section>}
 {view === 'profile' && <section className="profile-page section"><p className="eyebrow">VOTRE POINT DE DÉPART</p><h1 className="page-heading">Vos envies donnent le ton.</h1><p className="lead">Quelques choix pour adapter les repères pédagogiques et le budget de vos nouveaux projets.</p><h3>Quels univers vous attirent ?</h3><div className="choices">{CATEGORIES.map(c => <button aria-pressed={prefs.categories.includes(c)} key={c} onClick={() => setPrefs(p => ({ ...p, categories: p.categories.includes(c) ? p.categories.filter(v => v !== c) : [...p.categories, c] }))}>{c}</button>)}</div><div className="fields"><label>Budget total habituel par objet (€)<input type="number" min="1" max="10000000" step="1" value={prefs.budget} onChange={e => setPrefs(p => ({ ...p, budget: Number(e.target.value) }))}/></label><label>Votre expérience<select value={prefs.experience} onChange={e => setPrefs(p => ({ ...p, experience: e.target.value as Preferences['experience'] }))}><option value="debutant">Je débute aux enchères</option><option value="amateur">J’ai déjà acheté aux enchères</option></select></label></div>{signedIn ? <><button className="primary" disabled={busy || !prefs.categories.length || !Number.isFinite(prefs.budget) || prefs.budget <= 0} onClick={saveProfile}>{busy ? 'Enregistrement…' : state.member ? 'Enregistrer mes préférences' : 'Activer mon espace gratuit →'}</button><p className="fine">Vos préférences et projets sont enregistrés pour faire fonctionner votre espace. <a href="/confidentialite">Comment vos données sont utilisées</a>. Aucun abonnement ni envoi marketing.</p></> : <><a className="primary" href={signIn} target="_top" onClick={keepDraft}>Continuer avec ChatGPT →</a><p className="fine">Connexion ChatGPT requise pour cette bêta. Les choix effectués ici ne sont enregistrés qu’après activation de votre espace.</p></>}{state.member && <section className="account-settings"><h3>Votre compte vous appartient.</h3><p className="muted">Exportez vos projets avant toute suppression. Retirer votre espace Nautilus ne supprime pas votre compte ChatGPT.</p><button className="outline" onClick={() => download(JSON.stringify({ version: 3, preferences: state.preferences, projects: state.projects, searches: state.searches, offerInterests: state.offerInterests }, null, 2), 'nautilus-mes-donnees.json', 'application/json')}>Télécharger mes données</button><a className="text-button" href={signOut} target="_top">Me déconnecter</a><button className="text-button danger" onClick={() => setConfirmErase(true)}>Supprimer mon espace Nautilus</button>{confirmErase && <div className="warning"><p>Cette action supprime définitivement vos préférences, projets et notes dans Nautilus. Saisissez SUPPRIMER pour confirmer.</p><label>Confirmation de suppression<input value={eraseText} onChange={e => setEraseText(e.target.value)}/></label><button disabled={eraseText !== 'SUPPRIMER' || busy} onClick={async () => {
                        if (await mutate({ action: 'erase', confirmation: eraseText })) {
                            setActive('');
                            setDraft(createDraft());
                            setDirty(false);
                            setConfirmErase(false);
                            setMessage('Votre espace Nautilus a été supprimé.');
                            go('home');
                        }
                    }}>Supprimer définitivement</button><button onClick={() => { setConfirmErase(false); setEraseText(''); }}>Annuler</button></div>}<h3>Cet outil vous aide-t-il à décider ?</h3><p className="fine">Votre note nous aide à améliorer le produit. Aucun avis n’est publié.</p><div className="choices" aria-label="Note d’utilité">{[1, 2, 3, 4, 5].map(n => <button key={n} aria-pressed={rating === n} disabled={busy} onClick={async () => {
                        if (await mutate({ action: 'rate', rating: n })) {
                            setRating(n);
                            setMessage('Merci, votre retour est enregistré.');
                        }
                    }}>{n}/5</button>)}</div></section>}</section>}
 {view === 'learn' && <section className="section"><p className="eyebrow">LES REPÈRES NAUTILUS</p><h1 className="page-heading">Un peu de savoir.<br />Beaucoup plus de confiance.</h1><p className="lead">{state.member ? 'Une sélection de repères selon les univers de votre profil.' : 'Les bons réflexes pour passer de la curiosité à un projet préparé.'}</p>{article !== null ? <article className="reading"><button className="text-button" onClick={() => setArticle(null)}>← Tous les essentiels</button><p className="eyebrow">{guides[article].tag}</p><h2>{guides[article].title}</h2><p>{guides[article].body}</p><div className="next-step"><span className="eyebrow">À FAIRE DANS VOTRE CARNET</span><strong>{guides[article].task}</strong></div><button className="primary" onClick={() => go('workspace')}>Préparer mon projet →</button><p className="fine">Repères généraux, sans expertise d’un objet. Consultez les conditions et les informations de la vente concernée. Sources utiles : <a href="https://drouot.com/fr/faq" target="_blank" rel="noreferrer">Drouot</a> · <a href="https://help.interencheres.com/hc/fr/articles/13226061113233-Quels-sont-les-frais-de-vente" target="_blank" rel="noreferrer">Interencheres</a>.</p></article> : <div className="three-grid">{relevant.map(g => <button className="guide-card" key={g.title} onClick={() => setArticle(guides.indexOf(g))}><span className="eyebrow">{g.tag}</span><h3>{g.title}</h3><span>Lire le repère →</span></button>)}</div>}<div className="notice"><strong>Où chercher votre prochain objet ?</strong><p>Vous pouvez explorer les catalogues sur <a href="https://drouot.com/fr" target="_blank" rel="noreferrer">Drouot</a> ou <a href="https://www.interencheres.com/" target="_blank" rel="noreferrer">Interencheres</a>, puis préparer votre projet ici. Ces liens ne constituent ni un partenariat ni une recommandation de lot.</p></div></section>}
 <div hidden={view !== 'searches'}><SearchStudio member={state.member} signedIn={signedIn} signIn={signIn} preferences={prefs} searches={state.searches || []} onSubmit={mutate} onActivate={() => go('profile')} onOffers={() => go('offers')} onCandidate={p => { if (dirty) {
        setError('Enregistrez ou annulez les modifications du projet en cours avant de préparer un autre objet.');
        return;
    } setDraft(p); setActive(''); setVersion(0); setDirty(true); go('workspace'); }}/></div>
 {view === 'offers' && <OfferStudy member={state.member} signedIn={signedIn} signIn={offerSignIn} interests={state.offerInterests || []} onSubmit={mutate} onActivate={() => go('profile')}/>}
 {view === 'compare' && <section className="section"><p className="eyebrow">FAIRE DES CHOIX</p><h1 className="page-heading">Deux envies, un budget.</h1><p className="lead">Comparez vos propres hypothèses. Aucun classement de valeur n’est produit.</p><div className="comparison"><table><caption className="visually-hidden">Comparaison des projets enregistrés</caption><thead><tr><th>Projet</th><th>Budget total</th><th>Coût simulé</th><th>Plafond marteau</th><th>Vérifications</th></tr></thead><tbody>{state.projects.filter(p => !['achete', 'renonce'].includes(p.status)).map(p => <tr key={p.id}><th><button className="text-button" onClick={() => open(p)}>{p.title}</button></th><td>{eur(p.budget)}</td><td>{eur(totalCost(p))}</td><td>{eur(maxHammer(p))}</td><td>{p.checks.filter(Boolean).length}/5</td></tr>)}</tbody></table></div></section>}
 </main><footer><div className="brand"><img src="/logo.png" width="22" height="28" alt=""/><span>Nautilus</span></div><p>Votre copilote pour acheter aux enchères.<br />Le plaisir de découvrir. La liberté de décider.</p><div><a href="/methode">Notre méthode</a><a href="/confidentialite">Vos données</a><a href="/conditions">Cadre de la bêta</a><button className="text-button" onClick={() => go('offers')}>Les propositions à l’étude</button></div><small>Bêta privée · Aucune vente organisée · Aucune expertise, authentification ou promesse de rendement.</small></footer></div>;
}

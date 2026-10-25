import { CATEGORIES, type Preferences, type Project, createDraft } from './product.ts';
export const STYLES = ['Lignes sobres', 'Vintage', 'Couleurs fortes', 'Matières naturelles', 'Pièce sculpturale'] as const;
export type SearchBrief = {
    title: string;
    category: string;
    budget: number;
    styles: string[];
    constraints: string;
    area: string;
    transport: 'retrait' | 'livraison' | 'flexible';
    status: 'active' | 'pause' | 'terminee';
};
export type SavedSearch = SearchBrief & {
    id: string;
    version: number;
    updatedAt: number;
};
export type OfferInterest = {
    offer: 'monthly_9' | 'project_29';
    priceEuro: number;
    createdAt: number;
};
export function freshSearch(p?: Preferences): SearchBrief { return { title: '', category: p?.categories[0] || CATEGORIES[0], budget: p?.budget || 1000, styles: [], constraints: '', area: '', transport: 'flexible', status: 'active' }; }
export function validSearch(x: unknown): x is SearchBrief { if (!x || typeof x !== 'object')
    return false; const b = x as SearchBrief; return typeof b.title === 'string' && b.title.trim().length > 0 && b.title.length <= 120 && CATEGORIES.includes(b.category as any) && typeof b.budget === 'number' && Number.isFinite(b.budget) && b.budget > 0 && b.budget <= 10000000 && Math.abs(b.budget * 100 - Math.round(b.budget * 100)) < .00001 && Array.isArray(b.styles) && b.styles.length <= 5 && new Set(b.styles).size === b.styles.length && b.styles.every(s => STYLES.includes(s as any)) && typeof b.constraints === 'string' && b.constraints.length <= 1500 && typeof b.area === 'string' && b.area.length <= 100 && ['retrait', 'livraison', 'flexible'].includes(b.transport) && ['active', 'pause', 'terminee'].includes(b.status); }
export function cleanSearch(b: SearchBrief): SearchBrief { return { title: b.title.trim(), category: b.category, budget: b.budget, styles: [...b.styles], constraints: b.constraints.trim(), area: b.area.trim(), transport: b.transport, status: b.status }; }
export function searchQuery(b: SearchBrief) { return [b.title.trim(), b.category, b.styles.join(' '), b.area.trim()].filter(Boolean).join(' · '); }
export function searchQuestions(b: SearchBrief) { const questions = ['Quels sont tous les frais acheteur et de plateforme TTC ?', 'Pouvez-vous transmettre un rapport d’état et des photos des défauts ?', 'Quels éléments documentent la provenance et l’attribution ?']; if (b.transport === 'livraison')
    questions.push('Quel est le devis de transport et d’assurance jusqu’à ma région ?');
else if (b.transport === 'retrait')
    questions.push('Où, quand et dans quelles conditions peut-on retirer l’objet ?');
else
    questions.push('Quelles sont les possibilités et les coûts de retrait ou de livraison ?'); if (b.constraints.trim())
    questions.push('L’objet respecte-t-il ces contraintes : ' + b.constraints.trim() + ' ?'); return questions; }
export function searchSummary(b: SearchBrief) { return `Ma recherche : ${b.title.trim()}\nUnivers : ${b.category}\nBudget total maximum : ${b.budget} € (frais et transport compris)\nGoûts : ${b.styles.join(', ') || 'à préciser'}\nRégion : ${b.area || 'non précisée'}\nContraintes : ${b.constraints || 'aucune précisée'}\n\nQuestions à confirmer pour chaque objet :\n${searchQuestions(b).map(q => '• ' + q).join('\n')}\n\nCe brief ne déclenche aucune recherche automatique, prestation ou notification.`; }
export function candidateFromSearch(b: SearchBrief): Project { return { ...createDraft(), title: b.title, category: b.category, budget: b.budget, notes: searchSummary(b) }; }

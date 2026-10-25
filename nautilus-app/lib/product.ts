import { calculateAuctionCost } from './auctionCostV2.ts';
export const CATEGORIES = ['Design & mobilier', 'Art & estampes', 'Bijoux & montres', 'Céramique & objets'] as const;
export const CHECKS = ['Conditions et frais vérifiés', 'État et défauts documentés', 'Provenance et attribution examinées', 'Transport et retrait prévus', 'Inscription à la vente confirmée'];
export type Preferences = {
    categories: string[];
    budget: number;
    experience: 'debutant' | 'amateur';
};
export type CostConfidence = 'unknown' | 'estimated' | 'confirmed';
export type Project = {
    premiumConfidence?: CostConfidence;
    fixedConfidence?: CostConfidence;
    title: string;
    category: string;
    sourceUrl: string;
    saleAt: string;
    budget: number;
    hammer: number;
    premium: number;
    fixed: number;
    checks: boolean[];
    notes: string;
    status: 'preparer' | 'surveiller' | 'achete' | 'renonce';
};
export type SavedProject = Project & {
    id: string;
    version: number;
    updatedAt: number;
    preparedAt: number | null;
};
export const defaults: Preferences = { categories: [], budget: 1000, experience: 'debutant' };
const text = (x: unknown, max: number) => typeof x === 'string' && x.length <= max;
const amount = (x: unknown) => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 10000000 && Math.abs(Math.round(x * 100) - x * 100) < 0.00001;
export function validPreferences(x: unknown): x is Preferences {
    if (!x || typeof x !== 'object')
        return false;
    const p = x as Preferences;
    return Array.isArray(p.categories) && p.categories.length > 0 && p.categories.length <= 4 && new Set(p.categories).size === p.categories.length && p.categories.every(v => CATEGORIES.includes(v as any)) && amount(p.budget) && p.budget > 0 && ['debutant', 'amateur'].includes(p.experience);
}
export function validProject(x: unknown): x is Project {
    if (!x || typeof x !== 'object')
        return false;
    const p = x as Project;
    if ([p.premiumConfidence, p.fixedConfidence].some(v => v !== undefined && !['unknown', 'estimated', 'confirmed'].includes(v)))
        return false;
    if (!text(p.title, 160) || !p.title.trim() || !CATEGORIES.includes(p.category as any) || !text(p.notes, 5000) || !Array.isArray(p.checks) || p.checks.length !== 5 || !p.checks.every(v => typeof v === 'boolean') || !['preparer', 'surveiller', 'achete', 'renonce'].includes(p.status))
        return false;
    if (![p.budget, p.hammer, p.fixed].every(amount) || p.budget <= 0 || !amount(p.premium) || p.premium > 100 || !text(p.sourceUrl, 2000) || !text(p.saleAt, 40))
        return false;
    if (p.sourceUrl) {
        try {
            const u = new URL(p.sourceUrl);
            if (u.protocol !== 'https:' || u.username || u.password)
                return false;
        }
        catch {
            return false;
        }
    }
    if (p.saleAt && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:\.\d{3})?Z$/.test(p.saleAt))
        return false;
    return !p.saleAt || Number.isFinite(Date.parse(p.saleAt));
}
export function cleanProject(p: Project): Project { return { premiumConfidence: p.premiumConfidence || 'unknown', fixedConfidence: p.fixedConfidence || 'unknown', title: p.title.trim(), category: p.category, sourceUrl: p.sourceUrl, saleAt: p.saleAt, budget: p.budget, hammer: p.hammer, premium: p.premium, fixed: p.fixed, checks: [...p.checks], notes: p.notes, status: p.status }; }
export function createDraft(p: Preferences = defaults): Project { return { premiumConfidence: 'unknown', fixedConfidence: 'unknown', title: '', category: p.categories[0] || CATEGORIES[0], sourceUrl: '', saleAt: '', budget: p.budget, hammer: 0, premium: 0, fixed: 0, checks: CHECKS.map(() => false), notes: '', status: 'preparer' }; }
export function totalCost(p: Project) { return calculateAuctionCost({ hammerPrice: p.hammer, buyerPremiumPercent: p.premium, vatOnPremiumPercent: 0, additionalTaxes: 0, shippingAndInsurance: p.fixed, otherFees: 0 }).total; }
export function maxHammer(p: Project) { return Math.max(0, Math.floor(Math.max(0, p.budget - p.fixed) / (1 + p.premium / 100) * 100) / 100); }
export function costSummary(p: Project) { const ready = !!p.premiumConfidence && p.premiumConfidence !== 'unknown' && !!p.fixedConfidence && p.fixedConfidence !== 'unknown'; const state = ready ? (p.premiumConfidence === 'confirmed' && p.fixedConfidence === 'confirmed' ? 'confirmed' : 'provisional') : 'incomplete'; return { state, total: ready ? totalCost(p) : null, ceiling: ready ? maxHammer(p) : null, enteredSubtotal: totalCost(p) }; }
export function isPrepared(p: Project) { return costSummary(p).state === 'confirmed' && p.hammer > 0 && p.checks[0] && p.checks.filter(Boolean).length >= 3 && totalCost(p) <= p.budget; }
export function nextStep(p: Project) {
    if (!p.hammer)
        return 'Renseigner le prix marteau envisagé';
    if (totalCost(p) > p.budget)
        return 'Revoir le scénario : le budget est dépassé';
    if (costSummary(p).state === 'incomplete')
        return 'Renseigner les frais encore inconnus';
    if (costSummary(p).state === 'provisional')
        return 'Faire confirmer les frais estimés';
    const index = p.checks.findIndex(v => !v);
    return index >= 0 ? CHECKS[index] : 'Noter votre décision après la vente';
}
export function calendarEvent(p: Project, id: string) {
    if (!p.saleAt || !Number.isFinite(Date.parse(p.saleAt)))
        throw new Error('Date de vente requise');
    const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
    const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Nautilus//Carnet//FR', 'BEGIN:VEVENT', `UID:${id}@nautilus`, `DTSTAMP:${stamp(new Date())}`, `DTSTART:${stamp(new Date(p.saleAt))}`, `SUMMARY:${esc('Vente : ' + p.title)}`, `DESCRIPTION:${esc('Vérifiez l’horaire sur le site officiel. Plafond marteau personnel : ' + (costSummary(p).ceiling === null ? 'non calculé, frais incomplets' : costSummary(p).ceiling + ' EUR (' + (costSummary(p).state === 'confirmed' ? 'frais déclarés vérifiés' : 'provisoire') + ')') + '. ' + p.sourceUrl)}`, 'BEGIN:VALARM', 'TRIGGER:-PT24H', 'ACTION:DISPLAY', 'DESCRIPTION:Préparer votre vente', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
}

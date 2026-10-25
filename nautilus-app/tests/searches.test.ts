import test from 'node:test';
import assert from 'node:assert/strict';
import { freshSearch, validSearch, cleanSearch, searchSummary, searchQuestions, candidateFromSearch } from '../lib/searches.ts';
const brief = { ...freshSearch(), title: 'Une paire de fauteuils', budget: 1200, area: 'Lyon', transport: 'livraison' as const, constraints: 'Largeur 80 cm maximum' };
test('brief validation rejects missing or abusive values and invalid enums', () => { assert.ok(validSearch(brief)); for (const change of [{ title: ' ' }, { budget: NaN }, { budget: -1 }, { budget: 1.123 }, { styles: ['inventé'] }, { transport: 'magic' }, { area: 'a'.repeat(101) }, { status: 'scraping' }, { constraints: 'a'.repeat(1501) }])
    assert.equal(validSearch({ ...brief, ...change }), false); });
test('the roadmap preserves explicit constraints and never invents a found object', () => { const text = searchSummary(brief); assert.ok(text.includes('1200 €')); assert.ok(text.includes('Lyon')); assert.ok(text.includes('Largeur 80 cm maximum')); assert.ok(text.includes('aucune recherche automatique')); assert.ok(searchQuestions(brief).some(q => q.includes('devis de transport'))); const p = candidateFromSearch(brief); assert.equal(p.budget, 1200); assert.equal(p.sourceUrl, ''); assert.equal(p.hammer, 0); assert.ok(p.checks.every(c => !c)); });
test('cleaning removes undeclared data from persistent briefs', () => { const p = cleanSearch({ ...brief, title: ' Fauteuil ', ownerId: 'other' } as any); assert.equal(p.title, 'Fauteuil'); assert.equal('ownerId' in p, false); });

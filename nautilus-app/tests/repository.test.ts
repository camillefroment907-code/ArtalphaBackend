import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { repository } from '../lib/repository.ts';
import { createDraft, defaults } from '../lib/product.ts';
function setup() { const sqlite = new DatabaseSync(':memory:'); sqlite.exec('PRAGMA foreign_keys=ON'); sqlite.exec(readFileSync(new URL('../drizzle/0000_nosy_spyke.sql', import.meta.url), 'utf8').replaceAll('--> statement-breakpoint', '')); const db: any = { prepare(sql: string) { return { bind(...args: any[]) { const s = sqlite.prepare(sql); return { async first() { return s.get(...args) || null; }, async all() { return { results: s.all(...args) }; }, async run() { return s.run(...args); } }; } }; }, async batch(statements: any[]) { sqlite.exec('BEGIN'); try {
        for (const s of statements)
            await s.run();
        sqlite.exec('COMMIT');
    }
    catch (e) {
        sqlite.exec('ROLLBACK');
        throw e;
    } } }; return { db, sqlite }; }
const prefs = { ...defaults, categories: ['Design & mobilier'] };
const project = { ...createDraft(prefs), title: 'Objet de test', hammer: 500, premium: 25, fixed: 50 };
test('two accounts cannot read, change or delete each other’s projects', async () => { const { db } = setup(); const a = repository(db, 'alice'), b = repository(db, 'bob'); await a.join(prefs, 'direct'); await b.join(prefs, 'direct'); const id = await a.create(project); assert.equal((await a.state()).projects.length, 1); assert.equal((await b.state()).projects.length, 0); assert.equal(await b.update(id, 1, { ...project, title: 'intrusion' }), null); await b.remove(id); assert.equal((await a.state()).projects[0].title, 'Objet de test'); });
test('stale updates are rejected instead of silently overwriting another device', async () => { const { db } = setup(); const a = repository(db, 'alice'); await a.join(prefs, 'direct'); const id = await a.create(project); assert.ok(await a.update(id, 1, { ...project, notes: 'version 2' })); assert.equal(await a.update(id, 1, { ...project, notes: 'stale' }), null); assert.equal((await a.state()).projects[0].notes, 'version 2'); assert.equal((await a.state()).projects[0].version, 2); });
test('account deletion removes its projects and feedback but preserves another account', async () => { const { db, sqlite } = setup(); const a = repository(db, 'alice'), b = repository(db, 'bob'); await a.join(prefs, 'direct'); await b.join(prefs, 'direct'); await a.create(project); await b.create(project); await a.rate(3); await a.rate(5); assert.equal((sqlite.prepare('SELECT COUNT(*) AS n FROM feedback').get() as any).n, 1); await a.erase(); assert.equal((await a.state()).member, false); assert.equal((await a.state()).projects.length, 0); assert.equal((sqlite.prepare('SELECT COUNT(*) AS n FROM feedback').get() as any).n, 0); assert.equal((await b.state()).projects.length, 1); });
test('signup remains unique and cannot reset an existing profile', async () => { const { db, sqlite } = setup(); const a = repository(db, 'alice'); await a.join(prefs, 'editorial'); await a.join({ ...prefs, budget: 500 }, 'other'); assert.equal((sqlite.prepare('SELECT COUNT(*) AS n FROM members').get() as any).n, 1); assert.equal((await a.state()).preferences.budget, 1000); });

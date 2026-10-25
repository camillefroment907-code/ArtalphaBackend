import { cleanSearch, type SearchBrief } from './searches.ts';
// SQL always scopes project data to the authenticated owner. Caller never supplies owner IDs.
import { cleanProject, isPrepared, type Project, type Preferences } from './product.ts';
export function repository(db: any, owner: string) {
    const now = () => Date.now();
    return {
        async state() { const member = await db.prepare('SELECT preferences, created_at FROM members WHERE id = ?').bind(owner).first(); const rows = member ? await db.prepare('SELECT id,payload,version,updated_at,prepared_at FROM projects WHERE owner_id = ? ORDER BY updated_at DESC LIMIT 100').bind(owner).all() : { results: [] }; const searches = member ? await db.prepare('SELECT id,payload,version,updated_at FROM searches WHERE owner_id = ? ORDER BY updated_at DESC LIMIT 10').bind(owner).all() : { results: [] }; const interests = member ? await db.prepare('SELECT offer,price_euro,created_at FROM offer_interests WHERE owner_id = ?').bind(owner).all() : { results: [] }; return { searches: searches.results.map((r: any) => ({ ...JSON.parse(r.payload), id: r.id, version: r.version, updatedAt: r.updated_at })), offerInterests: interests.results.map((r: any) => ({ offer: r.offer, priceEuro: r.price_euro, createdAt: r.created_at })), member: !!member, preferences: member ? JSON.parse(member.preferences) : null, projects: rows.results.map((r: any) => ({ ...JSON.parse(r.payload), id: r.id, version: r.version, updatedAt: r.updated_at, preparedAt: r.prepared_at })) }; },
        async join(preferences: Preferences, acquisition: string) { const t = now(); await db.prepare('INSERT INTO members(id,preferences,created_at,updated_at,acquisition) VALUES(?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(owner, JSON.stringify(preferences), t, t, acquisition).run(); },
        async profile(preferences: Preferences) { await db.prepare('UPDATE members SET preferences = ?, updated_at = ? WHERE id = ?').bind(JSON.stringify(preferences), now(), owner).run(); },
        async create(p: Project) {
            const count = await db.prepare('SELECT COUNT(*) AS n FROM projects WHERE owner_id = ?').bind(owner).first();
            if (count.n >= 100)
                throw new Error('LIMIT');
            const id = crypto.randomUUID(), t = now();
            await db.prepare('INSERT INTO projects(id,owner_id,payload,version,created_at,updated_at,prepared_at) VALUES(?,?,?,1,?,?,?)').bind(id, owner, JSON.stringify(cleanProject(p)), t, t, isPrepared(p) ? t : null).run();
            return id;
        },
        async update(id: string, version: number, p: Project) { const t = now(); return await db.prepare('UPDATE projects SET payload = ?, version = version + 1, updated_at = ?, prepared_at = COALESCE(prepared_at,?), returned_at = CASE WHEN ? - created_at >= 86400000 THEN ? ELSE returned_at END WHERE id = ? AND owner_id = ? AND version = ? RETURNING id').bind(JSON.stringify(cleanProject(p)), t, isPrepared(p) ? t : null, t, t, id, owner, version).first(); },
        async remove(id: string) { await db.prepare('DELETE FROM projects WHERE id = ? AND owner_id = ?').bind(id, owner).run(); },
        async rate(rating: number) { await db.prepare('INSERT INTO feedback(id,owner_id,rating,created_at) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET rating = excluded.rating, created_at = excluded.created_at').bind(owner, owner, rating, now()).run(); },
        async createSearch(b: SearchBrief) { const id = crypto.randomUUID(), t = now(); const r = await db.prepare('INSERT INTO searches(id,owner_id,payload,version,created_at,updated_at) SELECT ?,?,?,1,?,? WHERE (SELECT COUNT(*) FROM searches WHERE owner_id = ?) < 10 RETURNING id').bind(id, owner, JSON.stringify(cleanSearch(b)), t, t, owner).first(); if (!r)
            throw new Error('SEARCH_LIMIT'); return id; },
        async updateSearch(id: string, version: number, b: SearchBrief) { return db.prepare('UPDATE searches SET payload = ?, version = version + 1, updated_at = ? WHERE id = ? AND owner_id = ? AND version = ? RETURNING id').bind(JSON.stringify(cleanSearch(b)), now(), id, owner, version).first(); },
        async removeSearch(id: string) { await db.prepare('DELETE FROM searches WHERE id = ? AND owner_id = ?').bind(id, owner).run(); },
        async interest(offer: 'monthly_9' | 'project_29', interested: boolean) { const id = owner + ':' + offer; if (!interested) {
            await db.prepare('DELETE FROM offer_interests WHERE id = ? AND owner_id = ?').bind(id, owner).run();
            return;
        } await db.prepare('INSERT INTO offer_interests(id,owner_id,offer,price_euro,created_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(id, owner, offer, offer === 'monthly_9' ? 9 : 29, now()).run(); },
        async erase() { await db.batch([db.prepare('DELETE FROM offer_interests WHERE owner_id = ?').bind(owner), db.prepare('DELETE FROM searches WHERE owner_id = ?').bind(owner), db.prepare('DELETE FROM feedback WHERE owner_id = ?').bind(owner), db.prepare('DELETE FROM projects WHERE owner_id = ?').bind(owner), db.prepare('DELETE FROM members WHERE id = ?').bind(owner)]); },
    };
}

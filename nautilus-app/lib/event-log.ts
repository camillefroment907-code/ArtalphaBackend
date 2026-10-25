export async function recordEvent(db: any, owner: string, kind: string, entityId: string, time = Date.now()) {
    const day = new Date(time).toISOString().slice(0, 10);
    const id = [owner, entityId, kind, day].join(':');
    try {
        await db.batch([db.prepare('INSERT INTO product_events(id,owner_id,kind,entity_id,created_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(id, owner, kind, entityId, time), db.prepare('DELETE FROM product_events WHERE owner_id = ? AND created_at < ?').bind(owner, time - 120 * 86400000)]);
    }
    catch {
        console.warn('Nautilus activity measurement unavailable');
    }
}

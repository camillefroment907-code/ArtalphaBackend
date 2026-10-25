import { cleanProject, type Project } from './product.ts';
export type ProductEvent = {
    kind: string;
    entityId: string;
    createdAt: number;
};
export function projectChanged(before: Project, after: Project) { return JSON.stringify(cleanProject(before)) !== JSON.stringify(cleanProject(after)); }
export function cohortMetrics(members: {
    id: string;
    createdAt: number;
}[], events: (ProductEvent & {
    ownerId: string;
})[], now: number) {
    const day = 86400000;
    const useful = new Set(['project_created', 'project_prepared', 'project_progress', 'search_created', 'search_updated']);
    const activated = members.map(m => { const first = events.filter(e => e.ownerId === m.id && e.kind === 'project_prepared').sort((a, b) => a.createdAt - b.createdAt)[0]; return { ...m, activatedAt: first?.createdAt ?? null }; });
    const retention = (from: number, to: number) => { const eligible = activated.filter(m => m.activatedAt !== null && now >= m.activatedAt + to * day); const returned = eligible.filter(m => events.some(e => e.ownerId === m.id && useful.has(e.kind) && e.createdAt >= m.activatedAt! + from * day && e.createdAt < m.activatedAt! + to * day)); return { eligible: eligible.length, returned: returned.length, rate: eligible.length ? returned.length / eligible.length : null }; };
    return { registrations: members.length, activated: activated.filter(m => m.activatedAt !== null).length, w1: retention(7, 14), w4: retention(28, 35) };
}

import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
import { repository } from '../../../lib/repository';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff' };
export async function GET() { const u = await getChatGPTUser(); if (!u)
    return Response.json({ error: 'Connexion requise.' }, { status: 401, headers }); try {
    const repo = repository(env.DB, u.userId);
    return Response.json({ version: 4, ...await repo.state(), activity: await repo.events() }, { headers });
}
catch {
    return Response.json({ error: 'Export indisponible. Réessayez plus tard.' }, { status: 503, headers });
} }

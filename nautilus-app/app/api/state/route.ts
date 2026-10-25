import { validSearch } from '../../../lib/searches';
import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
import { repository } from '../../../lib/repository';
import { validPreferences, validProject } from '../../../lib/product';
import { mutationAllowed } from '../../../lib/request-policy';
export const dynamic = 'force-dynamic';
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff' } });
export async function GET() {
    const user = await getChatGPTUser();
    if (!user)
        return json({ signedIn: false, member: false, projects: [] });
    try {
        return json({ signedIn: true, ...await repository(env.DB, user.userId).state() });
    }
    catch {
        return json({ error: 'Votre espace est temporairement indisponible. Réessayez dans un instant.' }, 503);
    }
}
export async function POST(request: Request) {
    const user = await getChatGPTUser();
    if (!user)
        return json({ error: 'Connectez-vous pour enregistrer votre projet.' }, 401);
    if (!mutationAllowed(request))
        return json({ error: 'Requête refusée.' }, 403);
    if (Number(request.headers.get('content-length') || 0) > 16000)
        return json({ error: 'Données trop volumineuses.' }, 413);
    let body: any;
    try {
        const raw = await request.text();
        if (raw.length > 16000)
            return json({ error: 'Données trop volumineuses.' }, 413);
        body = JSON.parse(raw);
    }
    catch {
        return json({ error: 'Format de données invalide.' }, 400);
    }
    if (!body || typeof body !== 'object')
        return json({ error: 'Données invalides.' }, 400);
    try {
        const repo = repository(env.DB, user.userId);
        const state = await repo.state();
        if (body.action === 'join') {
            if (!validPreferences(body.preferences))
                return json({ error: 'Choisissez au moins un univers et un budget valide.' }, 400);
            const acquisition = typeof body.acquisition === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(body.acquisition) ? body.acquisition : 'direct';
            await repo.join(body.preferences, acquisition);
            return json(await repo.state());
        }
        if (!state.member)
            return json({ error: 'Activez votre espace pour continuer.' }, 403);
        switch (body.action) {
            case 'createSearch':
                if (!validSearch(body.search))
                    return json({ error: 'Renseignez votre recherche et un budget valide.' }, 400);
                await repo.createSearch(body.search);
                break;
            case 'updateSearch':
                if (!validSearch(body.search) || typeof body.id !== 'string' || !Number.isInteger(body.version) || body.version < 1)
                    return json({ error: 'Recherche invalide.' }, 400);
                if (!await repo.updateSearch(body.id, body.version, body.search))
                    return json({ error: 'Cette recherche a changé dans un autre onglet. Rechargez avant de réessayer.' }, 409);
                break;
            case 'removeSearch':
                if (typeof body.id !== 'string')
                    return json({ error: 'Recherche invalide.' }, 400);
                await repo.removeSearch(body.id);
                break;
            case 'interest':
                if (!['monthly_9', 'project_29'].includes(body.offer) || typeof body.interested !== 'boolean')
                    return json({ error: 'Choix invalide.' }, 400);
                await repo.interest(body.offer, body.interested);
                break;
            case 'profile':
                if (!validPreferences(body.preferences))
                    return json({ error: 'Profil invalide.' }, 400);
                await repo.profile(body.preferences);
                break;
            case 'create':
                if (!validProject(body.project))
                    return json({ error: 'Vérifiez le titre, les montants et le lien HTTPS de votre projet.' }, 400);
                await repo.create(body.project);
                break;
            case 'update':
                if (!validProject(body.project) || typeof body.id !== 'string' || !Number.isInteger(body.version) || body.version < 1)
                    return json({ error: 'Projet invalide.' }, 400);
                if (!await repo.update(body.id, body.version, body.project))
                    return json({ error: 'Ce projet a changé dans un autre onglet ou n’est plus disponible. Rechargez votre carnet avant de réessayer.' }, 409);
                break;
            case 'remove':
                if (typeof body.id !== 'string')
                    return json({ error: 'Projet invalide.' }, 400);
                await repo.remove(body.id);
                break;
            case 'rate':
                if (!Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5)
                    return json({ error: 'Note invalide.' }, 400);
                await repo.rate(body.rating);
                break;
            case 'erase':
                if (body.confirmation !== 'SUPPRIMER')
                    return json({ error: 'Confirmation requise.' }, 400);
                await repo.erase();
                break;
            default: return json({ error: 'Action inconnue.' }, 400);
        }
        return json({ ...await repo.state(), signedIn: true });
    }
    catch (e) {
        return json({ error: e instanceof Error && e.message === 'SEARCH_LIMIT' ? 'Votre espace contient déjà 10 recherches. Mettez à jour une recherche existante.' : e instanceof Error && e.message === 'LIMIT' ? 'Votre carnet contient déjà 100 projets. Exportez puis retirez un projet pour en ajouter un.' : 'Enregistrement impossible pour le moment. Votre saisie reste affichée ; réessayez.' }, 503);
    }
}

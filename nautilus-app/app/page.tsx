import Nautilus from './nautilus';
import { getChatGPTUser, chatGPTSignInPath, chatGPTSignOutPath } from './chatgpt-auth';
export const dynamic = 'force-dynamic';
export default async function Page() { const user = await getChatGPTUser(); return <Nautilus signedIn={!!user} signIn={chatGPTSignInPath('/espace')} signOut={chatGPTSignOutPath('/')}/>; }

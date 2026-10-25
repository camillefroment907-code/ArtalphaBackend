import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Nautilus — Votre premier achat aux enchères, bien préparé', description: 'Vos envies, votre budget réel, les bonnes questions. Préparez vos achats aux enchères avec Nautilus.', robots: { index: false, follow: false }, icons: { icon: '/logo.png' } };
export default function RootLayout({ children }: {
    children: React.ReactNode;
}) { return <html lang="fr"><body>{children}</body></html>; }

// app/collection-health.tsx — Collection Health V2

import {
  View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Radius } from '@/lib/tokens';
import { api } from '@/lib/api';
import { PortfolioItem } from '@/lib/types';

// ── Types ──────────────────────────────────────────────────────────────────

interface Dim {
  key: string;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  ql: string;
  qc: string;
  bg: string;
  ic: string;
  pct: number;
  sub: string;
  det: string;
}

interface HealthResult {
  unlocked: Dim[];
  locked: string[];
  status: string;
  diag: string;
  forces: string[];
  actions: { c: string; t: string; s: string }[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function qualityStyle(pct: number) {
  if (pct >= 85) return { ql: 'Excellent',     qc: '#0F6E56', bg: '#E1F5EE', ic: '#0F6E56' };
  if (pct >= 70) return { ql: 'Bonne',         qc: '#0F6E56', bg: '#E1F5EE', ic: '#0F6E56' };
  if (pct >= 55) return { ql: 'Moyenne',       qc: '#854F0B', bg: '#FAEEDA', ic: '#854F0B' };
  if (pct >= 40) return { ql: 'À surveiller',  qc: '#854F0B', bg: '#FAEEDA', ic: '#854F0B' };
  return           { ql: 'Partielle',      qc: '#854F0B', bg: '#FAEEDA', ic: '#854F0B' };
}

function computeHealth(items: PortfolioItem[]): HealthResult {
  const n = items.length;
  if (n === 0) return {
    unlocked: [], locked: [], status: 'Collection vide',
    diag: 'Ajoutez vos premières œuvres pour analyser votre collection.',
    forces: [], actions: [],
  };

  // 1. Suivi — % d'artistes uniques liés à la base (artist_id != null)
  const uniqueArtists = [...new Set(items.map(i => i.artist_name).filter(Boolean))] as string[];
  const linkedArtistNames = new Set(
    items.filter(i => i.artist_id != null).map(i => i.artist_name).filter(Boolean)
  );
  const suiviPct = uniqueArtists.length > 0
    ? Math.round(linkedArtistNames.size / uniqueArtists.length * 100)
    : 50;
  const suiviQ = qualityStyle(suiviPct);

  // 2. Documentation — % items avec doc_urls ou certificat
  const docCount = items.filter(i =>
    (i.document_urls && i.document_urls.length > 0) || i.certificate_of_authenticity
  ).length;
  const docPct = Math.round(docCount / n * 100);
  const docQ = qualityStyle(docPct);
  const incompleteCount = n - docCount;

  const unlocked: Dim[] = [
    {
      key: 'suivi', name: 'Suivi',
      icon: 'notifications-outline',
      ...suiviQ, pct: suiviPct,
      sub: `${linkedArtistNames.size} artiste${linkedArtistNames.size !== 1 ? 's' : ''} suivi${linkedArtistNames.size !== 1 ? 's' : ''}`,
      det: linkedArtistNames.size === uniqueArtists.length
        ? 'Tous vos artistes sont bien surveillés.'
        : `${uniqueArtists.length - linkedArtistNames.size} artiste${uniqueArtists.length - linkedArtistNames.size !== 1 ? 's' : ''} sans suivi actif.`,
    },
    {
      key: 'doc', name: 'Documentation',
      icon: 'document-text-outline',
      ...docQ, pct: docPct,
      sub: `${docCount} œuvre${docCount !== 1 ? 's' : ''} documentée${docCount !== 1 ? 's' : ''}`,
      det: incompleteCount > 0
        ? `${incompleteCount} œuvre${incompleteCount !== 1 ? 's' : ''} sans documents ni certificat.`
        : 'Toutes vos œuvres sont documentées.',
    },
  ];

  const locked: string[] = [];

  // 3. Liquidité — débloquée à 7
  if (n >= 7) {
    const valuedCount = items.filter(i => i.estimated_current_value_eur != null).length;
    const liquidPct = Math.round(valuedCount / n * 100);
    const liquidQ = qualityStyle(liquidPct);
    const illiquid = n - valuedCount;
    unlocked.push({
      key: 'liquid', name: 'Liquidité',
      icon: 'water-outline',
      ...liquidQ, pct: liquidPct,
      sub: illiquid > 0
        ? `${illiquid} œuvre${illiquid !== 1 ? 's' : ''} peu liquide${illiquid !== 1 ? 's' : ''}`
        : 'Liquidité globale bonne',
      det: illiquid > 0
        ? `${illiquid} œuvre${illiquid !== 1 ? 's' : ''} sans comparables disponibles — valorisation difficile.`
        : 'La majorité de votre collection a un marché actif.',
    });
  } else {
    locked.push('Liquidité — dès 7 œuvres');
  }

  // 4. Répartition — débloquée à 10
  if (n >= 10) {
    const artistCounts: Record<string, number> = {};
    items.forEach(i => {
      if (i.artist_name) artistCounts[i.artist_name] = (artistCounts[i.artist_name] || 0) + 1;
    });
    const topEntry = Object.entries(artistCounts).sort(([, a], [, b]) => b - a)[0];
    const maxPct = topEntry ? Math.round(topEntry[1] / n * 100) : 0;
    const repartPct = Math.max(10, 100 - Math.max(0, maxPct - 20) * 2);
    const repartQ = qualityStyle(repartPct);
    unlocked.push({
      key: 'repartit', name: 'Répartition',
      icon: 'grid-outline',
      ...repartQ, pct: repartPct,
      sub: maxPct > 30
        ? `${maxPct}% concentré sur ${topEntry?.[0] ?? 'un artiste'}`
        : 'Bonne diversification',
      det: maxPct > 30
        ? `Forte concentration sur ${topEntry?.[0]}. Explorer des artistes complémentaires serait conseillé.`
        : 'Votre collection est bien répartie entre artistes.',
    });
  } else {
    locked.push('Répartition — dès 10 œuvres');
  }

  // 5. Couverture marché — débloquée à 15
  if (n >= 15) {
    const covCount = items.filter(i => i.estimated_current_value_eur != null).length;
    const covPct = Math.round(covCount / n * 100);
    const covQ = qualityStyle(covPct);
    const noCov = n - covCount;
    unlocked.push({
      key: 'marche', name: 'Couverture marché',
      icon: 'trending-up-outline',
      ...covQ, pct: covPct,
      sub: noCov > 0
        ? `${noCov} artiste${noCov !== 1 ? 's' : ''} sans données`
        : `${covCount} artistes couverts`,
      det: noCov > 0
        ? `${noCov} œuvre${noCov !== 1 ? 's' : ''} sans comparables disponibles.`
        : 'Valorisations fiables sur toute la collection.',
    });
  } else if (n >= 10) {
    locked.push('Couverture marché — dès 15 œuvres');
  }

  // ── Status & diagnostic ──────────────────────────────────────────────────
  const avgPct = unlocked.length > 0
    ? Math.round(unlocked.reduce((acc, d) => acc + d.pct, 0) / unlocked.length)
    : 0;

  let status: string;
  let diag: string;
  if (avgPct >= 80) {
    status = 'Collection excellente';
    const weak = unlocked.find(d => d.pct < 75);
    diag = weak
      ? `Votre collection est bien équilibrée sur les ${unlocked.length} dimensions. ${weak.name} mérite une légère attention.`
      : 'Votre collection est bien équilibrée sur toutes les dimensions. Continuez à l\'enrichir.';
  } else if (avgPct >= 65) {
    status = 'Collection solide';
    const weakDims = unlocked.filter(d => d.pct < 70).map(d => d.name.toLowerCase());
    diag = weakDims.length > 0
      ? `Votre collection est particulièrement forte en ${unlocked.filter(d => d.pct >= 70).map(d => d.name.toLowerCase()).join(' et ')}. ${weakDims.join(' et ')} mérite${weakDims.length > 1 ? 'nt' : ''} votre attention.`
      : 'Votre collection est en bonne forme sur l\'ensemble des dimensions.';
  } else if (avgPct >= 45) {
    status = 'En bonne voie';
    diag = 'Bonne progression. Complétez la documentation et le suivi de vos artistes pour progresser.';
  } else {
    status = 'En développement';
    diag = 'Plusieurs œuvres manquent encore de documents ou de photos. Compléter votre documentation améliorerait significativement la qualité de votre collection.';
  }

  // ── Points forts ──────────────────────────────────────────────────────────
  const forces: string[] = [];
  unlocked.filter(d => d.pct >= 70).forEach(d => {
    if (d.key === 'suivi')    forces.push(`${linkedArtistNames.size} artiste${linkedArtistNames.size !== 1 ? 's' : ''} suivi${linkedArtistNames.size !== 1 ? 's' : ''} avec alertes actives.`);
    if (d.key === 'doc')      forces.push(`Documentation solide sur ${docCount}/${n} œuvres.`);
    if (d.key === 'liquid')   forces.push('Liquidité globale de la collection bonne.');
    if (d.key === 'repartit') forces.push('Bonne diversification entre artistes.');
    if (d.key === 'marche')   forces.push('Couverture marché excellente.');
  });
  if (forces.length === 0) forces.push('Ajoutez des documents et des prix pour renforcer votre collection.');

  // ── Actions ───────────────────────────────────────────────────────────────
  const actions: { c: string; t: string; s: string }[] = [];
  if (incompleteCount > 0 && docPct < 70) {
    actions.push({
      c: '#BA7517',
      t: `Ajouter des documents à ${incompleteCount} œuvre${incompleteCount !== 1 ? 's' : ''}`,
      s: `Documentation · +${Math.min(15 * incompleteCount, 30)} pts`,
    });
  }
  const weakRepartit = unlocked.find(d => d.key === 'repartit' && d.pct < 70);
  if (weakRepartit) {
    actions.push({ c: '#854F0B', t: weakRepartit.sub, s: 'Explorer des artistes complémentaires' });
  }
  if (actions.length === 0 && unlocked.length > 0) {
    const weakest = [...unlocked].sort((a, b) => a.pct - b.pct)[0];
    actions.push({ c: '#BA7517', t: `Améliorer : ${weakest.name}`, s: weakest.sub });
  }

  return { unlocked, locked, status, diag, forces, actions };
}

// ── Screen ─────────────────────────────────────────────────────────────────

export default function CollectionHealthScreen() {
  const router = useRouter();
  const [health, setHealth] = useState<HealthResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.get<PortfolioItem[]>('/api/portfolio/items')
      .then(items => setHealth(computeHealth(items ?? [])))
      .catch(() => setHealth(computeHealth([])))
      .finally(() => setLoading(false));
  }, []);

  const toggleKey = (key: string) =>
    setOpenKeys(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  if (loading) {
    return (
      <View style={s.loader}>
        <ActivityIndicator color={Colors.textPrimary} />
      </View>
    );
  }

  const h = health!;

  return (
    <View style={s.container}>
      {/* ── Topbar ── */}
      <View style={s.topbar}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backTxt}>←</Text>
        </Pressable>
        <Text style={s.tbTitle}>Collection Health</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        {/* ── Status hero ── */}
        <View style={s.statusHero}>
          <Text style={s.statusLabel}>ÉTAT DE VOTRE COLLECTION</Text>
          <Text style={s.statusValue}>{h.status}</Text>
          <Text style={s.diagnostic}>{h.diag}</Text>
        </View>

        {/* ── Les 5 dimensions ── */}
        <Text style={s.secTitle}>Les 5 dimensions</Text>

        <View style={s.dimList}>
          {h.unlocked.map((d, i) => {
            const isOpen = openKeys.has(d.key);
            const isLast = i === h.unlocked.length - 1 && h.locked.length === 0;
            return (
              <Pressable
                key={d.key}
                style={[s.dimRow, !isLast && s.dimRowBorder]}
                onPress={() => toggleKey(d.key)}
              >
                <View style={[s.dimIcon, { backgroundColor: d.bg }]}>
                  <Ionicons name={d.icon} size={15} color={d.ic} />
                </View>

                <View style={s.dimInfo}>
                  <Text style={s.dimName}>{d.name}</Text>
                  <Text style={s.dimSub}>{d.sub}</Text>
                  {isOpen && (
                    <View style={s.dimDet}>
                      <Text style={s.dimDetTxt}>{d.det}</Text>
                    </View>
                  )}
                </View>

                <View style={s.dimRight}>
                  <Text style={[s.dimQl, { color: d.qc }]}>{d.ql}</Text>
                  <View style={s.dimBarBg}>
                    <View style={[s.dimBarFill, { width: `${d.pct}%` as any, backgroundColor: d.qc }]} />
                  </View>
                </View>
              </Pressable>
            );
          })}

          {/* Locked dims */}
          {h.locked.length > 0 && (
            <View style={s.lockedSection}>
              {h.locked.map(l => (
                <View key={l} style={s.lockedRow}>
                  <Ionicons name="lock-closed-outline" size={13} color={Colors.textTertiary} />
                  <Text style={s.lockedTxt}>{l}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ── Points forts ── */}
        <View style={s.panel}>
          <Text style={s.panelTitle}>Points forts</Text>
          {h.forces.map((f, i) => (
            <View key={i} style={s.forceRow}>
              <Ionicons name="checkmark" size={13} color={Colors.green} style={{ marginTop: 1 }} />
              <Text style={s.forceTxt}>{f}</Text>
            </View>
          ))}
        </View>

        {/* ── Action recommandée ── */}
        <View style={s.panel}>
          <Text style={s.panelTitle}>Action recommandée</Text>
          {h.actions.map((a, i) => (
            <Pressable
              key={i}
              style={[s.actionRow, i < h.actions.length - 1 && s.actionRowBorder]}
              onPress={() => router.push('/(tabs)/collection')}
            >
              <View style={[s.actionDot, { backgroundColor: a.c }]} />
              <View style={s.actionBody}>
                <Text style={s.actionTitle}>{a.t}</Text>
                <Text style={s.actionSub}>{a.s}</Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color={Colors.textTertiary} style={{ marginTop: 2 }} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container:       { flex: 1, backgroundColor: Colors.bgPrimary },
  loader:          { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topbar:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingTop: 52, paddingBottom: 11 },
  backBtn:         { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  backTxt:         { fontSize: 20, color: Colors.textSecondary },
  tbTitle:         { flex: 1, fontSize: 15, fontWeight: Fonts.medium, color: Colors.textPrimary },
  scroll:          { flex: 1 },
  content:         { padding: 15, paddingTop: 0 },

  // Status hero
  statusHero:      { textAlign: 'center' as any, paddingVertical: 20, paddingHorizontal: 14, borderBottomWidth: 0.5, borderBottomColor: Colors.borderTertiary, marginBottom: 16, alignItems: 'center' },
  statusLabel:     { fontSize: 10, color: Colors.textTertiary, letterSpacing: 0.7, marginBottom: 7, textTransform: 'uppercase' },
  statusValue:     { fontSize: Fonts['4xl'], fontWeight: Fonts.medium, color: Colors.textPrimary, marginBottom: 8 },
  diagnostic:      { fontSize: Fonts.md, color: Colors.textSecondary, lineHeight: 20, fontStyle: 'italic', textAlign: 'center' },

  // Sections
  secTitle:        { fontSize: Fonts.base, fontWeight: Fonts.medium, color: Colors.textPrimary, marginBottom: 10 },

  // Dimension list
  dimList:         { marginBottom: 16 },
  dimRow:          { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  dimRowBorder:    { borderBottomWidth: 0.5, borderBottomColor: Colors.borderTertiary },
  dimIcon:         { width: 32, height: 32, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  dimInfo:         { flex: 1, minWidth: 0 },
  dimName:         { fontSize: Fonts.md, fontWeight: Fonts.medium, color: Colors.textPrimary, marginBottom: 2 },
  dimSub:          { fontSize: Fonts.sm, color: Colors.textTertiary },
  dimDet:          { backgroundColor: Colors.bgSecondary, borderRadius: Radius.md, padding: 9, paddingHorizontal: 11, marginTop: 6 },
  dimDetTxt:       { fontSize: Fonts.base, color: Colors.textSecondary, lineHeight: 18 },
  dimRight:        { flexShrink: 0, alignItems: 'flex-end' },
  dimQl:           { fontSize: Fonts.base, fontWeight: Fonts.medium, marginBottom: 3 },
  dimBarBg:        { width: 52, height: 3, borderRadius: 2, backgroundColor: Colors.bgSecondary },
  dimBarFill:      { height: 3, borderRadius: 2 },

  // Locked
  lockedSection:   { paddingTop: 8, borderTopWidth: 0.5, borderTopColor: Colors.borderTertiary },
  lockedRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  lockedTxt:       { fontSize: Fonts.base, color: Colors.textTertiary },

  // Panels
  panel:           { borderWidth: 0.5, borderColor: Colors.borderTertiary, borderRadius: Radius.lg, padding: 13, paddingHorizontal: 14, marginBottom: 12 },
  panelTitle:      { fontSize: Fonts.base, fontWeight: Fonts.medium, color: Colors.textPrimary, marginBottom: 9 },
  forceRow:        { flexDirection: 'row', alignItems: 'flex-start', gap: 7, paddingVertical: 5 },
  forceTxt:        { flex: 1, fontSize: Fonts.base, color: Colors.textSecondary, lineHeight: 18 },
  actionRow:       { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 8 },
  actionRowBorder: { borderBottomWidth: 0.5, borderBottomColor: Colors.borderTertiary },
  actionDot:       { width: 7, height: 7, borderRadius: 4, marginTop: 4, flexShrink: 0 },
  actionBody:      { flex: 1 },
  actionTitle:     { fontSize: Fonts.base, fontWeight: Fonts.medium, color: Colors.textPrimary, marginBottom: 1 },
  actionSub:       { fontSize: Fonts.sm, color: Colors.textTertiary },
});

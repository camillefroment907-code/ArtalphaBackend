// app/artwork/[id].tsx — Artwork Detail V3

import {
  View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Radius } from '@/lib/tokens';
import { marketService, AuctionLot } from '@/services/api';

// ── Types ──────────────────────────────────────────────────────────────────

type Tab = 'infos' | 'valeur' | 'comparables' | 'docs' | 'larry';

const TABS: { key: Tab; label: string }[] = [
  { key: 'infos',       label: 'Infos' },
  { key: 'valeur',      label: 'Valeur' },
  { key: 'comparables', label: 'Comparables' },
  { key: 'docs',        label: 'Documents' },
  { key: 'larry',       label: 'Larry' },
];

// ── Helpers ────────────────────────────────────────────────────────────────

/** Generate a formatted histoire text with **bold** markers */
function getHistoire(lot: AuctionLot): string {
  const medium = lot.medium?.toLowerCase() || 'ce lot';
  const artist = lot.artist_name || 'cet artiste';
  let text = '';

  if (lot.auction_house && lot.auction_date) {
    const d = new Date(lot.auction_date);
    const dateStr = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    text += `Mis en vente chez **${lot.auction_house}** en **${dateStr}**, ce ${medium}`;
  } else if (lot.auction_house) {
    text += `Mis en vente chez **${lot.auction_house}**, ce ${medium}`;
  } else {
    text = `Ce lot`;
  }

  text += ` appartient à l'œuvre de **${artist}**.`;

  if (lot.lot_performance === 'sold' && lot.price_result_eur != null && lot.estimate_low_eur != null && lot.estimate_low_eur > 0) {
    const ratio = Math.round((lot.price_result_eur / lot.estimate_low_eur - 1) * 100);
    if (ratio > 20) {
      text += ` Adjugé **+${ratio}% au-dessus de la mise à prix** — forte demande pour cet artiste.`;
    }
  }

  return text;
}

/** Render text with **bold** inline markers */
function BoldText({ children, style }: { children: string; style?: object }) {
  const parts = children.split(/(\*\*[^*]+\*\*)/g);
  return (
    <Text style={style}>
      {parts.map((p, i) =>
        p.startsWith('**') ? (
          <Text key={i} style={{ fontWeight: '500' as const, color: Colors.textPrimary, fontStyle: 'normal' }}>
            {p.slice(2, -2)}
          </Text>
        ) : (
          <Text key={i}>{p}</Text>
        )
      )}
    </Text>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────

export default function ArtworkDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<AuctionLot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('infos');

  useEffect(() => {
    if (!id) return;
    marketService.lotDetail(id)
      .then(setItem)
      .catch(() => setError('Impossible de charger ce lot.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <View style={s.loader}><ActivityIndicator color={Colors.textPrimary} /></View>;
  }

  if (error || !item) {
    return (
      <View style={s.loader}>
        <Text style={s.errTxt}>{error ?? 'Œuvre introuvable.'}</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 10 }}>
          <Text style={s.errBack}>← Retour</Text>
        </Pressable>
      </View>
    );
  }

  // ── Computed values ──────────────────────────────────────────────────────
  const artistDisplay = (item.artist_name ?? '').toUpperCase();
  const titleLine     = item.title ?? '—';
  const mediumLine    = [item.medium, item.dimensions].filter(Boolean).join(' · ');
  const isSold        = item.lot_performance === 'sold';
  const isValued      = isSold && item.price_result_eur != null;
  const isFollowed    = item.artist_id != null;

  // Mise à prix = estimate_low_eur ; prix final = price_result_eur
  const miseAPrix = item.estimate_low_eur ?? null;
  const prixFinal = item.price_result_eur ?? null;

  const gainPct = (isValued && miseAPrix != null && miseAPrix > 0)
    ? Math.round((prixFinal! - miseAPrix) / miseAPrix * 100)
    : null;

  // Frais acheteur ≈ 25 % du prix marteau
  const fraisAcheteur = isValued ? Math.round(prixFinal! * 0.25) : null;

  const purchaseDateShort = item.auction_date
    ? new Date(item.auction_date).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })
    : null;

  const docCount  = 0; // AuctionLot has no attached documents
  const histoire = getHistoire(item);

  const larryPrompt = `Analyser le marché de ${item.artist_name || 'cet artiste'} et ce lot`;

  return (
    <View style={s.container}>
      <ScrollView bounces style={s.scroll}>
        {/* ── Hero ── */}
        <View style={s.hero}>
          <Text style={s.heroEmoji}>🎨</Text>

          {/* Overlay */}
          <View style={s.heroOverlay}>
            {!!artistDisplay && <Text style={s.heroArtist}>{artistDisplay}</Text>}
            <Text style={s.heroTitle}>{titleLine || '—'}</Text>
            {!!mediumLine && <Text style={s.heroMedium}>{mediumLine}</Text>}
          </View>

          {/* Back */}
          <Pressable style={s.heroBk} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={17} color="#fff" />
          </Pressable>

          {/* Actions */}
          <View style={s.heroAct}>
            <Pressable style={s.heroBtn}>
              <Ionicons name="heart-outline" size={15} color="#fff" />
            </Pressable>
            <Pressable style={s.heroBtn}>
              <Ionicons name="ellipsis-vertical" size={15} color="#fff" />
            </Pressable>
          </View>
        </View>

        {/* ── Histoire de l'œuvre ── */}
        <View style={s.histoire}>
          <View style={s.histLabel}>
            <Ionicons name="book-outline" size={12} color={Colors.textTertiary} />
            <Text style={s.histLabelTxt}>HISTOIRE DE L'ŒUVRE</Text>
          </View>
          <BoldText style={s.histText}>{histoire}</BoldText>
        </View>

        {/* ── Tabs ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabsWrap} contentContainerStyle={s.tabsContent}>
          {TABS.map(t => (
            <Pressable
              key={t.key}
              style={[s.tab, activeTab === t.key && s.tabOn]}
              onPress={() => setActiveTab(t.key)}
            >
              <Text style={[s.tabTxt, activeTab === t.key && s.tabTxtOn]}>{t.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* ── Tab Content ── */}
        <View style={s.tabContent}>
          {activeTab === 'infos' && (
            <>
              {/* Tags */}
              <View style={s.tags}>
                {isValued && (
                  <View style={[s.tag, s.tagGreen]}>
                    <Ionicons name="trending-up-outline" size={11} color="#085041" />
                    <Text style={s.tagTxtGreen}>Valorisée</Text>
                  </View>
                )}
                {isFollowed && (
                  <View style={[s.tag, s.tagBlue]}>
                    <Ionicons name="notifications-outline" size={11} color="#0C447C" />
                    <Text style={s.tagTxtBlue}>Suivie</Text>
                  </View>
                )}
                {docCount > 0 && (
                  <View style={[s.tag, s.tagGray]}>
                    <Ionicons name="attach-outline" size={11} color={Colors.textSecondary} />
                    <Text style={s.tagTxtGray}>{docCount} doc{docCount > 1 ? 's' : ''}</Text>
                  </View>
                )}
              </View>

              {/* 3-col stats */}
              <View style={s.stats}>
                <View style={s.stat}>
                  <Text style={s.statL}>Mise à prix</Text>
                  <Text style={s.statV}>
                    {miseAPrix != null
                      ? `${Math.round(miseAPrix).toLocaleString('fr-FR')} €`
                      : '—'}
                  </Text>
                  <Text style={s.statD}>{purchaseDateShort ?? '—'}</Text>
                </View>
                <View style={s.stat}>
                  <Text style={s.statL}>Prix final</Text>
                  <Text style={[s.statV, isSold && { color: '#0F6E56' }]}>
                    {prixFinal != null
                      ? `${Math.round(prixFinal).toLocaleString('fr-FR')} €`
                      : isSold ? '—' : 'N/A'}
                  </Text>
                  {gainPct != null && (
                    <Text style={[s.statD, { color: gainPct >= 0 ? '#0F6E56' : Colors.error }]}>
                      {gainPct >= 0 ? '+' : ''}{gainPct}%
                    </Text>
                  )}
                </View>
                <View style={s.stat}>
                  <Text style={s.statL}>Frais acq.</Text>
                  <Text style={s.statV}>
                    {fraisAcheteur != null
                      ? `${fraisAcheteur.toLocaleString('fr-FR')} €`
                      : '—'}
                  </Text>
                  <Text style={s.statD}>≈ 25%</Text>
                </View>
              </View>

              {/* Info rows */}
              <InfoRow label="Artiste"          value={item.artist_name ?? '—'} />
              <InfoRow label="Medium"           value={item.medium ?? '—'} />
              <InfoRow label="Dimensions"       value={item.dimensions ?? '—'} />
              <InfoRow label="Maison de vente"  value={item.auction_house ?? '—'} />
              <InfoRow label="Provenance"       value={item.provenance ?? '—'} last />
            </>
          )}

          {activeTab === 'valeur' && (
            <View style={s.comingSoon}>
              {isSold && prixFinal != null ? (
                <>
                  <View style={s.valCard}>
                    <Text style={s.valLabel}>Prix d'adjudication</Text>
                    <Text style={s.valAmt}>
                      {Math.round(prixFinal).toLocaleString('fr-FR')} €
                    </Text>
                    {gainPct != null && (
                      <Text style={[s.valGain, { color: gainPct >= 0 ? '#0F6E56' : Colors.error }]}>
                        {gainPct >= 0 ? '+' : ''}{gainPct}% vs mise à prix
                      </Text>
                    )}
                    {item.auction_date && (
                      <Text style={s.valDate}>
                        {new Date(item.auction_date).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                      </Text>
                    )}
                  </View>
                  <InfoRow label="Mise à prix" value={miseAPrix != null ? `${Math.round(miseAPrix).toLocaleString('fr-FR')} €` : '—'} />
                  <InfoRow label="Frais acheteur (≈ 25%)" value={fraisAcheteur != null ? `${fraisAcheteur.toLocaleString('fr-FR')} €` : '—'} />
                  <InfoRow label="Coût total acquéreur" value={
                    fraisAcheteur != null ? `${Math.round(prixFinal + fraisAcheteur).toLocaleString('fr-FR')} €` : '—'
                  } last />
                </>
              ) : (
                <Text style={s.soonTxt}>
                  {item.lot_performance === 'unsold' ? 'Lot non vendu.' : 'Résultat non disponible.'}
                </Text>
              )}
            </View>
          )}

          {activeTab === 'comparables' && (
            <View style={s.comingSoon}>
              <Text style={s.soonTxt}>Comparables — bientôt disponible.</Text>
            </View>
          )}

          {activeTab === 'docs' && (
            <>
              <InfoRow label="Maison de vente" value={item.auction_house ?? '—'} />
              <InfoRow label="Source"          value={item.source ?? '—'} />
              <InfoRow label="Provenance"      value={item.provenance ?? '—'} last />
            </>
          )}

          {activeTab === 'larry' && (
            <View style={s.comingSoon}>
              <Text style={s.soonTxt}>Posez une question à Larry sur cette œuvre.</Text>
              <Pressable
                style={s.larryBtn}
                onPress={() => router.push({ pathname: '/(tabs)/larry', params: { q: larryPrompt } })}
              >
                <Text style={s.larryBtnTxt}>Ouvrir Larry →</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Bottom bar ── */}
      <View style={s.bottomBar}>
        <Pressable
          style={s.btnSecondary}
          onPress={() => item.artist_id && router.push(`/artist/${item.artist_id}`)}
          disabled={!item.artist_id}
        >
          <Text style={s.btnSecondaryTxt}>Voir artiste</Text>
        </Pressable>
        <Pressable
          style={s.btnPrimary}
          onPress={() => router.push({ pathname: '/(tabs)/larry', params: { q: larryPrompt } })}
        >
          <Text style={s.btnPrimaryTxt}>Vendre ↗</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[s.infoRow, last && s.infoRowLast]}>
      <Text style={s.infoL}>{label}</Text>
      <Text style={s.infoV}>{value}</Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const TOP_OFFSET = Platform.OS === 'ios' ? 52 : 36;

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },
  loader:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errTxt:    { fontSize: Fonts.base, color: Colors.textSecondary },
  errBack:   { fontSize: Fonts.base, color: Colors.textTertiary },
  scroll:    { flex: 1 },

  // Hero
  hero:        { height: 220, backgroundColor: Colors.bgSecondary, alignItems: 'center', justifyContent: 'center' },
  heroEmoji:   { fontSize: 72, opacity: 0.82 },
  heroOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 10, paddingHorizontal: 14, backgroundColor: 'rgba(0,0,0,0.48)' },
  heroArtist:  { fontSize: 10, color: 'rgba(255,255,255,0.7)', letterSpacing: 0.5, marginBottom: 2 },
  heroTitle:   { fontSize: 16, fontWeight: Fonts.medium, color: '#fff', lineHeight: 20 },
  heroMedium:  { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  heroBk:      { position: 'absolute', top: TOP_OFFSET, left: 11, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.28)', alignItems: 'center', justifyContent: 'center' },
  heroAct:     { position: 'absolute', top: TOP_OFFSET, right: 11, flexDirection: 'row', gap: 7 },
  heroBtn:     { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.28)', alignItems: 'center', justifyContent: 'center' },

  // Histoire
  histoire:     { padding: 14, paddingHorizontal: 15, borderBottomWidth: 0.5, borderBottomColor: Colors.borderTertiary },
  histLabel:    { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 7 },
  histLabelTxt: { fontSize: 10, color: Colors.textTertiary, letterSpacing: 0.6 },
  histText:     { fontSize: Fonts.md, color: Colors.textSecondary, lineHeight: 21, fontStyle: 'italic' },

  // Tabs
  tabsWrap:    { borderBottomWidth: 0.5, borderBottomColor: Colors.borderTertiary },
  tabsContent: { paddingHorizontal: 14 },
  tab:         { paddingVertical: 9, paddingHorizontal: 10, borderBottomWidth: 2, borderBottomColor: 'transparent', marginBottom: -1 },
  tabOn:       { borderBottomColor: Colors.textPrimary },
  tabTxt:      { fontSize: Fonts.md, color: Colors.textTertiary },
  tabTxtOn:    { color: Colors.textPrimary, fontWeight: Fonts.medium },

  // Tab content
  tabContent: { padding: 14 },

  // Tags
  tags:        { flexDirection: 'row', gap: 5, flexWrap: 'wrap', marginBottom: 12 },
  tag:         { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 4, paddingHorizontal: 9, borderRadius: 20 },
  tagGreen:    { backgroundColor: '#E1F5EE' },
  tagBlue:     { backgroundColor: '#E6F1FB' },
  tagGray:     { backgroundColor: Colors.bgSecondary },
  tagTxtGreen: { fontSize: Fonts.sm, color: '#085041' },
  tagTxtBlue:  { fontSize: Fonts.sm, color: '#0C447C' },
  tagTxtGray:  { fontSize: Fonts.sm, color: Colors.textSecondary },

  // 3-col stats
  stats:  { flexDirection: 'row', gap: 8, marginBottom: 13 },
  stat:   { flex: 1, backgroundColor: Colors.bgSecondary, borderRadius: Radius.md, padding: 9, paddingHorizontal: 10 },
  statL:  { fontSize: 10, color: Colors.textTertiary, marginBottom: 3 },
  statV:  { fontSize: Fonts.lg, fontWeight: Fonts.medium, color: Colors.textPrimary },
  statD:  { fontSize: 10, marginTop: 2, color: Colors.textTertiary },

  // Info rows
  infoRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: Colors.borderTertiary },
  infoRowLast: { borderBottomWidth: 0 },
  infoL:       { fontSize: Fonts.base, color: Colors.textSecondary },
  infoV:       { fontSize: Fonts.base, fontWeight: Fonts.medium, color: Colors.textPrimary, maxWidth: '55%', textAlign: 'right' },

  // Valeur tab
  valCard:  { borderRadius: Radius.lg, backgroundColor: '#E1F5EE', padding: 14, marginBottom: 14 },
  valLabel: { fontSize: Fonts.sm, color: '#085041', marginBottom: 4 },
  valAmt:   { fontSize: 28, fontWeight: Fonts.medium, color: '#0F6E56', marginBottom: 4 },
  valGain:  { fontSize: Fonts.base, fontWeight: Fonts.medium, marginBottom: 3 },
  valDate:  { fontSize: Fonts.xs, color: Colors.green },

  // Coming soon / Larry
  comingSoon: { paddingVertical: 8 },
  soonTxt:    { fontSize: Fonts.base, color: Colors.textSecondary, lineHeight: 18 },
  larryBtn:   { marginTop: 14, alignSelf: 'flex-start', paddingVertical: 10, paddingHorizontal: 16, borderRadius: Radius.md, backgroundColor: Colors.textPrimary },
  larryBtnTxt:{ fontSize: Fonts.md, color: Colors.bgPrimary, fontWeight: Fonts.medium },

  // Bottom bar
  bottomBar:      { flexDirection: 'row', gap: 8, padding: 10, paddingHorizontal: 14, borderTopWidth: 0.5, borderTopColor: Colors.borderTertiary },
  btnSecondary:   { flex: 1, padding: 10, borderRadius: Radius.md, borderWidth: 0.5, borderColor: Colors.borderSecondary, alignItems: 'center' },
  btnSecondaryTxt:{ fontSize: Fonts.md, color: Colors.textSecondary },
  btnPrimary:     { flex: 1, padding: 10, borderRadius: Radius.md, backgroundColor: Colors.textPrimary, alignItems: 'center' },
  btnPrimaryTxt:  { fontSize: Fonts.md, fontWeight: Fonts.medium, color: Colors.bgPrimary },
});

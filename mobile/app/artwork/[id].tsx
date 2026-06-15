// app/artwork/[id].tsx — Artwork Detail V3

import {
  View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Radius } from '@/lib/tokens';
import { PortfolioItem } from '@/lib/types';
import { api } from '@/lib/api';

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
function getHistoire(item: PortfolioItem): string {
  const medium = item.medium?.toLowerCase() || 'cette œuvre';
  const artist = item.artist_name || 'cet artiste';
  let text = '';

  if (item.purchase_auction_house && item.purchase_date) {
    const d = new Date(item.purchase_date);
    const dateStr = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    text += `Acquise chez **${item.purchase_auction_house} en ${dateStr}**, cette ${medium}`;
  } else if (item.purchase_auction_house) {
    text += `Acquise chez **${item.purchase_auction_house}**, cette ${medium}`;
  } else {
    text = `Cette ${medium.charAt(0).toUpperCase() + medium.slice(1)}`;
  }

  if (item.year_created) {
    const decade = Math.floor(item.year_created / 10) * 10;
    text += ` appartient à la période des **années ${decade}** de **${artist}**`;
  } else {
    text += ` appartient à la collection de **${artist}**`;
  }
  text += '.';

  if (
    item.estimated_current_value_eur != null &&
    item.purchase_price_eur != null &&
    item.estimated_current_value_eur > item.purchase_price_eur
  ) {
    const gain = Math.round(
      (item.estimated_current_value_eur - item.purchase_price_eur) / item.purchase_price_eur * 100
    );
    text += ` Les œuvres de ce format bénéficient d'une forte demande sur le marché secondaire — valeur en hausse de **+${gain}%** depuis l'acquisition.`;
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
  const [item, setItem] = useState<PortfolioItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('infos');

  useEffect(() => {
    if (!id) return;
    api.get<PortfolioItem>(`/api/portfolio/items/${id}`)
      .then(setItem)
      .catch(() => setError('Impossible de charger cette œuvre.'))
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
  const artistDisplay = (item.artist_name_display ?? item.artist_name ?? '').toUpperCase();
  const titleLine = [item.title, item.year_created].filter(Boolean).join(', ');
  const mediumLine = [item.medium, item.dimensions].filter(Boolean).join(' · ');
  const docCount = item.document_urls?.length ?? 0;
  const isValued  = item.estimated_current_value_eur != null;
  const isFollowed = item.artist_id != null;

  const gainPct = isValued && item.purchase_price_eur != null
    ? Math.round((item.estimated_current_value_eur! - item.purchase_price_eur) / item.purchase_price_eur * 100)
    : null;

  const purchaseDateShort = item.purchase_date
    ? new Date(item.purchase_date).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })
    : null;

  const histoire = getHistoire(item);

  const larryPrompt = `Analyser le meilleur moment pour vendre ${item.title || item.artist_name || 'cette œuvre'}`;

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
                  <Text style={s.statL}>Acquise</Text>
                  <Text style={s.statV}>
                    {item.purchase_price_eur != null
                      ? `${Math.round(item.purchase_price_eur).toLocaleString('fr-FR')} €`
                      : '—'}
                  </Text>
                  <Text style={s.statD}>{purchaseDateShort ?? '—'}</Text>
                </View>
                <View style={s.stat}>
                  <Text style={s.statL}>Valeur est.</Text>
                  <Text style={[s.statV, isValued && { color: '#0F6E56' }]}>
                    {isValued
                      ? `${Math.round(item.estimated_current_value_eur!).toLocaleString('fr-FR')} €`
                      : '—'}
                  </Text>
                  {gainPct != null && (
                    <Text style={[s.statD, { color: gainPct >= 0 ? '#0F6E56' : Colors.error }]}>
                      {gainPct >= 0 ? '+' : ''}{gainPct}%
                    </Text>
                  )}
                </View>
                <View style={s.stat}>
                  <Text style={s.statL}>Comparables</Text>
                  <Text style={s.statV}>
                    {item.estimation_confidence != null ? Math.round(item.estimation_confidence * 10) : '—'}
                  </Text>
                  <Text style={s.statD}>24 mois</Text>
                </View>
              </View>

              {/* Info rows */}
              <InfoRow label="Artiste"     value={item.artist_name ?? '—'} />
              <InfoRow label="Année"       value={item.year_created?.toString() ?? '—'} />
              <InfoRow label="Medium"      value={item.medium ?? '—'} />
              <InfoRow label="Dimensions"  value={item.dimensions ?? '—'} />
              <InfoRow label="Provenance"  value={item.provenance ?? item.purchase_auction_house ?? '—'} last />
            </>
          )}

          {activeTab === 'valeur' && (
            <View style={s.comingSoon}>
              {isValued ? (
                <>
                  <View style={s.valCard}>
                    <Text style={s.valLabel}>Valeur estimée</Text>
                    <Text style={s.valAmt}>
                      {Math.round(item.estimated_current_value_eur!).toLocaleString('fr-FR')} €
                    </Text>
                    {gainPct != null && (
                      <Text style={[s.valGain, { color: gainPct >= 0 ? '#0F6E56' : Colors.error }]}>
                        {gainPct >= 0 ? '+' : ''}{gainPct}% depuis l'acquisition
                      </Text>
                    )}
                    {item.last_estimated_at && (
                      <Text style={s.valDate}>
                        Mis à jour le {new Date(item.last_estimated_at).toLocaleDateString('fr-FR')}
                      </Text>
                    )}
                  </View>
                  {item.purchase_price_eur != null && (
                    <>
                      <InfoRow label="Prix d'acquisition" value={`${Math.round(item.purchase_price_eur).toLocaleString('fr-FR')} €`} />
                      <InfoRow label="Plus-value estimée" value={
                        gainPct != null
                          ? `${Math.round(item.estimated_current_value_eur! - item.purchase_price_eur).toLocaleString('fr-FR')} €`
                          : '—'
                      } last />
                    </>
                  )}
                </>
              ) : (
                <Text style={s.soonTxt}>Valorisation non disponible pour cette œuvre.</Text>
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
              <InfoRow label="Certificat d'authenticité" value={item.certificate_of_authenticity ? 'Oui' : 'Non'} />
              <InfoRow label="Documents" value={docCount > 0 ? `${docCount} fichier${docCount > 1 ? 's' : ''}` : 'Aucun'} />
              <InfoRow label="État de conservation" value={item.condition ?? '—'} last />
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
          onPress={() => router.push({
            pathname: '/add-artwork/manual',
            params: {
              artistName: item.artist_name ?? '',
              title:      item.title ?? '',
              year:       item.year_created?.toString() ?? '',
              medium:     item.medium ?? '',
            },
          })}
        >
          <Text style={s.btnSecondaryTxt}>Modifier</Text>
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

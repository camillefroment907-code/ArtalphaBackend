// app/artist/[id].tsx — Artist Profile

import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, FontSize, Spacing, Radius, Shadow } from '@/constants/theme';
import { artistService, ArtistProfile, ArtistScore, AuctionLot } from '@/services/api';

function fmtPrice(n?: number | null): string {
  if (!n) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M€`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k€`;
  return `${Math.round(n)}€`;
}

function ScoreBar({ label, value }: { label: string; value?: number | null }) {
  const pct = value != null ? Math.min(Math.max(value, 0), 100) : 0;
  const color = pct >= 70 ? Colors.green : pct >= 40 ? Colors.warning : Colors.error;
  return (
    <View style={sb.row}>
      <Text style={sb.label}>{label}</Text>
      <View style={sb.track}>
        <View style={[sb.fill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={[sb.val, { color }]}>{value != null ? Math.round(value) : '—'}</Text>
    </View>
  );
}

const sb = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  label: { fontSize: FontSize.sm, fontFamily: FontFamily.sans, color: Colors.textSecondary, width: 90 },
  track: { flex: 1, height: 4, backgroundColor: Colors.bgElevated, borderRadius: 2, overflow: 'hidden' },
  fill:  { height: '100%', borderRadius: 2 },
  val:   { width: 28, fontSize: FontSize.sm, fontFamily: FontFamily.sansBold, textAlign: 'right' },
});

const TOP = Platform.OS === 'ios' ? 52 : 36;

export default function ArtistProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [artist,  setArtist]  = useState<ArtistProfile | null>(null);
  const [score,   setScore]   = useState<ArtistScore | null>(null);
  const [lots,    setLots]    = useState<AuctionLot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      artistService.get(id),
      artistService.score(id).catch(() => null),
      artistService.lots(id, { limit: 10 }).catch(() => [] as AuctionLot[]),
    ])
      .then(([a, sc, ls]) => {
        setArtist(a);
        setScore(sc);
        setLots(Array.isArray(ls) ? ls : []);
      })
      .catch(() => setError('Impossible de charger cet artiste.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <View style={s.loader}><ActivityIndicator color={Colors.gold} /></View>;

  if (error || !artist) {
    return (
      <View style={s.loader}>
        <Text style={s.errTxt}>{error ?? 'Artiste introuvable.'}</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={s.errBack}>← Retour</Text>
        </Pressable>
      </View>
    );
  }

  const initial     = artist.name.charAt(0).toUpperCase();
  const lifespan    = [artist.birth_year, artist.death_year].filter(Boolean).join('–');
  const compositeScore = score?.composite_score;
  const scoreColor  = compositeScore != null
    ? compositeScore >= 70 ? Colors.green : compositeScore >= 40 ? Colors.warning : Colors.error
    : Colors.textTertiary;

  const soldLots    = lots.filter((l) => l.lot_performance === 'sold');
  const avgPrice    = soldLots.length > 0
    ? soldLots.reduce((s, l) => s + (l.price_result_eur ?? 0), 0) / soldLots.length
    : null;

  return (
    <View style={s.root}>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <View style={s.header}>
          <Pressable style={[s.backBtn, { top: TOP }]} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={16} color={Colors.textOnDark} />
          </Pressable>

          <View style={s.avatar}>
            <Text style={s.avatarInitial}>{initial}</Text>
          </View>

          <Text style={s.artistName}>{artist.name}</Text>
          {(artist.nationality || lifespan) && (
            <Text style={s.artistMeta}>
              {[artist.nationality, lifespan].filter(Boolean).join(' · ')}
            </Text>
          )}

          {compositeScore != null && (
            <View style={[s.scorePill, { borderColor: scoreColor }]}>
              <Text style={[s.scorePillTxt, { color: scoreColor }]}>
                Score {Math.round(compositeScore)}/100
              </Text>
            </View>
          )}
        </View>

        {/* ── Marché stats ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Données de marché</Text>
          <View style={s.statsRow}>
            <View style={s.stat}>
              <Text style={s.statV}>{fmtPrice(artist.median_price_eur)}</Text>
              <Text style={s.statL}>Prix médian</Text>
            </View>
            <View style={s.stat}>
              <Text style={s.statV}>
                {artist.sell_through_rate != null ? `${Math.round(artist.sell_through_rate * 100)}%` : '—'}
              </Text>
              <Text style={s.statL}>Taux de vente</Text>
            </View>
            <View style={s.stat}>
              <Text style={s.statV}>{artist.total_lots ?? '—'}</Text>
              <Text style={s.statL}>Lots totaux</Text>
            </View>
          </View>
          <View style={s.statsRow}>
            <View style={s.stat}>
              <Text style={s.statV}>{fmtPrice(artist.min_price_eur)}</Text>
              <Text style={s.statL}>Minimum</Text>
            </View>
            <View style={s.stat}>
              <Text style={s.statV}>{fmtPrice(artist.max_price_eur)}</Text>
              <Text style={s.statL}>Maximum</Text>
            </View>
            <View style={s.stat}>
              <Text style={s.statV}>{fmtPrice(avgPrice)}</Text>
              <Text style={s.statL}>Moyenne ventes</Text>
            </View>
          </View>
        </View>

        {/* ── Score detail ── */}
        {score && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Analyse Nautilus</Text>
            <ScoreBar label="Liquidité"    value={score.liquidity_score} />
            <ScoreBar label="Momentum"     value={score.momentum_score} />
            <ScoreBar label="Profondeur"   value={score.market_depth_score} />
            <ScoreBar label="Régularité"   value={score.consistency_score} />
          </View>
        )}

        {/* ── Ventes récentes ── */}
        {lots.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Ventes récentes</Text>
            {lots.map((lot) => (
              <Pressable
                key={lot.id}
                style={s.lotRow}
                onPress={() => router.push(`/artwork/${lot.id}`)}
              >
                <View style={s.lotInfo}>
                  <Text style={s.lotTitle} numberOfLines={1}>{lot.title ?? '—'}</Text>
                  <Text style={s.lotMeta}>
                    {lot.auction_house ?? ''}{lot.auction_date ? ` · ${lot.auction_date.slice(0, 7)}` : ''}
                  </Text>
                </View>
                <Text style={[
                  s.lotPrice,
                  lot.lot_performance === 'sold' ? { color: Colors.green } : { color: Colors.textTertiary }
                ]}>
                  {fmtPrice(lot.price_result_eur)}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* ── Bio ── */}
        {artist.bio && (
          <View style={[s.section, { paddingBottom: Spacing.lg }]}>
            <Text style={s.sectionTitle}>Biographie</Text>
            <Text style={s.bio}>{artist.bio}</Text>
          </View>
        )}

      </ScrollView>

      {/* ── Bottom CTA ── */}
      <View style={s.bottomBar}>
        <Pressable
          style={s.bottomBtn}
          onPress={() => router.push({ pathname: '/(tabs)/larry', params: { q: `Analyse de ${artist.name} : opportunité d'achat ?` } })}
        >
          <Text style={s.bottomBtnTxt}>Analyser avec Larry →</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.bg },
  scroll: { flex: 1 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg },
  errTxt:  { fontSize: FontSize.base, fontFamily: FontFamily.sans, color: Colors.textSecondary, marginBottom: 8 },
  errBack: { fontSize: FontSize.sm, fontFamily: FontFamily.sans, color: Colors.textTertiary },

  // Header
  header: {
    backgroundColor: Colors.bgDark,
    paddingTop: 90,
    paddingBottom: Spacing.lg,
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    position: 'relative',
  },
  backBtn: {
    position: 'absolute',
    left: 14,
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  avatarInitial: { fontSize: FontSize['3xl'], fontFamily: FontFamily.serifBold, color: Colors.gold },
  artistName:    { fontSize: FontSize['3xl'], fontFamily: FontFamily.serifBold, color: Colors.textOnDark, letterSpacing: -0.3, textAlign: 'center', marginBottom: 4 },
  artistMeta:    { fontSize: FontSize.sm, fontFamily: FontFamily.sans, color: Colors.textOnDarkMuted, marginBottom: 12 },
  scorePill: {
    paddingVertical: 4,
    paddingHorizontal: 14,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  scorePillTxt: { fontSize: FontSize.sm, fontFamily: FontFamily.sansSemibold },

  // Sections
  section:      { paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  sectionTitle: { fontSize: FontSize.sm, fontFamily: FontFamily.sansSemibold, color: Colors.textTertiary, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: Spacing.sm },

  // Stats
  statsRow:  { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  stat:      { flex: 1, backgroundColor: Colors.bgElevated, borderRadius: Radius.md, padding: 10, alignItems: 'center' },
  statV:     { fontSize: FontSize.lg, fontFamily: FontFamily.serifBold, color: Colors.textPrimary, marginBottom: 2 },
  statL:     { fontSize: FontSize.xs, fontFamily: FontFamily.sans, color: Colors.textTertiary, textAlign: 'center' },

  // Lots
  lotRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  lotInfo:  { flex: 1 },
  lotTitle: { fontSize: FontSize.base, fontFamily: FontFamily.sansMedium, color: Colors.textPrimary },
  lotMeta:  { fontSize: FontSize.xs, fontFamily: FontFamily.sans, color: Colors.textTertiary, marginTop: 2 },
  lotPrice: { fontSize: FontSize.base, fontFamily: FontFamily.sansBold, marginLeft: 8 },

  // Bio
  bio: { fontSize: FontSize.base, fontFamily: FontFamily.sans, color: Colors.textSecondary, lineHeight: FontSize.base * 1.6 },

  // Bottom bar
  bottomBar: { padding: Spacing.sm, paddingHorizontal: Spacing.md, borderTopWidth: 0.5, borderTopColor: Colors.border, backgroundColor: Colors.bg },
  bottomBtn: { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center', ...Shadow.md },
  bottomBtnTxt: { fontSize: FontSize.base, fontFamily: FontFamily.sansSemibold, color: Colors.textOnDark },
});

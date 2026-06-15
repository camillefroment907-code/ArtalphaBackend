// app/paywall.tsx — Écran de mise à niveau (paywall)

import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Fonts, Radius } from '@/lib/tokens';

// ── Plan definitions ──────────────────────────────────────────────────────────

const PLANS = [
  {
    id: 'starter',
    name: 'Collector',
    price: '29€',
    period: '/mois',
    description: 'Pour les collectionneurs actifs',
    badge: null,
    features: [
      'Collection illimitée',
      'Estimations marché en temps réel',
      'Larry — 50 questions/mois',
      'Alertes ventes & marché',
      'Collection Health complète',
    ],
  },
  {
    id: 'investor',
    name: 'Investor',
    price: '79€',
    period: '/mois',
    description: 'Pour les collections > 50 œuvres',
    badge: 'POPULAIRE',
    features: [
      'Tout Collector, plus :',
      'Larry illimité',
      'Rapports PDF téléchargeables',
      'Comparables de vente détaillés',
      'Accès API pour votre comptable',
      'Support prioritaire',
    ],
  },
  {
    id: 'pro',
    name: 'Family Office',
    price: 'Sur devis',
    period: '',
    description: 'Pour les collections institutionnelles',
    badge: null,
    features: [
      'Tout Investor, plus :',
      'Multi-utilisateurs & rôles',
      'Intégration comptable sur mesure',
      'Rapports de transmission',
      'Account manager dédié',
    ],
  },
] as const;

// ── Screen ────────────────────────────────────────────────────────────────────

export default function PaywallScreen() {
  const router = useRouter();

  const handleUpgrade = (planId: string) => {
    // Web checkout — Stripe hosted page
    Linking.openURL(`https://get-nautilus.com/upgrade?plan=${planId}`);
  };

  return (
    <View style={s.container}>

      {/* ── Header ── */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.closeBtn}>
          <Text style={s.closeTxt}>✕</Text>
        </Pressable>
        <View style={s.headerBody}>
          <Text style={s.title}>Passez au niveau supérieur</Text>
          <Text style={s.sub}>
            Débloquez l'intelligence complète de Nautilus pour votre collection.
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
      >

        {/* ── Value props ── */}
        <View style={s.valueRow}>
          {[
            { icon: '📈', text: '2.3B€ de ventes analysées' },
            { icon: '🤖', text: 'Larry IA illimité' },
            { icon: '📄', text: 'Rapports PDF' },
          ].map(v => (
            <View key={v.text} style={s.valuePill}>
              <Text style={s.valuePillIcon}>{v.icon}</Text>
              <Text style={s.valuePillText}>{v.text}</Text>
            </View>
          ))}
        </View>

        {/* ── Plans ── */}
        {PLANS.map(plan => (
          <View
            key={plan.id}
            style={[s.planCard, plan.badge != null && s.planCardFeatured]}
          >
            {plan.badge && (
              <View style={s.planBadge}>
                <Text style={s.planBadgeTxt}>{plan.badge}</Text>
              </View>
            )}

            <View style={s.planTop}>
              <View>
                <Text style={s.planName}>{plan.name}</Text>
                <Text style={s.planDesc}>{plan.description}</Text>
              </View>
              <View style={s.planPriceWrap}>
                <Text style={s.planPrice}>{plan.price}</Text>
                {plan.period ? <Text style={s.planPeriod}>{plan.period}</Text> : null}
              </View>
            </View>

            <View style={s.featureList}>
              {plan.features.map(f => (
                <View key={f} style={s.featureRow}>
                  <Text style={s.featureCheck}>✓</Text>
                  <Text style={s.featureTxt}>{f}</Text>
                </View>
              ))}
            </View>

            <Pressable
              style={[s.ctaBtn, plan.badge != null && s.ctaBtnFeatured]}
              onPress={() => handleUpgrade(plan.id)}
            >
              <Text style={[s.ctaBtnTxt, plan.badge != null && s.ctaBtnTxtFeatured]}>
                {plan.id === 'pro' ? 'Nous contacter' : `Choisir ${plan.name} →`}
              </Text>
            </Pressable>
          </View>
        ))}

        {/* ── Trust footer ── */}
        <View style={s.trustRow}>
          <Text style={s.trustTxt}>🔒  Paiement sécurisé via Stripe</Text>
          <Text style={s.trustTxt}>↩  Annulable à tout moment</Text>
        </View>

        <Text style={s.legal}>
          Les prix s'entendent HT. Facturation mensuelle. Sans engagement.
        </Text>

      </ScrollView>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary },

  // Header
  header:     { paddingTop: 52, paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 0.5, borderBottomColor: Colors.borderTertiary },
  closeBtn:   { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  closeTxt:   { fontSize: Fonts.xl, color: Colors.textTertiary },
  headerBody: { gap: 6 },
  title:      { fontSize: Fonts['3xl'], fontWeight: '700', color: Colors.textPrimary, letterSpacing: -0.4 },
  sub:        { fontSize: Fonts.md, color: Colors.textSecondary, lineHeight: 19 },

  scroll: { padding: 16, paddingBottom: 48 },

  // Value props
  valueRow:        { flexDirection: 'row', gap: 6, marginBottom: 18, flexWrap: 'wrap' },
  valuePill:       { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 5, paddingHorizontal: 9, borderRadius: Radius.full, backgroundColor: Colors.greenLight },
  valuePillIcon:   { fontSize: 12 },
  valuePillText:   { fontSize: Fonts.xs, fontWeight: Fonts.medium, color: Colors.greenDark },

  // Plan cards
  planCard:         { borderWidth: 0.5, borderColor: Colors.borderTertiary, borderRadius: Radius.lg, padding: 16, marginBottom: 12, position: 'relative' },
  planCardFeatured: { borderColor: Colors.textPrimary, borderWidth: 1.5 },
  planBadge:        { position: 'absolute', top: -10, right: 14, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20, backgroundColor: Colors.textPrimary },
  planBadgeTxt:     { fontSize: Fonts.xs, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.5 },
  planTop:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  planName:         { fontSize: Fonts.xl, fontWeight: '700', color: Colors.textPrimary, marginBottom: 3 },
  planDesc:         { fontSize: Fonts.base, color: Colors.textTertiary },
  planPriceWrap:    { alignItems: 'flex-end' },
  planPrice:        { fontSize: Fonts['2xl'], fontWeight: '700', color: Colors.textPrimary },
  planPeriod:       { fontSize: Fonts.base, color: Colors.textTertiary },

  featureList: { gap: 7, marginBottom: 16 },
  featureRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  featureCheck:{ fontSize: Fonts.base, color: Colors.green, fontWeight: '700', marginTop: 1 },
  featureTxt:  { fontSize: Fonts.base, color: Colors.textSecondary, flex: 1, lineHeight: 17 },

  // CTA buttons
  ctaBtn:         { borderWidth: 1, borderColor: Colors.textPrimary, borderRadius: Radius.md, padding: 13, alignItems: 'center' },
  ctaBtnFeatured: { backgroundColor: Colors.textPrimary, borderColor: Colors.textPrimary },
  ctaBtnTxt:      { fontSize: Fonts.md, fontWeight: Fonts.medium, color: Colors.textPrimary },
  ctaBtnTxtFeatured: { color: '#FFFFFF' },

  // Trust
  trustRow:  { flexDirection: 'row', justifyContent: 'center', gap: 18, marginTop: 10, marginBottom: 10 },
  trustTxt:  { fontSize: Fonts.base, color: Colors.textTertiary },
  legal:     { fontSize: Fonts.xs, color: Colors.textTertiary, textAlign: 'center', lineHeight: 16 },
});

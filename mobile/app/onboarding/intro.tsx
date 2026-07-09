// app/onboarding/intro.tsx
// Brand onboarding — 3 intro slides before the personalisation funnel
// Slide 1: Collection · Slide 2: Documentation · Slide 3: Clarté

import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  StyleSheet,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  type DimensionValue,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { markIntroComplete } from '@/lib/onboarding';

// ─── Design tokens ───────────────────────────────────────────────────────────

const LINEN   = '#F7F4EE';
const INK     = '#1A1A1A';
const MUTED   = '#6E6E73';
const BLUE    = '#1B4FCC';
const BORDER  = '#E5E2DC';
const DIVIDER = '#F0EDE8';

const PLAYFAIR = 'PlayfairDisplay_600SemiBold';
const INTER    = 'Inter_400Regular';
const INTER_MD = 'Inter_500Medium';

const FRONT_W = 280;
const FRONT_H = 330;
const REAR_W  = 215;
const REAR_H  = 290;
const STACK_W = FRONT_W + 56;

// ─── Fake gradient (two-tone depth approximation) ────────────────────────────

interface FGProps {
  top: string;
  bottom: string;
  style?: object;
  children?: React.ReactNode;
}
function FG({ top, bottom, style, children }: FGProps) {
  return (
    <View style={[{ backgroundColor: top, overflow: 'hidden' }, style]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: bottom, opacity: 0.55 }]} />
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '35%', backgroundColor: bottom, opacity: 0.35 }} />
      {children}
    </View>
  );
}

// ─── Shared card header ───────────────────────────────────────────────────────

function CardHeader({ label, right }: { label: string; right?: React.ReactNode }) {
  return (
    <View style={s.cardHeader}>
      <Text style={s.cardLabel}>{label}</Text>
      {right}
    </View>
  );
}

// ─── SLIDE 1 — COLLECTION ────────────────────────────────────────────────────
// Front card: artwork grid 3×3 with spanning cells

const G = {
  col1: 11,
  col2: 97,
  col3: 185,
  row1: 11,
  row2: 92,
  row3: 174,
  cw: 81,
  rh: 75,
};

function ArtworkGrid() {
  return (
    <View style={s.artGrid}>
      {/* TALL_PORTRAIT: col1, rows 1–2 */}
      <View style={[s.cell, { left: G.col1, top: G.row1, width: G.cw, height: G.rh * 2 + 4, backgroundColor: '#6B5448' }]}>
        <Image source={require('../../assets/images/artwork_portrait.png')} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
        <Text style={s.cellLbl}>Peinture · 2019</Text>
      </View>

      {/* PHOTO_BW: col2, row1 */}
      <View style={[s.cell, { left: G.col2, top: G.row1, width: G.cw, height: G.rh, backgroundColor: '#C8C4C0' }]}>
        <Image source={require('../../assets/images/artwork_dessin.png')} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
      </View>

      {/* PAPER_DRAWING: col3, row1 */}
      <View style={[s.cell, { left: G.col3, top: G.row1, width: G.cw, height: G.rh, backgroundColor: '#F5F2EC' }]}>
        <Image source={require('../../assets/images/artwork_miniature.png')} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
      </View>

      {/* SCULPTURE: col2, row2 */}
      <View style={[s.cell, { left: G.col2, top: G.row2, width: G.cw, height: G.rh, backgroundColor: '#C0B4A0' }]}>
        <Image source={require('../../assets/images/artwork_bleu.png')} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
      </View>

      {/* WARM CELL: col3, row2 */}
      <View style={[s.cell, { left: G.col3, top: G.row2, width: G.cw, height: G.rh, backgroundColor: '#D4C8B4' }]}>
        <Image source={require('../../assets/images/artwork_abstrait_bleu.png')} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
      </View>

      {/* LANDSCAPE: cols 1–2, row3 */}
      <View style={[s.cell, { left: G.col1, top: G.row3, width: G.cw * 2 + 4, height: G.rh, backgroundColor: '#9BB0C4' }]}>
        <Image source={require('../../assets/images/artwork_monet.png')} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
        <Text style={[s.cellLbl, { color: 'rgba(255,255,255,0.55)' }]}>Paysage · Huile</Text>
      </View>

      {/* ESTAMPE: col3, row3 */}
      <View style={[s.cell, { left: G.col3, top: G.row3, width: G.cw, height: G.rh, backgroundColor: '#F5F2EC' }]}>
        <Image source={require('../../assets/images/artwork_abstrait_geo.png')} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
      </View>
    </View>
  );
}

function Slide1Front() {
  return (
    <View style={s.frontCard}>
      <CardHeader
        label="MA COLLECTION"
        right={<Text style={s.cardMeta}>23 œuvres · 8 artistes</Text>}
      />
      <ArtworkGrid />
    </View>
  );
}

function Slide1RearLeft() {
  const bodyH = REAR_H - 27;
  return (
    <View style={s.rearCardInner}>
      <CardHeader label="Installation" />
      <View style={{ flex: 1, backgroundColor: '#D0CCC6' }}>
        <View style={{
          position: 'absolute',
          top: (bodyH - 96) / 2, left: (REAR_W - 72) / 2,
          width: 72, height: 96,
          borderWidth: 2, borderColor: '#E8E4DC',
          overflow: 'hidden',
        }}>
          <Image source={require('../../assets/images/artwork_vangogh.png')} style={StyleSheet.absoluteFill} resizeMode="cover" />
        </View>
        <Text style={{ position: 'absolute', bottom: 8, left: 8, fontSize: 6, color: '#9E9890', fontFamily: INTER }}>Salon · Paris</Text>
      </View>
    </View>
  );
}

function Slide1RearRight() {
  const bars: Array<{ width: DimensionValue; color: string; marginTop?: number }> = [
    { width: '45%', color: BLUE },
    { width: '80%', color: BORDER, marginTop: 14 },
    { width: '60%', color: BORDER },
    { width: '70%', color: BORDER, marginTop: 14 },
    { width: '50%', color: BORDER },
    { width: '75%', color: BORDER },
  ];
  return (
    <View style={s.rearCardInner}>
      <CardHeader label="Certificat" />
      <View style={{ flex: 1, borderTopWidth: 2, borderTopColor: BLUE, padding: 8, gap: 5 }}>
        {bars.map((b, i) => (
          <View key={i} style={{ height: 4, backgroundColor: b.color, width: b.width, borderRadius: 2, marginTop: b.marginTop ?? 0 }} />
        ))}
      </View>
    </View>
  );
}

// ─── SLIDE 2 — DOCUMENTATION ─────────────────────────────────────────────────

interface DocRowProps {
  iconBg: string;
  iconTopColor?: string;
  iconIsPhoto?: boolean;
  title: string;
  sub: string;
}
function DocRow({ iconBg, iconTopColor, iconIsPhoto, title, sub }: DocRowProps) {
  return (
    <View style={s.docRow}>
      <View style={[s.docIcon, { backgroundColor: iconBg }]}>
        {iconTopColor && !iconIsPhoto && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: iconTopColor }} />
        )}
        {iconIsPhoto && (
          <Image source={require('../../assets/images/artwork_miniature.png')} style={StyleSheet.absoluteFill} resizeMode="cover" />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.docTitle}>{title}</Text>
        <Text style={s.docSub}>{sub}</Text>
      </View>
    </View>
  );
}

function Slide2Front() {
  return (
    <View style={s.frontCard}>
      <CardHeader
        label="DOCUMENTATION"
        right={<Text style={s.cardMeta}>5 documents</Text>}
      />
      <View style={{ padding: 9, paddingHorizontal: 10, gap: 5 }}>
        <DocRow iconBg="#E6ECF7" iconTopColor={BLUE} title="Certificat d'authenticité" sub="Galerie Perrotin · 2019" />
        <DocRow iconBg="#F0EDE8" iconTopColor="#8C8070" title="Facture d'achat" sub="Christie's Paris · 12 mars 2021" />
        <DocRow iconBg="#D4CFC8" iconIsPhoto title="Photo d'installation" sub="Appartement · Paris 16e" />
        <DocRow iconBg="#EBE8E2" iconTopColor="#A89880" title="Rapport de condition" sub="Vérifié · Janvier 2024" />
        <DocRow iconBg="#F0EDE8" iconTopColor="#6E6E73" title="Historique de provenance" sub="3 propriétaires · 1998–2021" />
      </View>
    </View>
  );
}

const GRID_IMAGES_2 = [
  [require('../../assets/images/artwork_portrait.png'), require('../../assets/images/artwork_dessin.png'), require('../../assets/images/artwork_miniature.png')],
  [require('../../assets/images/artwork_bleu.png'), require('../../assets/images/artwork_abstrait_bleu.png'), require('../../assets/images/artwork_monet.png')],
  [require('../../assets/images/artwork_peinture.jpg'), require('../../assets/images/artwork_abstrait_geo.png'), require('../../assets/images/artwork_vangogh.png')],
];

function CollectionGrid3x3() {
  return (
    <View style={{ flex: 1, padding: 6, flexDirection: 'column', gap: 2 }}>
      {GRID_IMAGES_2.map((row, ri) => (
        <View key={ri} style={{ flex: 1, flexDirection: 'row', gap: 2 }}>
          {row.map((src, ci) => (
            <Image key={ci} source={src} style={{ flex: 1, borderRadius: 2 }} resizeMode="cover" />
          ))}
        </View>
      ))}
    </View>
  );
}

function Slide2RearLeft() {
  return (
    <View style={s.rearCardInner}>
      <CardHeader label="MA COLLECTION" />
      <CollectionGrid3x3 />
    </View>
  );
}

function Slide2RearRight() {
  const barDefs: Array<{ color: string; width: DimensionValue; mt?: number }> = [
    { color: '#C4B8A4', width: '70%' },
    { color: BORDER,    width: '55%' },
    { color: '#C4B8A4', width: '80%', mt: 12 },
    { color: BORDER,    width: '65%' },
    { color: '#C4B8A4', width: '50%', mt: 12 },
    { color: BORDER,    width: '60%' },
    { color: BORDER,    width: '45%' },
  ];
  return (
    <View style={s.rearCardInner}>
      <CardHeader label="Provenance" />
      <View style={{ flex: 1, borderTopWidth: 2, borderTopColor: '#C4B8A4', padding: 8, gap: 5 }}>
        {barDefs.map((b, i) => (
          <View key={i} style={{ height: 4, width: b.width, backgroundColor: b.color, borderRadius: 2, marginTop: b.mt ?? 0 }} />
        ))}
      </View>
    </View>
  );
}

// ─── SLIDE 3 — CLARTÉ ────────────────────────────────────────────────────────

function Slide3Front() {
  return (
    <View style={s.frontCard}>
      <CardHeader
        label="UNE ŒUVRE"
        right={<Text style={[s.cardMeta, { color: BLUE, fontFamily: INTER_MD }]}>Tout réuni</Text>}
      />
      {/* Artwork image zone */}
      <View style={{ height: 124, backgroundColor: '#6B5448', overflow: 'hidden' }}>
        <Image source={require('../../assets/images/artwork_peinture.jpg')} style={StyleSheet.absoluteFill} resizeMode="cover" />
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 44, backgroundColor: '#3A2820', opacity: 0.55 }} />
        <View style={{ position: 'absolute', bottom: 6, left: 10 }}>
          <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.92)', fontFamily: PLAYFAIR, fontStyle: 'italic' }}>
            Sans titre, 2019
          </Text>
          <Text style={{ fontSize: 7, color: 'rgba(255,255,255,0.60)', fontFamily: INTER, marginTop: 2 }}>
            Huile sur toile · 80 × 60 cm
          </Text>
        </View>
      </View>
      {/* Document rows */}
      <View style={{ padding: 7, paddingHorizontal: 10, gap: 5 }}>
        {/* Certificat — highlighted */}
        <View style={{ backgroundColor: '#EEF2FA', borderRadius: 5, borderLeftWidth: 2, borderLeftColor: BLUE, padding: 5, paddingHorizontal: 7, flexDirection: 'row', gap: 7, alignItems: 'center' }}>
          <View style={{ width: 18, height: 22, backgroundColor: '#DAE3F5', borderRadius: 3 }}>
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: BLUE }} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 7.5, fontFamily: INTER_MD, color: BLUE }}>Certificat d'authenticité</Text>
            <Text style={{ fontSize: 6.5, fontFamily: INTER, color: '#6E8FC0', marginTop: 1 }}>Galerie Perrotin · 2019</Text>
          </View>
        </View>
        {/* Installation */}
        <View style={{ backgroundColor: LINEN, borderRadius: 5, borderLeftWidth: 2, borderLeftColor: '#C4B8A4', padding: 5, paddingHorizontal: 7, flexDirection: 'row', gap: 7, alignItems: 'center' }}>
          <View style={{ width: 18, height: 22, borderRadius: 2, overflow: 'hidden' }}>
            <FG top="#D4CFC8" bottom="#A89880" style={StyleSheet.absoluteFill} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 7.5, fontFamily: INTER_MD, color: INK }}>Photo d'installation</Text>
            <Text style={{ fontSize: 6.5, fontFamily: INTER, color: MUTED, marginTop: 1 }}>Salon · Paris 16e</Text>
          </View>
        </View>
        {/* Provenance */}
        <View style={{ backgroundColor: LINEN, borderRadius: 5, borderLeftWidth: 2, borderLeftColor: '#C4B8A4', padding: 5, paddingHorizontal: 7, flexDirection: 'row', gap: 7, alignItems: 'center' }}>
          <View style={{ width: 18, height: 22, backgroundColor: '#EBE8E2', borderRadius: 2 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 7.5, fontFamily: INTER_MD, color: INK }}>Historique de provenance</Text>
            <Text style={{ fontSize: 6.5, fontFamily: INTER, color: MUTED, marginTop: 1 }}>3 propriétaires · 1998 → 2021</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function Slide3RearRight() {
  return (
    <View style={s.rearCardInner}>
      <CardHeader label="Documents" />
      <View style={{ flex: 1, borderTopWidth: 2, borderTopColor: '#C4B8A4', padding: 8, gap: 6 }}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={{ height: 28, backgroundColor: LINEN, borderRadius: 4, borderWidth: 0.5, borderColor: BORDER }} />
        ))}
      </View>
    </View>
  );
}

// ─── Card stack wrapper ───────────────────────────────────────────────────────

interface StackProps {
  front: React.ReactNode;
  left: React.ReactNode;
  right: React.ReactNode;
}
function CardStack({ front, left, right }: StackProps) {
  return (
    <View style={s.stack}>
      <View style={[s.rear, s.rearL]}>{left}</View>
      <View style={[s.rear, s.rearR]}>{right}</View>
      <View style={s.front}>{front}</View>
    </View>
  );
}

// ─── Slide content ────────────────────────────────────────────────────────────

const SLIDE_DATA = [
  {
    headline: 'Toute votre collection.\nEnfin organisée.',
    body: 'Regroupez toutes vos œuvres au même endroit et obtenez une vue claire et complète de votre collection.',
  },
  {
    headline: 'Vos documents.\nToujours à portée de main.',
    body: 'Certificats, factures, provenances et photos. Tout est centralisé et facile à retrouver.',
  },
  {
    headline: "Votre collection mérite mieux\nqu'un tableur.",
    body: 'Œuvres, documents, provenance et historique.\nTout ce qui compte, enfin réuni.',
  },
];

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function IntroScreen() {
  const { width }  = useWindowDimensions();
  const insets     = useSafeAreaInsets();
  const router     = useRouter();
  const scrollRef  = useRef<ScrollView>(null);
  const [slide, setSlide] = useState(0);

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setSlide(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  const advance = () => {
    const next = slide + 1;
    scrollRef.current?.scrollTo({ x: width * next, animated: true });
    setSlide(next);
  };

  const finish = async () => {
    await markIntroComplete();
    router.replace('/auth/login');
  };

  const goLogin = () => router.replace('/login');

  const headerTop = insets.top + 12;

  return (
    <View style={[s.root]}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumScrollEnd}
        style={{ flex: 1 }}
        contentContainerStyle={{ alignItems: 'stretch' }}
      >
        {[0, 1, 2].map((i) => (
          <View key={i} style={[s.slidePage, { width }]}>
            {/* Card stack — vertically centered in remaining space after header */}
            <View style={s.cardArea}>
              {i === 0 && (
                <CardStack
                  front={<Slide1Front />}
                  left={<Slide1RearLeft />}
                  right={<Slide1RearRight />}
                />
              )}
              {i === 1 && (
                <CardStack
                  front={<Slide2Front />}
                  left={<Slide2RearLeft />}
                  right={<Slide2RearRight />}
                />
              )}
              {i === 2 && (
                <CardStack
                  front={<Slide3Front />}
                  left={<Slide2RearLeft />}
                  right={<Slide3RearRight />}
                />
              )}
            </View>

            {/* Bottom zone */}
            <View style={s.bottom}>
              <Text style={s.headline}>{SLIDE_DATA[i].headline}</Text>
              <Text style={s.body}>{SLIDE_DATA[i].body}</Text>

              <View style={s.dots}>
                {[0, 1, 2].map((d) => (
                  <View key={d} style={[s.dot, d === i && s.dotActive]} />
                ))}
              </View>

              {i < 2 ? (
                <Pressable style={s.ctaGhost} onPress={i === slide ? advance : undefined}>
                  <Text style={s.ctaGhostTxt}>Continuer →</Text>
                </Pressable>
              ) : (
                <Pressable style={s.ctaFilled} onPress={finish}>
                  <Text style={s.ctaFilledTxt}>Créer ma collection →</Text>
                </Pressable>
              )}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Fixed header — above the scroll view */}
      <View style={[s.header, { top: headerTop }]} pointerEvents="box-none">
        <Image
          source={require('../../assets/images/nautilus-logo.png')}
          style={s.logo}
        />
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: LINEN,
  },

  // Fixed header overlay
  header: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
  },
  logo: {
    height: 70,
    width: 220,
    resizeMode: 'contain',
    alignSelf: 'center',
  },
  loginHint: {
    fontSize: 12,
    fontFamily: INTER,
    color: MUTED,
    textAlign: 'center',
    marginTop: 6,
  },

  // Scroll pages
  slidePage: {
    flex: 1,
    flexDirection: 'column',
  },

  // Card stack area — fills space between header and bottom zone
  cardArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 155, // clear fixed header
  },

  // Card stack
  stack: {
    width: STACK_W,
    height: FRONT_H + 16,
    alignSelf: 'center',
  },
  front: {
    position: 'absolute',
    top: 0,
    left: (STACK_W - FRONT_W) / 2,
    width: FRONT_W,
    height: FRONT_H,
    borderRadius: 18,
    borderWidth: 0.5,
    borderColor: BORDER,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.10,
    shadowRadius: 24,
    elevation: 8,
  },
  rear: {
    position: 'absolute',
    top: 16,
    width: REAR_W,
    height: REAR_H,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: BORDER,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    zIndex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  rearL: {
    left: 0,
    transform: [{ rotateZ: '-5deg' }],
  },
  rearR: {
    right: 0,
    transform: [{ rotateZ: '5deg' }],
  },

  // Inner layout helpers used by card content
  frontCard: {
    flex: 1,
  },
  rearCardInner: {
    flex: 1,
    flexDirection: 'column',
  },
  cardHeader: {
    paddingVertical: 9,
    paddingHorizontal: 11,
    borderBottomWidth: 0.5,
    borderBottomColor: DIVIDER,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardLabel: {
    fontSize: 7,
    fontFamily: INTER_MD,
    letterSpacing: 1.2,
    color: MUTED,
    textTransform: 'uppercase',
  },
  cardMeta: {
    fontSize: 7,
    fontFamily: INTER,
    color: MUTED,
  },

  // Artwork grid
  artGrid: {
    height: 260,
    position: 'relative',
  },
  cell: {
    position: 'absolute',
    borderRadius: 4,
    overflow: 'hidden',
  },
  cellLbl: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    fontSize: 5,
    color: 'rgba(255,255,255,0.65)',
    fontFamily: INTER,
  },

  // Doc rows (slide 2)
  docRow: {
    backgroundColor: LINEN,
    borderRadius: 5,
    borderWidth: 0.5,
    borderColor: BORDER,
    padding: 7,
    paddingHorizontal: 9,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  docIcon: {
    width: 22,
    height: 26,
    borderRadius: 3,
    overflow: 'hidden',
  },
  docTitle: {
    fontSize: 8,
    fontFamily: INTER_MD,
    color: INK,
  },
  docSub: {
    fontSize: 7,
    fontFamily: INTER,
    color: MUTED,
    marginTop: 1,
  },

  // Bottom zone
  bottom: {
    paddingHorizontal: 28,
    paddingTop: 10,
    paddingBottom: 32,
    alignItems: 'center',
  },
  headline: {
    fontSize: 27,
    fontFamily: PLAYFAIR,
    color: INK,
    lineHeight: 36,
    textAlign: 'center',
    marginBottom: 10,
  },
  body: {
    fontSize: 14,
    fontFamily: INTER,
    color: MUTED,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 16,
  },

  // Progress dots
  dots: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 18,
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: BORDER,
  },
  dotActive: {
    width: 20,
    height: 6,
    borderRadius: 3,
    backgroundColor: BLUE,
  },

  // CTAs
  ctaGhost: {
    width: '100%',
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: INK,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  ctaGhostTxt: {
    fontSize: 15,
    fontFamily: INTER_MD,
    color: INK,
  },
  ctaFilled: {
    width: '100%',
    height: 52,
    borderRadius: 14,
    backgroundColor: BLUE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaFilledTxt: {
    fontSize: 15,
    fontFamily: INTER_MD,
    color: '#FFFFFF',
  },
});

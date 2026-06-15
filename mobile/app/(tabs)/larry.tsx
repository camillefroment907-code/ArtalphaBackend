// app/(tabs)/larry.tsx — Larry AI Advisor (Nautilus design)

import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  Colors,
  FontFamily,
  FontSize,
  Spacing,
  Radius,
  Shadow,
} from '@/constants/theme';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { PortfolioItem } from '@/lib/types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const CHIPS = [
  { label: 'Valeur de ma collection',  prompt: 'Que vaut ma collection en ce moment ?' },
  { label: 'Œuvre la plus liquide',    prompt: 'Quelle œuvre de ma collection est la plus liquide ?' },
  { label: 'Améliorer ma collection',  prompt: 'Comment améliorer ma Collection Health ?' },
  { label: 'Tendances du marché',      prompt: 'Quelles sont les tendances actuelles du marché de l\'art ?' },
];

function computeContext(items: PortfolioItem[]): string {
  if (items.length === 0) return '';
  const total = items.reduce((s, i) => s + (i.estimated_current_value_eur ?? 0), 0);
  const artists = new Set(items.map((i) => i.artist_name).filter(Boolean));
  return `Portfolio: ${items.length} œuvres, ${artists.size} artistes, valeur estimée ${Math.round(total).toLocaleString('fr-FR')} €.`;
}

export default function LarryScreen() {
  const { q } = useLocalSearchParams<{ q?: string }>();
  const user   = useAuthStore((s) => s.user);
  const firstName = user?.name?.split(' ')[0] ?? '';

  const [messages,  setMessages]  = useState<Message[]>([]);
  const [input,     setInput]     = useState('');
  const [sending,   setSending]   = useState(false);
  const [context,   setContext]   = useState('');
  const scrollRef = useRef<ScrollView>(null);

  // Pre-fill from deep link
  useEffect(() => { if (q) setInput(q); }, [q]);

  // Build portfolio context once
  useEffect(() => {
    api.get<PortfolioItem[]>('/api/portfolio/items')
      .then((items) => setContext(computeContext(Array.isArray(items) ? items : [])))
      .catch(() => {});
  }, []);

  const sendWith = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    const newMessages: Message[] = [...messages, { role: 'user', content: trimmed }];
    setMessages(newMessages);
    setInput('');
    setSending(true);
    try {
      const res = await api.post<{ response?: string; content?: string; message?: string }>(
        '/api/chat/message',
        { message: trimmed, context: context || 'collection' }
      );
      const reply = res.response ?? res.content ?? res.message ?? '…';
      setMessages([...newMessages, { role: 'assistant', content: reply }]);
    } catch {
      setMessages([...newMessages, {
        role: 'assistant',
        content: 'Je ne suis pas disponible pour le moment. Réessayez dans quelques instants.',
      }]);
    } finally {
      setSending(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const hasConversation = messages.length > 0;

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* ── Header ── */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <View style={s.logoMark}>
            <Ionicons name="sparkles-outline" size={14} color={Colors.gold} />
          </View>
          <View>
            <Text style={s.title}>Larry</Text>
            <Text style={s.sub}>Nautilus Intelligence</Text>
          </View>
        </View>
        {hasConversation && (
          <Pressable onPress={() => setMessages([])}>
            <Text style={s.clearTxt}>Nouvelle conv.</Text>
          </Pressable>
        )}
      </View>

      {/* ── Content ── */}
      <ScrollView
        ref={scrollRef}
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() =>
          hasConversation && scrollRef.current?.scrollToEnd({ animated: false })
        }
      >
        {!hasConversation ? (
          <>
            {/* ── Welcome ── */}
            <View style={s.welcome}>
              <Text style={s.welcomeTitle}>
                Bonjour{firstName ? `, ${firstName}` : ''}.
              </Text>
              <Text style={s.welcomeSub}>
                Je suis Larry, votre conseiller Nautilus.{'\n'}
                Posez-moi vos questions sur votre collection, un artiste ou le marché de l'art.
              </Text>
            </View>

            {/* ── Quick chips ── */}
            <Text style={s.chipsLabel}>SUGGESTIONS</Text>
            <View style={s.chips}>
              {CHIPS.map((c) => (
                <Pressable key={c.label} style={s.chip} onPress={() => sendWith(c.prompt)}>
                  <Text style={s.chipTxt}>{c.label}</Text>
                  <Ionicons name="arrow-forward" size={11} color={Colors.textTertiary} />
                </Pressable>
              ))}
            </View>
          </>
        ) : (
          <>
            {messages.map((msg, i) => (
              <View key={i} style={[s.bubble, msg.role === 'user' ? s.bubbleUser : s.bubbleAsst]}>
                {msg.role === 'assistant' && (
                  <View style={s.bubbleLarryTag}>
                    <Ionicons name="sparkles-outline" size={10} color={Colors.gold} />
                    <Text style={s.bubbleLarryTxt}>Larry</Text>
                  </View>
                )}
                <Text style={msg.role === 'user' ? s.bubbleTxtUser : s.bubbleTxtAsst}>
                  {msg.content}
                </Text>
              </View>
            ))}
            {sending && (
              <View style={[s.bubble, s.bubbleAsst, s.bubbleLoading]}>
                <ActivityIndicator size="small" color={Colors.gold} />
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* ── Input ── */}
      <View style={s.inputRow}>
        <TextInput
          style={s.input}
          value={input}
          onChangeText={setInput}
          placeholder="Question sur votre collection…"
          placeholderTextColor={Colors.textTertiary}
          returnKeyType="send"
          onSubmitEditing={() => sendWith(input)}
          multiline
        />
        <Pressable
          style={[s.sendBtn, (!input.trim() || sending) && s.sendBtnOff]}
          onPress={() => sendWith(input)}
          disabled={!input.trim() || sending}
        >
          <Ionicons name="arrow-up" size={16} color={Colors.bgDark} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.bg },

  // Header
  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingTop: 56, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoMark: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title:    { fontSize: FontSize.lg, fontFamily: FontFamily.serifBold, color: Colors.textPrimary },
  sub:      { fontSize: FontSize.xs, fontFamily: FontFamily.sans, color: Colors.textTertiary },
  clearTxt: { fontSize: FontSize.sm, fontFamily: FontFamily.sans, color: Colors.textTertiary },

  // Scroll
  scroll:        { flex: 1 },
  scrollContent: { padding: Spacing.md, paddingBottom: 16 },

  // Welcome
  welcome: { marginBottom: Spacing.lg, paddingVertical: Spacing.sm },
  welcomeTitle: { fontSize: FontSize['3xl'], fontFamily: FontFamily.serifBold, color: Colors.textPrimary, letterSpacing: -0.3, marginBottom: 10 },
  welcomeSub:   { fontSize: FontSize.base, fontFamily: FontFamily.sans, color: Colors.textSecondary, lineHeight: FontSize.base * 1.6 },

  // Chips
  chipsLabel: { fontSize: FontSize.xs, fontFamily: FontFamily.sansSemibold, color: Colors.textTertiary, letterSpacing: 0.7, textTransform: 'uppercase', marginBottom: 10 },
  chips:      { gap: 8 },
  chip:       {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgSurface,
    ...Shadow.sm,
  },
  chipTxt: { fontSize: FontSize.base, fontFamily: FontFamily.sansMedium, color: Colors.textSecondary },

  // Bubbles
  bubble:         { maxWidth: '82%', borderRadius: Radius.lg, padding: 12, marginBottom: 8 },
  bubbleUser:     { alignSelf: 'flex-end', backgroundColor: Colors.navy },
  bubbleAsst:     { alignSelf: 'flex-start', backgroundColor: Colors.bgSurface, borderWidth: 1, borderColor: Colors.border },
  bubbleLoading:  { minWidth: 48, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  bubbleLarryTag: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 5 },
  bubbleLarryTxt: { fontSize: FontSize.xs, fontFamily: FontFamily.sansSemibold, color: Colors.gold },
  bubbleTxtUser:  { fontSize: FontSize.base, fontFamily: FontFamily.sans, color: Colors.textOnDark, lineHeight: 19 },
  bubbleTxtAsst:  { fontSize: FontSize.base, fontFamily: FontFamily.sans, color: Colors.textPrimary, lineHeight: 19 },

  // Input row
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-end',
    padding: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  input: {
    flex: 1,
    fontSize: FontSize.base,
    fontFamily: FontFamily.sans,
    color: Colors.textPrimary,
    maxHeight: 100,
    paddingVertical: 10,
  },
  sendBtn:    {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    ...Shadow.gold,
  },
  sendBtnOff: { opacity: 0.35 },
});

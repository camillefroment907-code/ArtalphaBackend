// components/ui/Badge.tsx
import { View, Text, StyleSheet } from 'react-native';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';

type Variant = 'gold' | 'green' | 'red' | 'navy' | 'muted';

interface BadgeProps {
  label: string;
  variant?: Variant;
}

const variantMap: Record<Variant, { bg: string; text: string }> = {
  gold:  { bg: Colors.gold,       text: Colors.bgDark },
  green: { bg: Colors.greenLight, text: Colors.green },
  red:   { bg: '#FAE8E8',         text: Colors.error },
  navy:  { bg: Colors.bgDark,     text: Colors.textOnDark },
  muted: { bg: Colors.bgElevated, text: Colors.textSecondary },
};

export function Badge({ label, variant = 'muted' }: BadgeProps) {
  const { bg, text } = variantMap[variant];
  return (
    <View style={[s.badge, { backgroundColor: bg }]}>
      <Text style={[s.label, { color: text }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  label: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.sansSemibold,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});

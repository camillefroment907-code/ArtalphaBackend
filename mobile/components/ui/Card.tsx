// components/ui/Card.tsx
import { View, StyleSheet, ViewProps } from 'react-native';
import { Colors, Radius, Shadow, Spacing } from '@/constants/theme';

type Variant = 'default' | 'dark' | 'featured' | 'flat';

interface CardProps extends ViewProps {
  variant?: Variant;
  padding?: number;
}

export function Card({ variant = 'default', padding = Spacing.md, style, children, ...rest }: CardProps) {
  const cardStyle = variantStyles[variant];
  return (
    <View style={[s.base, cardStyle, { padding }, style]} {...rest}>
      {children}
    </View>
  );
}

const variantStyles = {
  default: {
    backgroundColor: Colors.bgSurface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: Radius.lg,
    ...Shadow.sm,
  },
  dark: {
    backgroundColor: Colors.bgDark,
    borderRadius: Radius.lg,
    ...Shadow.md,
  },
  featured: {
    backgroundColor: Colors.bg,
    borderColor: Colors.gold,
    borderWidth: 1,
    borderRadius: Radius.lg,
    ...Shadow.gold,
  },
  flat: {
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.lg,
  },
};

const s = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
});

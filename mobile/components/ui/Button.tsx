// components/ui/Button.tsx
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  PressableProps,
} from 'react-native';
import { Colors, FontFamily, FontSize, Radius, Button as BtnTokens } from '@/constants/theme';

type Variant = 'primary' | 'secondary' | 'gold' | 'ghost';
type Size    = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<PressableProps, 'style'> {
  label: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
}

const sizeMap: Record<Size, { py: number; px: number; fontSize: number }> = {
  sm: { py: 9,  px: 16, fontSize: FontSize.sm },
  md: { py: 13, px: 22, fontSize: FontSize.base },
  lg: { py: 15, px: 28, fontSize: FontSize.lg },
};

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled,
  ...rest
}: ButtonProps) {
  const tok  = BtnTokens[variant];
  const dims = sizeMap[size];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      style={({ pressed }) => [
        s.base,
        {
          backgroundColor: tok.bg as string,
          borderColor: tok.border as string,
          borderWidth: tok.border === 'transparent' ? 0 : 1,
          borderRadius: tok.radius,
          paddingVertical: dims.py,
          paddingHorizontal: dims.px,
          opacity: isDisabled ? 0.45 : pressed ? 0.80 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
      ]}
      disabled={isDisabled}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={tok.text as string} size="small" />
      ) : (
        <Text style={[s.label, { color: tok.text as string, fontSize: dims.fontSize }]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  label: {
    fontFamily: FontFamily.sansSemibold,
    letterSpacing: 0.1,
  },
});

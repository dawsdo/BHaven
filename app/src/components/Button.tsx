import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { colors, radius, TOUCH } from "../theme";

type Props = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "plain";
  /** "large" is for the one main action on a screen. */
  size?: "default" | "large";
  loading?: boolean;
  disabled?: boolean;
  /** Spoken name when the visible label alone is not specific enough. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

// React Native for Web also reports hover; the native type does not list it.
type WebPressState = PressableStateCallbackType & { hovered?: boolean };

/** The one button used across the app, so every button has the same states. */
export function Button({
  label,
  onPress,
  variant = "primary",
  size = "default",
  loading = false,
  disabled = false,
  accessibilityLabel,
  style,
}: Props) {
  const inactive = disabled || loading;
  const spinnerColor = variant === "primary" ? colors.onPrimary : colors.primary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      onPress={onPress}
      disabled={inactive}
      style={(state) => {
        const { pressed, hovered } = state as WebPressState;
        return [
          styles.base,
          size === "large" && styles.large,
          styles[variant],
          hovered && !pressed && hoverStyles[variant],
          pressed && pressedStyles[variant],
          disabled && !loading && styles.disabled,
          style,
        ];
      }}
    >
      {loading ? (
        <ActivityIndicator color={spinnerColor} />
      ) : (
        <Text style={[styles.label, size === "large" && styles.labelLarge, labelStyles[variant]]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: TOUCH,
    paddingHorizontal: 18,
    borderRadius: radius.control,
    borderWidth: 1.5,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  large: { minHeight: 52 },
  primary: { backgroundColor: colors.primary, borderColor: colors.primary },
  secondary: { backgroundColor: colors.surface, borderColor: colors.primary },
  plain: { paddingHorizontal: 12 },
  disabled: { opacity: 0.5 },
  label: { fontSize: 16, fontWeight: "700" },
  labelLarge: { fontSize: 17 },
});

const hoverStyles = StyleSheet.create({
  primary: { backgroundColor: colors.primaryHover, borderColor: colors.primaryHover },
  secondary: { backgroundColor: colors.primaryTint },
  plain: { backgroundColor: colors.primaryTint },
});

const pressedStyles = StyleSheet.create({
  primary: { backgroundColor: colors.primaryPressed, borderColor: colors.primaryPressed },
  secondary: { backgroundColor: colors.openBg },
  plain: { backgroundColor: colors.openBg },
});

const labelStyles = StyleSheet.create({
  primary: { color: colors.onPrimary },
  secondary: { color: colors.primary },
  plain: { color: colors.muted, fontWeight: "600" },
});

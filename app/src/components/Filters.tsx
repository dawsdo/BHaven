import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableStateCallbackType,
} from "react-native";
import { colors, radius } from "../theme";
import { FILTERS } from "../types";

type Props = {
  selected: string[];
  onChange: (next: string[]) => void;
};

// The web has a dedicated attribute for toggle buttons; native screen readers use "selected".
function toggleState(on: boolean) {
  return Platform.OS === "web"
    ? ({ "aria-pressed": on } as object)
    : { accessibilityState: { selected: on } };
}

export function Filters({ selected, onChange }: Props) {
  function toggle(tag: string) {
    onChange(selected.includes(tag) ? selected.filter((t) => t !== tag) : [...selected, tag]);
  }

  return (
    <View style={styles.row} role="group" aria-label="Filter shelters">
      {FILTERS.map(({ tag, label }) => {
        const on = selected.includes(tag);
        return (
          <Pressable
            key={tag}
            // A toggle button, so Enter and Space both work from the keyboard.
            accessibilityRole="button"
            {...toggleState(on)}
            onPress={() => toggle(tag)}
            style={(state) => {
              const { pressed, hovered } = state as PressableStateCallbackType & { hovered?: boolean };
              return [
                styles.chip,
                !on && hovered && styles.chipHover,
                !on && pressed && styles.chipPressed,
                on && styles.chipOn,
                on && (hovered || pressed) && styles.chipOnHover,
              ];
            }}
          >
            <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipHover: { backgroundColor: colors.primaryTint, borderColor: colors.primary },
  chipPressed: { backgroundColor: colors.openBg, borderColor: colors.primary },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipOnHover: { backgroundColor: colors.primaryHover, borderColor: colors.primaryHover },
  chipText: { fontSize: 15, fontWeight: "600", color: colors.ink },
  chipTextOn: { color: colors.onPrimary },
});

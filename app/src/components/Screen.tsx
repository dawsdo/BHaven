import type { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../theme";

type Props = {
  title: string;
  subtitle: string;
  /** Link shown beside the title, for example the way to the staff screen. */
  action?: ReactNode;
  children: ReactNode;
};

/** Page frame shared by both screens: demo notice, safe area, centered column, title. */
export function Screen({ title, subtitle, action, children }: Props) {
  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.notice}>
        <Text style={styles.noticeText}>Demo: counts and amenities are simulated</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.column}>
          <View style={styles.heading}>
            <View style={styles.titleRow}>
              <Text style={styles.title} accessibilityRole="header">
                {title}
              </Text>
              {action}
            </View>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
          {children}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  notice: { backgroundColor: colors.warnBg, paddingHorizontal: 16, paddingVertical: 6 },
  noticeText: { fontSize: 13, fontWeight: "600", color: colors.warnInk, textAlign: "center" },
  scroll: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 48 },
  column: { width: "100%", maxWidth: 560, alignSelf: "center", gap: 16 },
  heading: { gap: 2 },
  titleRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 16 },
  title: { flexShrink: 1, fontSize: 30, lineHeight: 36, fontWeight: "800", color: colors.ink, letterSpacing: -0.5 },
  subtitle: { fontSize: 16, color: colors.muted, lineHeight: 22 },
});

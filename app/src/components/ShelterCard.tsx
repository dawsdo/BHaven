import { useState } from "react";
import { Linking, Platform, StyleSheet, Text, View } from "react-native";
import { colors, FRESH_MINUTES, radius } from "../theme";
import { Button } from "./Button";
import { TAG_LABELS, type Shelter } from "../types";

export function freshnessLabel(minutesAgo: number): string {
  if (minutesAgo < 1) return "Updated just now";
  if (minutesAgo < 60) return `Updated ${minutesAgo} min ago`;
  const hours = Math.floor(minutesAgo / 60);
  return `Updated ${hours} ${hours === 1 ? "hour" : "hours"} ago`;
}

function directionsUrl(shelter: Shelter): string {
  const destination = `${shelter.lat},${shelter.lng}`;
  if (Platform.OS === "ios") {
    return `http://maps.apple.com/?daddr=${destination}&q=${encodeURIComponent(shelter.name)}`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
}

export function ShelterCard({ shelter }: { shelter: Shelter }) {
  const [linkError, setLinkError] = useState<string | null>(null);

  async function open(url: string, fallback: string) {
    setLinkError(null);
    try {
      if (Platform.OS === "web" && url.startsWith("tel:")) {
        window.location.href = url; // stays on this page; the browser hands off to a phone app
      } else {
        await Linking.openURL(url);
      }
    } catch {
      setLinkError(fallback);
    }
  }

  const full = !shelter.expired && shelter.totalOpen === 0;
  const showAge = !shelter.expired && shelter.minutesAgo !== null;
  // Only a recent update gets the green badge. An older count is still shown, but plainly.
  const fresh = showAge && shelter.minutesAgo! < FRESH_MINUTES;
  const hasBadges = shelter.mostRecent || showAge || full;

  return (
    <View style={styles.card} role="listitem">
      <View style={styles.titleRow}>
        <Text style={styles.name} accessibilityRole="header">
          {shelter.name}
        </Text>
        {shelter.distanceMiles !== null && (
          <Text style={styles.distance}>{shelter.distanceMiles.toFixed(1)} mi</Text>
        )}
      </View>

      {hasBadges && (
        <View style={styles.badgeRow}>
          {shelter.mostRecent && (
            <View style={[styles.badge, styles.badgeRecent]}>
              <Text style={[styles.badgeText, styles.badgeRecentText]}>Most recently updated</Text>
            </View>
          )}
          {showAge && (
            <View style={[styles.badge, fresh ? styles.badgeFresh : styles.badgeOlder]}>
              <Text style={[styles.badgeText, fresh ? styles.badgeFreshText : styles.badgeOlderText]}>
                {freshnessLabel(shelter.minutesAgo!)}
              </Text>
            </View>
          )}
          {full && (
            <View style={[styles.badge, styles.badgeFull]}>
              <Text style={[styles.badgeText, styles.badgeFullText]}>Full right now</Text>
            </View>
          )}
        </View>
      )}

      {shelter.expired || shelter.counts === null ? (
        <View style={styles.expiredBox}>
          <Text style={styles.expiredText}>No recent update. Call to confirm.</Text>
        </View>
      ) : (
        <View style={styles.counts}>
          {shelter.counts.map((count) => (
            <View key={count.category} style={styles.countRow}>
              <Text style={styles.countCategory}>
                {count.category}
                {count.capacity != null && (
                  <Text style={styles.capacity}> · {count.capacity} total</Text>
                )}
              </Text>
              <Text style={[styles.countValue, count.openBeds === 0 && styles.countValueFull]}>
                {count.openBeds === 0 ? "Full" : `${count.openBeds} open`}
              </Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.tagRow}>
        {shelter.tags.map((tag) => (
          <View key={tag} style={styles.tag}>
            <Text style={styles.tagText}>{TAG_LABELS[tag] ?? tag}</Text>
          </View>
        ))}
      </View>
      {shelter.languages.length > 0 && (
        <Text style={styles.detail}>Languages: {shelter.languages.join(", ")}</Text>
      )}
      <View style={styles.contact}>
        <Text style={styles.detail} selectable>
          {shelter.address}
        </Text>
        <Text style={[styles.detail, styles.phone]} selectable>
          {shelter.phone}
        </Text>
      </View>

      <View style={styles.actions}>
        <Button
          label="Call"
          accessibilityLabel={`Call ${shelter.name}`}
          onPress={() =>
            open(
              `tel:${shelter.phone.replace(/[^\d+]/g, "")}`,
              `This device can't place calls. Dial ${shelter.phone}.`,
            )
          }
          style={styles.action}
        />
        <Button
          label="Directions"
          variant="secondary"
          accessibilityLabel={`Directions to ${shelter.name}`}
          onPress={() => open(directionsUrl(shelter), `Couldn't open maps. Address: ${shelter.address}`)}
          style={styles.action}
        />
      </View>
      {linkError && <Text style={styles.linkError}>{linkError}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
  },
  titleRow: { flexDirection: "row", alignItems: "baseline", gap: 12 },
  name: { flex: 1, fontSize: 19, fontWeight: "700", color: colors.ink },
  distance: { fontSize: 15, fontWeight: "600", color: colors.muted, fontVariant: ["tabular-nums"] },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 13, fontWeight: "600" },
  badgeRecent: { backgroundColor: colors.primary },
  badgeRecentText: { color: colors.onPrimary },
  badgeFresh: { backgroundColor: colors.openBg },
  badgeFreshText: { color: colors.openInk },
  badgeOlder: { backgroundColor: colors.fullBg },
  badgeOlderText: { color: colors.fullInk },
  badgeFull: { backgroundColor: colors.fullBg },
  badgeFullText: { color: colors.fullInk },
  counts: { gap: 6 },
  countRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 12 },
  countCategory: { flex: 1, fontSize: 16, color: colors.ink },
  capacity: { fontSize: 14, color: colors.muted },
  countValue: { fontSize: 18, fontWeight: "700", color: colors.openInk, fontVariant: ["tabular-nums"] },
  countValueFull: { color: colors.fullInk, fontWeight: "600" },
  expiredBox: { backgroundColor: colors.warnBg, borderRadius: radius.control, padding: 12 },
  expiredText: { fontSize: 15, fontWeight: "600", color: colors.warnInk },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  tagText: { fontSize: 13, color: colors.muted },
  contact: { gap: 2 },
  detail: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  phone: { fontVariant: ["tabular-nums"] },
  actions: { flexDirection: "row", gap: 10 },
  action: { flex: 1 },
  linkError: { fontSize: 14, color: colors.errorInk },
});

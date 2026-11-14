import { Link } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, StyleSheet, Text, View } from "react-native";
import { ApiError, fetchShelters } from "../api";
import { Filters } from "../components/Filters";
import { LocationBar } from "../components/LocationBar";
import { Screen } from "../components/Screen";
import { ShelterCard } from "../components/ShelterCard";
import { colors, radius } from "../theme";
import type { SearchLocation, ShelterListResponse } from "../types";

// Short, so a count a shelter just published shows up while someone is looking at the list.
const REFRESH_MS = 5_000;

function clockTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function ShelterListScreen() {
  const [location, setLocation] = useState<SearchLocation | null>(null);
  const [filters, setFilters] = useState<string[]>([]);
  const [data, setData] = useState<ShelterListResponse | null>(null);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locationNotice, setLocationNotice] = useState<string | null>(null);
  const latestRequest = useRef(0);

  function changeLocation(next: SearchLocation | null) {
    setLocationNotice(null);
    setLocation(next);
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const requestId = ++latestRequest.current;
      try {
        const result = await fetchShelters(location, filters);
        if (cancelled || requestId !== latestRequest.current) return;
        setData(result);
        setLoadedAt(new Date());
        setError(null);
      } catch (err) {
        if (cancelled || requestId !== latestRequest.current) return;
        if (err instanceof ApiError && err.status === 404 && location?.kind === "zip") {
          // Unknown ZIP: say so, then fall back to the unsorted list so filters keep working.
          setLocationNotice(err.message);
          setLocation(null);
          return;
        }
        setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      }
    }

    load();
    const timer = setInterval(load, REFRESH_MS);
    // Refresh at once when the app or browser tab comes back to the front.
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") load();
    });
    return () => {
      cancelled = true;
      clearInterval(timer);
      appState.remove();
    };
  }, [location, filters]);

  const shelters = data?.shelters ?? [];
  const summary =
    data === null
      ? null
      : `${shelters.length} ${shelters.length === 1 ? "shelter" : "shelters"}` +
        (data.locationLabel ? ` · nearest to ${data.locationLabel}` : "");

  // If a refresh fails but a list is already on screen, keep the list and say how old it is.
  const refreshProblem =
    error && data !== null && loadedAt
      ? `Can't refresh right now. This list is from ${clockTime(loadedAt)}. Trying again.`
      : error;
  const notice = locationNotice ?? refreshProblem;

  return (
    <Screen
      title="Open Beds"
      subtitle="Shelter beds open right now. No sign-up needed."
      action={
        <Link href="/staff" replace style={styles.link}>
          Shelter staff
        </Link>
      }
    >
      <LocationBar location={location} onChange={changeLocation} />
      <Filters selected={filters} onChange={setFilters} />

      {notice && (
        <View style={styles.errorBox} accessibilityRole="alert">
          <Text style={styles.errorText}>{notice}</Text>
        </View>
      )}

      {data === null && !error && <ActivityIndicator color={colors.primary} style={styles.loading} />}

      {summary && <Text style={styles.summary}>{summary}</Text>}

      {data !== null && shelters.length === 0 && (
        <Text style={styles.empty}>
          No shelters match these filters. Remove a filter to see more.
        </Text>
      )}

      {shelters.length > 0 && (
        <View style={styles.list} role="list">
          {shelters.map((shelter) => (
            <ShelterCard key={shelter.id} shelter={shelter} />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  link: {
    flexShrink: 0, // the title wraps, never this link
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "600",
    color: colors.primary,
    paddingVertical: 12,
  },
  list: { gap: 16 },
  summary: { fontSize: 14, fontWeight: "600", color: colors.muted },
  loading: { marginTop: 24 },
  empty: { fontSize: 16, color: colors.muted, lineHeight: 22 },
  errorBox: { backgroundColor: colors.errorBg, borderRadius: radius.control, padding: 12 },
  errorText: { fontSize: 15, color: colors.errorInk },
});

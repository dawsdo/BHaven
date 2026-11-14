import { Link } from "expo-router";
import { useEffect, useRef, useState, type ComponentRef } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { ApiError, fetchStaffShelter, saveCounts, staffLogin } from "../api";
import { Button } from "../components/Button";
import { Screen } from "../components/Screen";
import { useStaffSession } from "../session";
import { colors, radius, TOUCH } from "../theme";
import type { Count, StaffShelter } from "../types";

const MAX_BEDS = 999;

export default function StaffScreen() {
  // The session is held above the screens, so visiting the shelter list does not sign staff out.
  const { token, setToken } = useStaffSession();
  const passwordInput = useRef<ComponentRef<typeof TextInput>>(null);
  const [shelter, setShelter] = useState<StaffShelter | null>(null);
  const [draft, setDraft] = useState<Count[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  // Already signed in (came back from the list, or reloaded the page): load the shelter.
  useEffect(() => {
    if (!token || shelter) return;
    let cancelled = false;
    fetchStaffShelter(token)
      .then((loaded) => {
        if (cancelled) return;
        setShelter(loaded);
        setDraft(loaded.counts);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          setToken(null);
          setError(err.message);
        } else {
          setLoadFailed(true);
          setError(err instanceof Error ? err.message : "Couldn't load your shelter. Try again.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, shelter, setToken]);

  async function signIn() {
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const newToken = await staffLogin(email, password);
      const loaded = await fetchStaffShelter(newToken);
      setShelter(loaded);
      setDraft(loaded.counts);
      setToken(newToken);
      setPassword("");
      setSavedAt(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't sign in. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function signOut(message: string | null = null) {
    setToken(null);
    setShelter(null);
    setDraft([]);
    setSavedAt(null);
    setLoadFailed(false);
    setError(message);
  }

  function change(category: string, delta: number) {
    setSavedAt(null);
    setDraft((current) =>
      current.map((c) =>
        c.category === category
          ? { ...c, openBeds: Math.min(c.capacity ?? MAX_BEDS, Math.max(0, c.openBeds + delta)) }
          : c,
      ),
    );
  }

  async function publish() {
    if (!token || !shelter) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await saveCounts(token, shelter.id, draft);
      setShelter(updated);
      setDraft(updated.counts);
      setSavedAt(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        signOut(err.message);
      } else {
        setError(err instanceof Error ? err.message : "Couldn't save. Your counts were not published.");
      }
    } finally {
      setBusy(false);
    }
  }

  const changed =
    shelter !== null &&
    draft.some((c) => shelter.counts.find((s) => s.category === c.category)?.openBeds !== c.openBeds);

  return (
    <Screen
      title={shelter ? shelter.name : "Shelter staff"}
      subtitle={
        shelter
          ? "Set the beds open right now, then publish."
          : "Sign in to update your shelter's open beds."
      }
      action={
        <Link href="/" replace style={styles.link}>
          Shelter list
        </Link>
      }
    >
      {error && (
        <View style={styles.errorBox} accessibilityRole="alert">
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {shelter === null && token ? (
        // Signed in, shelter still loading (or it failed and the message above says why).
        loadFailed ? (
          <Pressable accessibilityRole="button" onPress={() => signOut()} style={styles.signOut}>
            <Text style={styles.link}>Sign out</Text>
          </Pressable>
        ) : (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        )
      ) : shelter === null ? (
        <View style={styles.card}>
          <View style={styles.field}>
            <Text style={styles.label}>Work email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              inputMode="email"
              returnKeyType="next"
              onSubmitEditing={() => (password ? signIn() : passwordInput.current?.focus())}
              accessibilityLabel="Work email"
              style={styles.input}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              ref={passwordInput}
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={signIn}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="current-password"
              accessibilityLabel="Password"
              style={styles.input}
            />
          </View>
          <Button label="Sign in" size="large" loading={busy} onPress={signIn} />
        </View>
      ) : (
        <>
          <View style={styles.card}>
            {draft.map((count) => (
              <View key={count.category} style={styles.stepperRow}>
                <View style={styles.categoryBlock}>
                  <Text style={styles.category}>{count.category}</Text>
                  {count.capacity != null && (
                    <Text style={styles.capacity}>{count.capacity} total</Text>
                  )}
                </View>
                <View style={styles.stepper}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`One fewer open in ${count.category}`}
                    onPress={() => change(count.category, -1)}
                    disabled={count.openBeds === 0}
                    style={({ pressed }) => [
                      styles.stepButton,
                      count.openBeds === 0 && styles.stepDisabled,
                      pressed && styles.secondaryPressed,
                    ]}
                  >
                    <Text style={styles.stepText}>−</Text>
                  </Pressable>
                  <Text style={styles.value} accessibilityLabel={`${count.openBeds} open`}>
                    {count.openBeds}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`One more open in ${count.category}`}
                    onPress={() => change(count.category, 1)}
                    disabled={count.openBeds >= (count.capacity ?? MAX_BEDS)}
                    style={({ pressed }) => [
                      styles.stepButton,
                      count.openBeds >= (count.capacity ?? MAX_BEDS) && styles.stepDisabled,
                      pressed && styles.secondaryPressed,
                    ]}
                  >
                    <Text style={styles.stepText}>+</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>

          <Button
            label={changed ? "Publish new counts" : "Confirm counts are current"}
            size="large"
            loading={busy}
            onPress={publish}
          />

          {savedAt ? (
            <View style={styles.savedBox}>
              <Text style={styles.savedText}>
                Published at {savedAt}. Clients see these counts now.
              </Text>
            </View>
          ) : (
            <Text style={styles.note}>
              {changed
                ? "You have changes that are not published yet."
                : "Counts disappear from the public list 24 hours after the last publish. Confirm them each day, even when nothing changed."}
            </Text>
          )}

          <Pressable accessibilityRole="button" onPress={() => signOut()} style={styles.signOut}>
            <Text style={styles.link}>Sign out</Text>
          </Pressable>
        </>
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
  loading: { marginTop: 24 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 16,
  },
  field: { gap: 6 },
  label: { fontSize: 15, fontWeight: "600", color: colors.ink },
  input: {
    minHeight: TOUCH,
    borderRadius: radius.control,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    fontSize: 17,
    color: colors.ink,
  },
  secondaryPressed: { backgroundColor: colors.openBg },
  stepperRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  categoryBlock: { flex: 1, gap: 2 },
  category: { fontSize: 17, fontWeight: "600", color: colors.ink },
  capacity: { fontSize: 14, color: colors.muted },
  stepper: { flexDirection: "row", alignItems: "center", gap: 6 },
  stepButton: {
    width: 52,
    height: 52,
    borderRadius: radius.control,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  stepDisabled: { borderColor: colors.border, opacity: 0.5 },
  stepText: { fontSize: 26, fontWeight: "600", color: colors.primary, lineHeight: 30 },
  value: {
    minWidth: 56,
    textAlign: "center",
    fontSize: 26,
    fontWeight: "800",
    color: colors.ink,
    fontVariant: ["tabular-nums"],
  },
  savedBox: { backgroundColor: colors.openBg, borderRadius: radius.control, padding: 12 },
  savedText: { fontSize: 15, fontWeight: "600", color: colors.openInk },
  note: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  signOut: { alignSelf: "flex-start" },
  errorBox: { backgroundColor: colors.errorBg, borderRadius: radius.control, padding: 12 },
  errorText: { fontSize: 15, color: colors.errorInk },
});

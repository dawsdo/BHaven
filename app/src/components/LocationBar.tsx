import * as Location from "expo-location";
import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { colors, radius, TOUCH } from "../theme";
import type { SearchLocation } from "../types";
import { Button } from "./Button";

const LOCATION_TIMEOUT_MS = 10_000;

type Props = {
  location: SearchLocation | null;
  onChange: (next: SearchLocation | null) => void;
};

export function LocationBar({ location, onChange }: Props) {
  const [zip, setZip] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  function submitZip() {
    const value = zip.trim();
    if (!/^\d{5}$/.test(value)) {
      setMessage("Enter a 5-digit ZIP code.");
      return;
    }
    setMessage(null);
    onChange({ kind: "zip", zip: value });
  }

  async function useDeviceLocation() {
    setMessage(null);
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setMessage("Location is turned off for this app. Enter a ZIP code instead.");
        return;
      }
      // Some devices never answer (location services off, weak signal). Give up after a
      // few seconds so the button does not spin forever.
      const position = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), LOCATION_TIMEOUT_MS),
        ),
      ]);
      setZip("");
      onChange({ kind: "gps", lat: position.coords.latitude, lng: position.coords.longitude });
    } catch {
      setMessage("Couldn't get your location. Enter a ZIP code instead.");
    } finally {
      setLocating(false);
    }
  }

  function clear() {
    setZip("");
    setMessage(null);
    onChange(null);
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <TextInput
          value={zip}
          onChangeText={(text) => setZip(text.replace(/\D/g, ""))}
          onSubmitEditing={submitZip}
          placeholder="ZIP code"
          placeholderTextColor={colors.muted}
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={5}
          returnKeyType="search"
          accessibilityLabel="ZIP code"
          style={styles.input}
        />
        <Button label="Search" onPress={submitZip} />
      </View>

      <View style={styles.row}>
        <Button
          label="Use my location"
          variant="secondary"
          loading={locating}
          onPress={useDeviceLocation}
          style={styles.grow}
        />
        {location && <Button label="Clear" variant="plain" onPress={clear} />}
      </View>

      {message && <Text style={styles.message}>{message}</Text>}
      <Text style={styles.note}>Your location is used once to sort the list. It is not saved.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  row: { flexDirection: "row", gap: 10 },
  grow: { flex: 1 },
  input: {
    flex: 1,
    minHeight: TOUCH,
    borderRadius: radius.control,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    fontSize: 17,
    color: colors.ink,
  },
  message: { fontSize: 14, color: colors.errorInk },
  note: { fontSize: 13, color: colors.muted },
});

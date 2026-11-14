/**
 * Draw Karo — Home screen.
 * Name + avatar → Create Room / Join with code. Navigates to /room on success.
 */
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { t } from "../lib/strings";
import { useGame } from "../store/game";

export default function HomeScreen() {
  const router = useRouter();
  const profile = useGame((s) => s.profile);
  const setName = useGame((s) => s.setName);
  const connection = useGame((s) => s.connection);
  const errorMsg = useGame((s) => s.errorMsg);
  const room = useGame((s) => s.room);
  const createRoom = useGame((s) => s.createRoom);
  const joinRoom = useGame((s) => s.joinRoom);
  const [code, setCode] = useState("");
  const [joinMode, setJoinMode] = useState(false);

  useEffect(() => {
    if (room) router.replace("/room");
  }, [room, router]);

  const busy = connection === "connecting";
  const canJoin = profile.name.trim().length >= 1 && code.trim().length === 4;

  return (
    <View style={styles.container}>
      <View style={styles.art}>
        <View style={[styles.dot, { backgroundColor: "#ffd700", width: 76, height: 76, top: -6, left: 30 }]} />
        <View style={[styles.dot, { backgroundColor: "#e5484d", width: 52, height: 52, top: -20, left: 150 }]} />
        <View style={[styles.dot, { backgroundColor: "#1a9e4b", width: 60, height: 60, top: 6, left: 220 }]} />
      </View>

      <Text style={styles.title}>Draw Karo!</Text>
      <Text style={styles.tagline}>{t.tagline}</Text>

      <TextInput
        style={styles.nameInput}
        value={profile.name}
        onChangeText={setName}
        placeholder={t.namePlaceholder}
        placeholderTextColor="#9fc9f5"
        maxLength={16}
        autoCapitalize="words"
      />

      {joinMode ? (
        <TextInput
          style={[styles.nameInput, styles.codeInput]}
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4))}
          placeholder={t.roomCodePlaceholder}
          placeholderTextColor="#9fc9f5"
          autoCapitalize="characters"
        />
      ) : null}

      {joinMode ? (
        <Pressable
          style={[styles.btn, styles.btnSecondary, (!canJoin || busy) && styles.disabled]}
          disabled={!canJoin || busy}
          onPress={() => joinRoom(code)}
        >
          <Text style={[styles.btnText, styles.btnSecondaryText]}>
            {busy ? t.connecting : t.joinRoom}
          </Text>
        </Pressable>
      ) : (
        <Pressable
          style={[styles.btn, profile.name.trim() ? null : styles.disabled]}
          disabled={!profile.name.trim() || busy}
          onPress={() => createRoom()}
        >
          <Text style={[styles.btnText, styles.btnPrimaryText]}>
            {busy ? t.connecting : t.createRoom}
          </Text>
        </Pressable>
      )}

      <Pressable style={styles.linkBtn} onPress={() => setJoinMode((v) => !v)}>
        <Text style={styles.linkText}>
          {joinMode ? t.backToCreate : t.joinWithCode}
        </Text>
      </Pressable>

      {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}

      <Text style={styles.footer}>{t.footer}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#208AEF",
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 24,
    gap: 14,
  },
  art: {
    width: 320,
    height: 130,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#1b6ec2",
  },
  dot: { position: "absolute", borderRadius: 99 },
  title: {
    fontSize: 44,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: 1,
  },
  tagline: { fontSize: 15, color: "#dbeeff", fontWeight: "600" },
  nameInput: {
    backgroundColor: "#ffffff18",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: "#ffffff",
    fontSize: 16,
    alignSelf: "stretch",
    textAlign: "center",
    marginTop: 8,
  },
  codeInput: { letterSpacing: 8, fontWeight: "800", fontSize: 20 },
  btn: {
    borderRadius: 16,
    paddingVertical: 14,
    alignSelf: "stretch",
    alignItems: "center",
    backgroundColor: "#ffd700",
  },
  btnText: { fontSize: 17, fontWeight: "900" },
  btnPrimaryText: { color: "#0b2545" },
  btnSecondary: { backgroundColor: "#ffffff" },
  btnSecondaryText: { color: "#0b2545" },
  disabled: { opacity: 0.4 },
  linkBtn: { paddingVertical: 8 },
  linkText: { color: "#dbeeff", fontWeight: "700", fontSize: 14 },
  error: { color: "#ffb4b4", fontWeight: "700", textAlign: "center" },
  footer: {
    color: "#9fc9f5",
    fontSize: 12,
    textAlign: "center",
    marginTop: "auto",
    marginBottom: 24,
  },
});

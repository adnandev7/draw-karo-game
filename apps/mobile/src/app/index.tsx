/**
 * Draw Karo — Home screen.
 * Name + avatar → Create Room / Join with code. Navigates to /room on success.
 */
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Canvas, Circle, Fill } from "@shopify/react-native-skia";
import { useRouter } from "expo-router";
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
      <Canvas style={styles.art}>
        <Fill color="#208AEF" />
        <Circle cx={80} cy={60} r={38} color="#ffd700" />
        <Circle cx={190} cy={40} r={26} color="#e5484d" />
        <Circle cx={260} cy={80} r={30} color="#1a9e4b" />
      </Canvas>

      <Text style={styles.title}>Draw Karo!</Text>
      <Text style={styles.tagline}>Banao. Pehchano. Haso. 🎨</Text>

      <TextInput
        style={styles.nameInput}
        value={profile.name}
        onChangeText={setName}
        placeholder="Tumhara naam?"
        placeholderTextColor="#9fc9f5"
        maxLength={16}
        autoCapitalize="words"
      />

      {joinMode ? (
        <TextInput
          style={[styles.nameInput, styles.codeInput]}
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4))}
          placeholder="Room code (e.g. K7TP)"
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
            {busy ? "Connecting..." : "Join Room 🚪"}
          </Text>
        </Pressable>
      ) : (
        <Pressable
          style={[styles.btn, profile.name.trim() ? null : styles.disabled]}
          disabled={!profile.name.trim() || busy}
          onPress={() => createRoom()}
        >
          <Text style={[styles.btnText, styles.btnPrimaryText]}>
            {busy ? "Connecting..." : "Naya Room Banao 🎨"}
          </Text>
        </Pressable>
      )}

      <Pressable style={styles.linkBtn} onPress={() => setJoinMode((v) => !v)}>
        <Text style={styles.linkText}>
          {joinMode ? "← Naya room banao" : "Code se join karo 🔑"}
        </Text>
      </Pressable>

      {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}

      <Text style={styles.footer}>Free forever · Room code dost ko bhejo aur khelo 🎉</Text>
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
  art: { width: 320, height: 130, borderRadius: 20, overflow: "hidden" },
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

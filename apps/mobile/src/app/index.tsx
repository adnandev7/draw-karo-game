/**
 * Draw Karo — Home screen (skribbl-style):
 * playful blue world, logo, player card with avatar customizer,
 * big green Create Room, blue Join with a code.
 */
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { t } from "../lib/strings";
import { C, F, flatShadow } from "../lib/theme";
import { useGame } from "../store/game";
import { Avatar, ACCESSORY_IDS, EXPRESSION_IDS, HAIRSTYLE_IDS } from "../components/Avatar";

const SKIN_TONES = ["#ffdbac", "#f1c27d", "#c68642", "#8d5524", "#5c3317"];
const OUTFIT_COLORS = ["#e5484d", "#f4a300", "#1a9e4b", "#2c8de7", "#8e44ad", "#e84393"];

export default function HomeScreen() {
  const router = useRouter();
  const profile = useGame((s) => s.profile);
  const setName = useGame((s) => s.setName);
  const setAvatar = useGame((s) => s.setAvatar);
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

  const cycle = (list: string[], current: string, dir: number): string => {
    const i = list.indexOf(current);
    const next = (i + dir + list.length) % list.length;
    return list[next];
  };
  const nudge = (key: "expression" | "hairstyle" | "accessory", dir: number) => {
    const list =
      key === "expression" ? EXPRESSION_IDS : key === "hairstyle" ? HAIRSTYLE_IDS : ACCESSORY_IDS;
    setAvatar({ [key]: cycle(list, profile.avatar[key], dir) } as const);
  };
  const randomize = () => {
    const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
    setAvatar({
      skinTone: pick(SKIN_TONES),
      expression: pick(EXPRESSION_IDS),
      hairstyle: pick(HAIRSTYLE_IDS),
      accessory: pick(ACCESSORY_IDS),
      outfitColor: pick(OUTFIT_COLORS),
    });
  };

  return (
    <View style={styles.container}>
      {/* floating bubbles */}
      <View style={[styles.bubble, { width: 120, height: 120, top: 40, left: -30, opacity: 0.08 }]} />
      <View style={[styles.bubble, { width: 70, height: 70, top: 150, right: -20, opacity: 0.1 }]} />
      <View style={[styles.bubble, { width: 46, height: 46, bottom: 120, left: 30, opacity: 0.09 }]} />

      {/* logo */}
      <View style={styles.logoWrap}>
        <Text style={styles.logo}>
          Draw <Text style={styles.logoKaro}>Karo!</Text>
        </Text>
        <View style={styles.logoPen}>
          <Text style={{ fontSize: 20 }}>✏️</Text>
        </View>
      </View>
      <Text style={styles.tagline}>{t.tagline}</Text>

      {/* player card */}
      <View style={[styles.card, flatShadow]}>
        <View style={styles.customizer}>
          <ArrowCol dir="left" onPress={(k) => nudge(k, -1)} />
          <Avatar avatar={profile.avatar} size={96} />
          <ArrowCol dir="right" onPress={(k) => nudge(k, 1)} />
          <Pressable style={styles.randomize} onPress={randomize}>
            <Text style={{ fontSize: 18 }}>🎲</Text>
          </Pressable>
        </View>
        <Text style={styles.hint}>{t.avatarHint}</Text>
        <TextInput
          style={styles.nameInput}
          value={profile.name}
          onChangeText={setName}
          placeholder={t.namePlaceholder}
          placeholderTextColor={C.panelDim}
          maxLength={16}
          autoCapitalize="words"
        />
      </View>

      {joinMode ? (
        <TextInput
          style={[styles.nameInput, styles.codeInput]}
          value={code}
          onChangeText={(v) => setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4))}
          placeholder={t.roomCodePlaceholder}
          placeholderTextColor={C.panelDim}
          autoCapitalize="characters"
        />
      ) : null}

      {joinMode ? (
        <Pressable
          style={[styles.btn, styles.btnBlue, (!canJoin || busy) && styles.disabled]}
          disabled={!canJoin || busy}
          onPress={() => joinRoom(code)}
        >
          <Text style={styles.btnText}>{busy ? t.connecting : t.joinRoom}</Text>
        </Pressable>
      ) : (
        <Pressable
          style={[styles.btn, styles.btnGreen, (!profile.name.trim() || busy) && styles.disabled]}
          disabled={!profile.name.trim() || busy}
          onPress={() => createRoom()}
        >
          <Text style={styles.btnText}>{busy ? t.connecting : t.createRoom}</Text>
        </Pressable>
      )}

      <Pressable style={styles.linkBtn} onPress={() => setJoinMode((v) => !v)}>
        <Text style={styles.linkText}>{joinMode ? t.backToCreate : t.joinWithCode}</Text>
      </Pressable>

      {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}

      <Text style={styles.footer}>{t.footer}</Text>
    </View>
  );
}

function ArrowCol({
  dir,
  onPress,
}: {
  dir: "left" | "right";
  onPress: (key: "expression" | "hairstyle" | "accessory") => void;
}) {
  return (
    <View style={styles.arrowCol}>
      <Pressable style={styles.arrow} onPress={() => onPress("hairstyle")}>
        <Text style={styles.arrowText}>{dir === "left" ? "◀" : "▶"}</Text>
      </Pressable>
      <Pressable style={styles.arrow} onPress={() => onPress("expression")}>
        <Text style={styles.arrowText}>{dir === "left" ? "◀" : "▶"}</Text>
      </Pressable>
      <Pressable style={styles.arrow} onPress={() => onPress("accessory")}>
        <Text style={styles.arrowText}>{dir === "left" ? "◀" : "▶"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
    alignItems: "center",
    paddingTop: 52,
    paddingHorizontal: 24,
    gap: 12,
  },
  bubble: {
    position: "absolute",
    borderRadius: 99,
    backgroundColor: "#ffffff",
  },
  logoWrap: { position: "relative" },
  logo: {
    fontSize: 46,
    fontFamily: F.black,
    color: "#ffffff",
    letterSpacing: 1,
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 3, height: 3 },
    textShadowRadius: 0,
  },
  logoKaro: { color: C.gold },
  logoPen: {
    position: "absolute",
    top: -10,
    right: -18,
    transform: [{ rotate: "35deg" }],
  },
  tagline: {
    fontSize: 14,
    color: "#cfe0ff",
    fontFamily: F.bold,
    marginBottom: 6,
  },
  card: {
    backgroundColor: C.panel,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.panelBorder,
    padding: 14,
    gap: 8,
    alignSelf: "stretch",
    maxWidth: 420,
    width: "100%",
    alignItems: "center",
  },
  customizer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    position: "relative",
  },
  arrowCol: { gap: 8 },
  arrow: {
    width: 30,
    height: 22,
    borderRadius: 3,
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  arrowText: { color: "#ffffff", fontSize: 10, fontFamily: F.black },
  randomize: {
    position: "absolute",
    top: -6,
    right: -10,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    ...flatShadow,
  },
  hint: {
    color: C.panelDim,
    fontSize: 11,
    fontFamily: F.regular,
    marginTop: -2,
  },
  nameInput: {
    backgroundColor: C.inputBg,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: C.inputBorder,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: C.inputText,
    fontSize: 16,
    fontFamily: F.bold,
    alignSelf: "stretch",
    textAlign: "center",
  },
  codeInput: {
    maxWidth: 420,
    width: "100%",
    letterSpacing: 8,
    fontFamily: F.black,
    fontSize: 20,
  },
  btn: {
    borderRadius: 4,
    paddingVertical: 13,
    alignSelf: "stretch",
    maxWidth: 420,
    width: "100%",
    alignItems: "center",
    ...flatShadow,
  },
  btnGreen: { backgroundColor: C.green },
  btnBlue: { backgroundColor: C.blue },
  btnText: {
    fontSize: 18,
    fontFamily: F.black,
    color: "#ffffff",
    textShadowColor: "rgba(0,0,0,0.18)",
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 0,
  },
  disabled: { opacity: 0.45 },
  linkBtn: { paddingVertical: 8 },
  linkText: { color: "#cfe0ff", fontFamily: F.bold, fontSize: 14 },
  error: { color: "#ffb4b4", fontFamily: F.bold, textAlign: "center" },
  footer: {
    color: "#9fc9f5",
    fontSize: 12,
    fontFamily: F.regular,
    textAlign: "center",
    marginTop: "auto",
    marginBottom: 24,
  },
});

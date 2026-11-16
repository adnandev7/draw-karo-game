/**
 * Draw Karo — Home screen (skribbl-style):
 * playful blue doodle world, bouncing multicolor logo, player card with
 * avatar customizer, big green Create Room, blue Join with a code.
 * Everything is centered in one column that scales with the viewport.
 */
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { t } from "../lib/strings";
import { C, F, R } from "../lib/theme";
import { useGame } from "../store/game";
import { Avatar, BLOB_COLORS, EXPRESSION_IDS, MOUTH_IDS } from "../components/Avatar";
import { Logo } from "../components/Logo";
import { HomeBackdrop } from "../components/HomeBackdrop";

/** Max width of the center column — everything below the logo lives here. */
const COLUMN = 420;

export default function HomeScreen() {
  const router = useRouter();
  // shareable invite links land here: /?code=TLC7
  const params = useLocalSearchParams<{ code?: string | string[] }>();
  const linkCode = (
    Array.isArray(params.code) ? params.code[0] : params.code ?? ""
  )
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 4);
  const profile = useGame((s) => s.profile);
  const setName = useGame((s) => s.setName);
  const setAvatar = useGame((s) => s.setAvatar);
  const connection = useGame((s) => s.connection);
  const errorMsg = useGame((s) => s.errorMsg);
  const room = useGame((s) => s.room);
  const createRoom = useGame((s) => s.createRoom);
  const joinRoom = useGame((s) => s.joinRoom);
  const leaveRoom = useGame((s) => s.leaveRoom);
  const [code, setCode] = useState("");
  const [joinMode, setJoinMode] = useState(false);
  /** Set only when the user just tapped create/join — never by a stale room. */
  const enteringRef = useRef(false);

  // Arrived home while still holding a room (e.g. the browser back button
  // from /room): that back press means "leave" — clear the room so home is
  // fresh instead of yanking the player straight back into it.
  useEffect(() => {
    if (useGame.getState().room) leaveRoom();
  }, [leaveRoom]);

  // Invite link: open the join screen with the code prefilled, and if the
  // player already has a name, join straight away — one tap from a shared URL.
  const autoJoined = useRef(false);
  useEffect(() => {
    if (!linkCode || autoJoined.current) return;
    autoJoined.current = true;
    setJoinMode(true);
    setCode(linkCode);
    if (profile.name.trim() && !useGame.getState().room) {
      enteringRef.current = true;
      joinRoom(linkCode);
    }
    // runs once per arrival — a stale link must never re-trigger a join
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkCode]);

  // Create/join succeeded → go to the room with `push` so the browser's
  // back button returns home (replace() erased home from history, which
  // is why back used to close the site).
  useEffect(() => {
    if (room && enteringRef.current) {
      enteringRef.current = false;
      router.push("/room");
    }
  }, [room, router]);

  const busy = connection === "connecting";
  const canJoin = profile.name.trim().length >= 1 && code.trim().length === 4;

  const cycle = (list: readonly string[], current: string, dir: number): string => {
    const i = list.indexOf(current);
    const next = (i + dir + list.length) % list.length;
    return list[next];
  };
  /** One arrow row: (1) eyes+brows, (2) mouth, (3) blob color — skribbl's three rows. */
  const nudge = (key: "expression" | "mouth" | "skinTone", dir: number) => {
    const list =
      key === "expression" ? EXPRESSION_IDS : key === "mouth" ? MOUTH_IDS : BLOB_COLORS;
    setAvatar({ [key]: cycle(list, profile.avatar[key] ?? list[0], dir) } as const);
    // skribbl's avatar_bounce — the cycled layer dips; a color swap pops the body
    if (key === "expression") setEyesBounce((v) => v + 1);
    else if (key === "mouth") setMouthBounce((v) => v + 1);
    else setPop((v) => v + 1);
  };
  const [pop, setPop] = useState(0);
  const [eyesBounce, setEyesBounce] = useState(0);
  const [mouthBounce, setMouthBounce] = useState(0);
  const randomize = () => {
    const pick = <T,>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];
    setAvatar({
      skinTone: pick(BLOB_COLORS),
      expression: pick(EXPRESSION_IDS),
      mouth: pick(MOUTH_IDS),
    });
    setPop((v) => v + 1); // skribbl's avatar_clicked pop on the dice
  };

  return (
    <View style={styles.container}>
      <HomeBackdrop />

      {/* logo */}
      <View style={styles.logoZone}>
        <Logo size={54} />
        <Text style={styles.tagline}>{t.tagline}</Text>
      </View>

      {/* center column */}
      <View style={styles.column}>
        <View style={styles.card}>
          {/* avatar stage — darker inset panel, chunky arrows flank, funky dice top-right */}
          <View style={styles.stage}>
            <ArrowCol dir="left" onPress={(k) => nudge(k, -1)} />
            <Avatar
              avatar={profile.avatar}
              size={92}
              pop={pop}
              eyesBounce={eyesBounce}
              mouthBounce={mouthBounce}
            />
            <ArrowCol dir="right" onPress={(k) => nudge(k, 1)} />
            <Pressable
              style={({ pressed }) => [styles.randomize, pressed && styles.randomizePressed]}
              onPress={randomize}
              accessibilityLabel={t.avatarHint}
            >
              <FunkyDice />
            </Pressable>
          </View>
          <View style={styles.inputGlow}>
            <View style={styles.inputShell}>
              <TextInput
                style={styles.nameInput}
                value={profile.name}
                onChangeText={setName}
                placeholder={t.namePlaceholder}
                placeholderTextColor={C.panelDim}
                maxLength={16}
                autoCapitalize="words"
                autoFocus={!!linkCode && !profile.name.trim()}
              />
            </View>
          </View>
        </View>

        {joinMode ? (
          <View style={styles.inputGlow}>
            <View style={styles.inputShell}>
              <TextInput
                style={[styles.nameInput, styles.codeInput]}
                value={code}
                onChangeText={(v) => setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4))}
                placeholder={t.roomCodePlaceholder}
                placeholderTextColor={C.panelDim}
                autoCapitalize="characters"
              />
            </View>
          </View>
        ) : null}

        {joinMode ? (
          <PillButton blue disabled={!canJoin || busy} onPress={() => {
            enteringRef.current = true;
            joinRoom(code);
          }}>
            {busy ? t.connecting : t.joinRoom}
          </PillButton>
        ) : (
          <PillButton disabled={!profile.name.trim() || busy} onPress={() => {
            enteringRef.current = true;
            createRoom();
          }}>
            {busy ? t.connecting : t.createRoom}
          </PillButton>
        )}

        <Pressable style={styles.linkBtn} onPress={() => setJoinMode((v) => !v)}>
          <Text style={styles.linkText}>{joinMode ? t.backToCreate : t.joinWithCode}</Text>
        </Pressable>

        {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}
      </View>

      <Text style={styles.footer}>{t.footer}</Text>
    </View>
  );
}

/** Big pill button with press-scale feedback. */
export function PillButton({
  children,
  blue,
  disabled,
  onPress,
}: {
  children: React.ReactNode;
  blue?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      style={[
        styles.btn,
        blue ? styles.btnBlue : styles.btnGreen,
        disabled && styles.disabled,
        pressed && !disabled && styles.btnPressed,
      ]}
      disabled={disabled}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onPress={onPress}
    >
      <Text style={styles.btnText}>{children}</Text>
    </Pressable>
  );
}

function ArrowCol({
  dir,
  onPress,
}: {
  dir: "left" | "right";
  onPress: (key: "expression" | "mouth" | "skinTone") => void;
}) {
  return (
    <View style={styles.arrowCol}>
      <ArrowBtn dir={dir} onPress={() => onPress("expression")} />
      <ArrowBtn dir={dir} onPress={() => onPress("mouth")} />
      <ArrowBtn dir={dir} onPress={() => onPress("skinTone")} />
    </View>
  );
}

function ArrowBtn({ dir, onPress }: { dir: "left" | "right"; onPress: () => void }) {
  const deg = dir === "left" ? "-135deg" : "45deg";
  return (
    <Pressable style={({ pressed }) => [styles.arrow, pressed && styles.arrowPressed]} onPress={onPress}>
      {/* dark edge behind, white chunky chevron on top — skribbl's arrow.gif feel */}
      <View style={[styles.chev, styles.chevShadow, { transform: [{ rotate: deg }, { translateX: 1.5 }, { translateY: 2 }] }]} />
      <View style={[styles.chev, { transform: [{ rotate: deg }] }]} />
    </Pressable>
  );
}

/** Cartoon randomize dice — tilted white cube with pips, like skribbl's randomize.gif. */
function FunkyDice() {
  const s = 26;
  const pip = s * 0.16;
  const c = s / 2 - pip / 2;
  const dots: [number, number][] = [
    [c, c], // center
    [s * 0.08, s * 0.08], // TL
    [s * 0.84 - pip, s * 0.84 - pip], // BR
    [s * 0.08, s * 0.84 - pip], // BL
    [s * 0.84 - pip, s * 0.08], // TR
  ];
  return (
    <View style={{ width: s * 1.15, height: s * 1.15, alignItems: "center", justifyContent: "center" }}>
      <View
        style={{
          width: s,
          height: s,
          borderRadius: s * 0.22,
          backgroundColor: "#ffffff",
          borderWidth: Math.max(2, s * 0.09),
          borderColor: "#1d2b4f",
          transform: [{ rotate: "-12deg" }],
        }}
      >
        {dots.map(([x, y], i) => (
          <View
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: pip,
              height: pip,
              borderRadius: pip / 2,
              backgroundColor: "#1d2b4f",
            }}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
    alignItems: "center",
    paddingTop: 44,
  },
  logoZone: {
    alignItems: "center",
    gap: 4,
    marginBottom: 18,
  },
  tagline: {
    fontSize: 14,
    color: "#cfe0ff",
    fontFamily: F.bold,
  },
  column: {
    width: "100%",
    maxWidth: COLUMN,
    alignItems: "center",
    alignSelf: "center",
    paddingHorizontal: 20,
    gap: 12,
  },
  card: {
    backgroundColor: C.panel,
    borderRadius: R.m + 4,
    borderWidth: 1,
    borderColor: C.panelBorder,
    padding: 12,
    gap: 12,
    width: "100%",
    alignItems: "stretch",
  },
  stage: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
    backgroundColor: "rgba(0,0,0,0.22)",
    borderRadius: R.m,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.25)",
    paddingVertical: 14,
    paddingHorizontal: 16,
    position: "relative",
  },
  arrowCol: { gap: 14 },
  arrow: {
    width: 30,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  arrowPressed: { transform: [{ scale: 0.88 }], opacity: 0.75 },
  chev: {
    position: "absolute",
    width: 15,
    height: 15,
    borderTopWidth: 5,
    borderRightWidth: 5,
    borderColor: "#ffffff",
    borderTopRightRadius: 3,
  },
  chevShadow: { borderColor: "rgba(9,20,48,0.55)" },
  randomize: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  randomizePressed: { transform: [{ scale: 0.85 }, { rotate: "12deg" }] },
  // Skribbl's input look: white rounded-rect (not a pill), left-aligned text,
  // soft blue glow ring hugging the field — ring lives on this wrapper so it
  // renders identically at any DPI, and no inner border of any kind.
  inputGlow: {
    alignSelf: "stretch",
    width: "100%",
    borderRadius: 14,
    padding: 4,
    backgroundColor: C.inputGlow,
  },
  inputShell: {
    alignSelf: "stretch",
    width: "100%",
    height: 44,
    borderRadius: 10,
    backgroundColor: C.inputBg,
    overflow: "hidden",
  },
  nameInput: {
    height: "100%",
    paddingHorizontal: 14,
    color: C.inputText,
    fontSize: 16,
    fontFamily: F.bold,
    textAlign: "left",
  },
  codeInput: {
    letterSpacing: 4,
    fontFamily: F.black,
    fontSize: 18,
    textAlign: "left",
  },
  btn: {
    borderRadius: R.pill,
    paddingVertical: 14,
    width: "100%",
    alignItems: "center",
  },
  btnGreen: { backgroundColor: C.green },
  btnBlue: { backgroundColor: C.blue },
  btnPressed: { transform: [{ scale: 0.97 }] },
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
    marginBottom: 20,
  },
});

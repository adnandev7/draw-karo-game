/**
 * Chat + guess panel — skribbl-style light chat: alternating rows,
 * green rows for correct guesses, system lines in dim italic.
 */
import { useEffect, useRef, useState, type ComponentRef } from "react";
import { FlatList, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { ChatEntry } from "@drawkaro/shared";
import { t } from "../../lib/strings";
import { C, F, R } from "../../lib/theme";

/** How long the "you guessed it!" toast stays up before chat returns. */
const GUESS_TOAST_MS = 4000;

type Props = {
  entries: ChatEntry[];
  isDrawer: boolean;
  guessedCurrent: boolean;
  onSubmit: (text: string) => void;
  /** "So close! Keep guessing" pill — shown in the chat area like skribbl. */
  closeHint?: string | null;
  /** Changes each turn/round — refocuses the field so typing lands instantly. */
  focusKey?: string;
  /** Mobile-web: hide the message list so canvas + input fit above the keyboard. */
  compact?: boolean;
  /** Notifies the room when the guess field gains/loses focus (keyboard handling). */
  onFocusChange?: (focused: boolean) => void;
};

export function ChatPanel({ entries, isDrawer, guessedCurrent, onSubmit, closeHint, focusKey, compact, onFocusChange }: Props) {
  const [text, setText] = useState("");
  const listRef = useRef<FlatList<ChatEntry>>(null);
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);

  // the guess toast shows once when you guess right, then chat comes back —
  // guessed players can keep chatting (server routes their messages as chat)
  const [toast, setToast] = useState(false);
  useEffect(() => {
    if (!guessedCurrent) {
      const off = setTimeout(() => setToast(false), 0);
      return () => clearTimeout(off);
    }
    const on = setTimeout(() => setToast(true), 0);
    const hide = setTimeout(() => setToast(false), GUESS_TOAST_MS);
    return () => {
      clearTimeout(on);
      clearTimeout(hide);
    };
  }, [guessedCurrent]);

  // Web only: keep the cursor in the guess field so typed keys land in it
  // without clicking first (a fresh turn/round refocuses after the overlay).
  // Skip auto-focus on mobile-web/touch devices — popping the keyboard hides
  // the drawing pane. Typers there can tap the field themselves.
  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(pointer: coarse)").matches
    ) {
      return;
    }
    const id = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(id);
  }, [focusKey]);

  // Mobile-web keyboard fix: on touch (before Chrome scrolls to the input),
  // pin document.body to the visual viewport height so the canvas stays at the
  // top and the input stays at the bottom above the keyboard. On blur, restore.
  const pinBody = () => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const vv = window.visualViewport;
    document.body.style.overflow = "hidden";
    document.body.style.height = `${vv?.height ?? window.innerHeight}px`;
  };
  const releaseBody = () => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    document.body.style.overflow = "";
    document.body.style.height = "";
  };

  const submit = () => {
    const t2 = text.trim();
    if (!t2) return;
    onSubmit(t2);
    setText("");
  };

  return (
    <View style={styles.wrap}>
      {!compact ? (
        <FlatList
          ref={listRef}
          data={[...entries].reverse()}
          inverted
          keyExtractor={(e) => e.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          renderItem={({ item, index }) => {
            const alt = index % 2 === 1;
            return (
              <View
                style={[styles.row, alt && styles.rowAlt, item.kind === "correct" && styles.rowCorrect, item.playerId === "drawer-hidden" && styles.hidden]}
              >
                <Text
                  style={[styles.line, item.kind === "system" && styles.system, item.kind === "correct" && styles.correctText, item.kind === "reaction" && styles.reactionLine]}
                  numberOfLines={2}
                >
                  {item.kind === "system"
                    ? `— ${item.text} —`
                    : item.kind === "reaction"
                      ? `${item.playerName} ${item.text}`
                      : `${item.playerName}: ${item.text}`}
                </Text>
              </View>
            );
          }}
        />
      ) : null}
      {toast ? (
        <View style={styles.guessedBanner}>
          <Text style={styles.guessedText}>{t.youGuessed}</Text>
        </View>
      ) : null}
      {closeHint ? (
        <View style={styles.closeHint}>
          <Text style={styles.closeHintText}>{closeHint}</Text>
        </View>
      ) : null}
      <View style={styles.inputRow}>
        <View style={styles.inputGlow}>
          <View style={styles.inputShell}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={text}
              onChangeText={setText}
              placeholder={isDrawer ? t.drawerChatPlaceholder : t.guessPlaceholder}
              placeholderTextColor={C.panelDim}
              onSubmitEditing={submit}
              returnKeyType="send"
              blurOnSubmit={false}
              onFocus={() => {
                pinBody();
                onFocusChange?.(true);
              }}
              onBlur={() => {
                releaseBody();
                onFocusChange?.(false);
              }}
              onTouchStart={pinBody}
            />
            <Pressable onPress={submit} style={styles.send}>
              <Text style={styles.sendText}>{isDrawer ? "💬" : "🎯"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    minHeight: 120,
    backgroundColor: "#ffffff",
    borderRadius: R.m,
    borderWidth: 1,
    borderColor: C.panelBorder,
    overflow: "hidden",
  },
  list: { flex: 1 },
  listContent: { paddingVertical: 2 },
  row: {
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  rowAlt: { backgroundColor: C.chatRowAlt },
  rowCorrect: { backgroundColor: C.guessedRow },
  line: {
    color: "#111111",
    fontSize: 13,
    fontFamily: F.semibold,
  },
  system: {
    color: "#777777",
    fontStyle: "italic",
    fontFamily: F.regular,
  },
  correctText: {
    color: "#1c7a12",
    fontFamily: F.xbold,
  },
  reactionLine: {
    color: "#555555",
    fontStyle: "italic",
    fontFamily: F.regular,
  },
  hidden: { display: "none" },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 6,
  },
  // skribbl's soft blue glow ring around the chat field — no hard border
  inputGlow: {
    flex: 1,
    flexDirection: "row",
    borderRadius: 13,
    padding: 3,
    backgroundColor: C.inputGlow,
  },
  // white rounded-rect field: borderless inside the glow wrapper, left text
  inputShell: {
    flex: 1,
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 10,
    overflow: "hidden",
  },
  input: {
    flex: 1,
    height: "100%",
    paddingHorizontal: 12,
    color: C.inputText,
    fontSize: 14,
    fontFamily: F.semibold,
    textAlign: "left",
  },
  send: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 4,
    backgroundColor: C.blue,
    alignItems: "center",
    justifyContent: "center",
  },
  sendText: { fontSize: 15 },
  guessedBanner: {
    backgroundColor: C.guessed,
    marginHorizontal: 6,
    marginTop: 6,
    borderRadius: R.pill,
    paddingVertical: 7,
    alignItems: "center",
  },
  guessedText: {
    color: "#ffffff",
    fontFamily: F.xbold,
    fontSize: 13,
  },
  closeHint: {
    backgroundColor: "rgba(226, 203, 0, 0.95)",
    marginHorizontal: 6,
    marginTop: 6,
    borderRadius: R.pill,
    paddingVertical: 5,
    alignItems: "center",
  },
  closeHintText: { color: "#111111", fontFamily: F.xbold, fontSize: 12 },
});

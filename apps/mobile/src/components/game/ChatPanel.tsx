/**
 * Chat + guess panel — skribbl-style light chat: alternating rows,
 * green rows for correct guesses, system lines in dim italic.
 */
import { useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { ChatEntry } from "@drawkaro/shared";
import { t } from "../../lib/strings";
import { C, F, flatShadow } from "../../lib/theme";

type Props = {
  entries: ChatEntry[];
  isDrawer: boolean;
  guessedCurrent: boolean;
  onSubmit: (text: string) => void;
};

export function ChatPanel({ entries, isDrawer, guessedCurrent, onSubmit }: Props) {
  const [text, setText] = useState("");
  const listRef = useRef<FlatList<ChatEntry>>(null);

  const submit = () => {
    const t2 = text.trim();
    if (!t2) return;
    onSubmit(t2);
    setText("");
  };

  return (
    <View style={[styles.wrap, flatShadow]}>
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
              style={[
                styles.row,
                alt && styles.rowAlt,
                item.kind === "correct" && styles.rowCorrect,
                item.playerId === "drawer-hidden" && styles.hidden,
              ]}
            >
              <Text
                style={[
                  styles.line,
                  item.kind === "system" && styles.system,
                  item.kind === "correct" && styles.correctText,
                ]}
                numberOfLines={2}
              >
                {item.kind === "system" ? `— ${item.text} —` : `${item.playerName}: ${item.text}`}
              </Text>
            </View>
          );
        }}
      />
      {guessedCurrent ? (
        <View style={styles.guessedBanner}>
          <Text style={styles.guessedText}>{t.youGuessed}</Text>
        </View>
      ) : (
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder={isDrawer ? t.drawerChatPlaceholder : t.guessPlaceholder}
            placeholderTextColor={C.panelDim}
            onSubmitEditing={submit}
            returnKeyType="send"
            blurOnSubmit={false}
          />
          <Pressable onPress={submit} style={styles.send}>
            <Text style={styles.sendText}>{isDrawer ? "💬" : "🎯"}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    minHeight: 120,
    backgroundColor: "#ffffff",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.panelBorder,
    overflow: "hidden",
  },
  list: { flex: 1 },
  listContent: { paddingVertical: 2 },
  row: {
    paddingHorizontal: 8,
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
  hidden: { display: "none" },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    padding: 5,
  },
  input: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: C.inputBorder,
    borderRadius: 3,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: C.inputText,
    fontSize: 14,
    fontFamily: F.semibold,
  },
  send: {
    width: 38,
    height: 38,
    borderRadius: 5,
    backgroundColor: C.blue,
    alignItems: "center",
    justifyContent: "center",
  },
  sendText: { fontSize: 17 },
  guessedBanner: {
    backgroundColor: C.guessed,
    margin: 5,
    borderRadius: 5,
    paddingVertical: 9,
    alignItems: "center",
  },
  guessedText: {
    color: "#ffffff",
    fontFamily: F.xbold,
    fontSize: 13,
  },
});

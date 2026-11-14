/**
 * Chat + guess panel. During drawing, text input acts as the guess box;
 * otherwise it's room chat.
 */
import { useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { ChatEntry } from "@drawkaro/shared";
import { t } from "../../lib/strings";

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
    const t = text.trim();
    if (!t) return;
    onSubmit(t);
    setText("");
  };

  return (
    <View style={styles.wrap}>
      <FlatList
        ref={listRef}
        data={[...entries].reverse()}
        inverted
        keyExtractor={(e) => e.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <Text
            style={[
              styles.line,
              item.kind === "correct" && styles.correct,
              item.kind === "system" && styles.system,
              item.playerId === "drawer-hidden" && styles.hidden,
            ]}
          >
            {item.kind === "system" ? `— ${item.text} —` : `${item.playerName}: ${item.text}`}
          </Text>
        )}
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
            placeholderTextColor="#8fb4d9"
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
  wrap: { flex: 1, minHeight: 120 },
  list: { flex: 1 },
  listContent: { paddingVertical: 4 },
  line: { color: "#e6f2ff", fontSize: 13, paddingVertical: 1 },
  correct: { color: "#4ade80", fontWeight: "700" },
  system: { color: "#9fc9f5", fontStyle: "italic" },
  hidden: { opacity: 0 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingTop: 6,
  },
  input: {
    flex: 1,
    backgroundColor: "#ffffff18",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    color: "#ffffff",
    fontSize: 14,
  },
  send: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#ffd700",
    alignItems: "center",
    justifyContent: "center",
  },
  sendText: { fontSize: 17 },
  guessedBanner: {
    backgroundColor: "#1a9e4b",
    borderRadius: 20,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 6,
  },
  guessedText: { color: "#fff", fontWeight: "800" },
});

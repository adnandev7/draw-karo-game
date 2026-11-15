/**
 * Avatar — layered emoji/vector stand-in for skribbl's pixel avatars.
 * Skin-tone circle, hair cap, expression face, accessory badge,
 * outfit-colored ring. Used on Home, player rows and the podium.
 */
import { StyleSheet, Text, View } from "react-native";
import type { AvatarDescriptor } from "@drawkaro/shared";
import { F, flatShadow } from "../lib/theme";

const EXPRESSION_EMOJI: Record<string, string> = {
  grin: "😄",
  smile: "😊",
  laugh: "😂",
  cool: "😎",
  wink: "😉",
  surprised: "😲",
  angry: "😠",
  sleepy: "😴",
  love: "😍",
  confused: "😕",
};

const ACCESSORY_EMOJI: Record<string, string> = {
  none: "",
  chashma: "👓",
  cap: "🧢",
  headphones: "🎧",
};

const HAIR_STYLE: Record<string, { color: string; bun?: boolean }> = {
  "short-black": { color: "#26221f" },
  "curly-brown": { color: "#5d3a1a" },
  "bun-black": { color: "#26221f", bun: true },
  "flow-brown": { color: "#7a4a1f" },
  braid: { color: "#3a2a18" },
  bald: { color: "transparent" },
};

export const EXPRESSION_IDS = Object.keys(EXPRESSION_EMOJI);
export const ACCESSORY_IDS = ["none", ...Object.keys(ACCESSORY_EMOJI).filter((k) => k !== "none")];
export const HAIRSTYLE_IDS = Object.keys(HAIR_STYLE);

type Props = {
  avatar: AvatarDescriptor;
  size: number;
};

export function Avatar({ avatar, size }: Props) {
  const face = EXPRESSION_EMOJI[avatar.expression] ?? EXPRESSION_EMOJI.grin;
  const accessory = ACCESSORY_EMOJI[avatar.accessory] ?? "";
  const hair = HAIR_STYLE[avatar.hairstyle] ?? HAIR_STYLE["short-black"];
  const ring = Math.max(2, Math.round(size * 0.09));

  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: avatar.outfitColor,
          borderWidth: ring,
          backgroundColor: avatar.skinTone,
        },
        flatShadow,
      ]}
    >
      {hair.color !== "transparent" ? (
        <View
          style={[
            styles.hair,
            {
              backgroundColor: hair.color,
              borderTopLeftRadius: size,
              borderTopRightRadius: size,
              height: size * 0.34,
            },
          ]}
        >
          {hair.bun ? (
            <View
              style={{
                position: "absolute",
                top: -size * 0.1,
                width: size * 0.28,
                height: size * 0.28,
                borderRadius: size,
                backgroundColor: hair.color,
                alignSelf: "center",
              }}
            />
          ) : null}
        </View>
      ) : null}
      <Text style={[styles.face, { fontSize: size * 0.48 }]}>{face}</Text>
      {accessory ? (
        <View style={[styles.accessory, { width: size * 0.42, height: size * 0.42, borderRadius: size }]}>
          <Text style={{ fontSize: size * 0.26 }}>{accessory}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: "visible",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  hair: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
    overflow: "visible",
  },
  face: {
    marginBottom: -2,
    fontFamily: undefined, // emoji renders via system font
  },
  accessory: {
    position: "absolute",
    bottom: -4,
    right: -4,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    ...flatShadow,
  },
});

export function avatarInitials(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || "?";
}

export const avatarFont = F.black;

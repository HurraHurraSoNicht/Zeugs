import { useId } from 'react';
import Svg, { Defs, LinearGradient, Polygon, Stop } from 'react-native-svg';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';

const SIN_60 = Math.sqrt(3) / 2;
const R = 50;
const H = R * SIN_60;

// Flat-top hexagon (flat edge on top/bottom, points on left/right) — matches
// the honeycomb scribble. Vertices computed once at module scope since the
// shape itself never changes, only the rendered size (controlled by the
// parent wrapper's width/height).
const HEX_POINTS = [
  [R, 0],
  [R / 2, H],
  [-R / 2, H],
  [-R, 0],
  [-R / 2, -H],
  [R / 2, -H],
]
  .map(([x, y]) => `${x + R},${y + H}`)
  .join(' ');

// Font sizes scale with the tile's own width so labels never outgrow the
// hexagon at any browser width. With 3 fixed columns, most real windows
// (phones, and even many desktop browser widths) land in the 100-300px
// hexWidth range, where a pure ratio-of-507px-desktop-tile scale produces
// tiny, hard-to-read icons/text — so the *minimum* clamp is deliberately
// generous (not just a small-screen safety floor) to keep every common
// width legible; the ratio only takes over and grows sizes further once a
// tile is wide enough that scaling up still looks proportionate, capped so
// very wide windows don't get comically large icons.
const EMOJI_RATIO = 46 / 507;
const LABEL_RATIO = 13 / 507;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// Subtly darkens a "#rrggbb" color for the gradient's lower stop, giving
// each flat pastel tile a soft sense of depth instead of a single flat fill.
function darkenHex(hex: string, amount: number): string {
  const value = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, ((value >> 16) & 0xff) - amount);
  const g = Math.max(0, ((value >> 8) & 0xff) - amount);
  const b = Math.max(0, (value & 0xff) - amount);
  return `rgb(${r}, ${g}, ${b})`;
}

interface HexagonTileProps {
  label: string;
  emoji: string;
  color: string;
  size: number;
  count?: number;
  onPress?: () => void;
}

export default function HexagonTile({ label, emoji, color, size, count, onPress }: HexagonTileProps) {
  const emojiFontSize = clamp(size * EMOJI_RATIO, 30, 52);
  const labelFontSize = clamp(size * LABEL_RATIO, 13, 16);
  const gradientId = `hex-gradient-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <Pressable onPress={onPress} style={styles.container}>
      <Svg viewBox={`0 0 ${R * 2} ${H * 2}`} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={1} />
            <Stop offset="1" stopColor={darkenHex(color, 22)} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Polygon points={HEX_POINTS} fill={`url(#${gradientId})`} stroke="rgba(0,0,0,0.15)" strokeWidth={1.5} />
      </Svg>
      {count != null && count > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count}</Text>
        </View>
      ) : null}
      <View style={styles.content}>
        <Text style={[styles.emoji, { fontSize: emojiFontSize }]}>{emoji}</Text>
        <Text
          style={[styles.label, { fontSize: labelFontSize, lineHeight: labelFontSize * 1.15 }]}
          numberOfLines={3}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  emoji: {
    marginBottom: 3,
  },
  label: {
    fontFamily: fonts.bodyBold,
    color: '#3a2f1f',
    textAlign: 'center',
  },
  badge: {
    position: 'absolute',
    top: '8%',
    alignSelf: 'center',
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: '#fff',
  },
  badgeText: {
    fontSize: 11,
    fontFamily: fonts.bodyBold,
    color: '#fff',
  },
});

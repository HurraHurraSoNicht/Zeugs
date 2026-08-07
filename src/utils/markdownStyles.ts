import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';

// Shared style rules for rendering article body markdown (see
// ArticleDetailScreen.tsx) — kept as a plain object, not StyleSheet.create,
// since react-native-markdown-display merges these with its own defaults
// per element and expects plain style objects to spread.
export const markdownStyles = {
  body: {
    fontSize: 14,
    fontFamily: fonts.body,
    lineHeight: 22,
    color: '#333',
  },
  heading1: {
    fontSize: 24,
    fontFamily: fonts.heading,
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  heading2: {
    fontSize: 19,
    fontFamily: fonts.heading,
    color: colors.text,
    marginTop: 14,
    marginBottom: 6,
  },
  strong: {
    fontFamily: fonts.bodyBold,
  },
  em: {
    fontFamily: fonts.body,
    fontStyle: 'italic' as const,
  },
  paragraph: {
    marginTop: 0,
    marginBottom: 12,
  },
  bullet_list: {
    marginBottom: 12,
  },
  ordered_list: {
    marginBottom: 12,
  },
  list_item: {
    marginBottom: 4,
  },
  link: {
    color: colors.primary,
    textDecorationLine: 'underline' as const,
  },
  // The table element is only ever used as a layout trick (see
  // markdownRules.tsx's custom `td`/`thead` rules) to place an image beside
  // text — border/padding are zeroed out so it never reads as a "table".
  table: {
    borderWidth: 0,
    marginVertical: 4,
  },
  tbody: {},
  tr: {
    borderBottomWidth: 0,
    alignItems: 'flex-start' as const,
  },
  th: {
    padding: 0,
  },
  td: {
    padding: 0,
    borderColor: 'transparent',
  },
};

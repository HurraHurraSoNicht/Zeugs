import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import type { Article } from '../types/article';

const MONTHS = ['JAN', 'FEB', 'MÄR', 'APR', 'MAI', 'JUN', 'JUL', 'AUG', 'SEP', 'OKT', 'NOV', 'DEZ'];

function DateBadge({ isoString }: { isoString: string }) {
  const date = new Date(isoString);
  return (
    <View style={styles.dateBadge}>
      <Text style={styles.dateBadgeDay}>{date.getDate()}</Text>
      <Text style={styles.dateBadgeMonth}>{MONTHS[date.getMonth()]}</Text>
    </View>
  );
}

interface ArticleTeaserCardProps {
  article: Article;
  onPress?: () => void;
}

export default function ArticleTeaserCard({ article, onPress }: ArticleTeaserCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.imageWrap}>
        {article.imageUrl ? (
          <Image source={{ uri: article.imageUrl }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]} />
        )}
        <DateBadge isoString={article.publishedAt} />
      </View>
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>
          {article.title}
        </Text>
        {article.teaser ? (
          <Text style={styles.teaser} numberOfLines={3}>
            {article.teaser}
          </Text>
        ) : null}
        {article.tags.length > 0 ? (
          <View style={styles.tagsRow}>
            {article.tags.map((tag) => (
              <Text key={tag} style={styles.tag}>
                {tag}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  cardPressed: {
    opacity: 0.85,
  },
  imageWrap: {
    width: '100%',
    height: 160,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    backgroundColor: '#e5e5e5',
  },
  dateBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
  },
  dateBadgeDay: {
    color: '#fff',
    fontSize: 16,
    fontFamily: fonts.bodyBold,
    lineHeight: 18,
  },
  dateBadgeMonth: {
    color: '#fff',
    fontSize: 10,
    fontFamily: fonts.bodyMedium,
    letterSpacing: 0.5,
  },
  info: {
    padding: 14,
  },
  title: {
    fontSize: 16,
    fontFamily: fonts.heading,
    color: colors.text,
  },
  teaser: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: '#666',
    marginTop: 6,
    lineHeight: 18,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
    gap: 6,
  },
  tag: {
    fontSize: 11,
    fontFamily: fonts.bodyMedium,
    color: colors.primaryDark,
    textTransform: 'uppercase',
  },
});

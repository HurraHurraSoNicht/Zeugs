import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import type { Product } from '../types/product';

interface ProductCardProps {
  product: Product;
  onPress?: () => void;
}

function StarRating({ value }: { value: number }) {
  const rounded = Math.round(value);
  const stars = '★★★★★'.slice(0, rounded) + '☆☆☆☆☆'.slice(0, 5 - rounded);
  return <Text style={styles.stars}>{stars}</Text>;
}

const NEW_LABEL_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

export default function ProductCard({ product, onPress }: ProductCardProps) {
  const isNew = Date.now() - new Date(product.discoveredAt).getTime() < NEW_LABEL_MAX_AGE_MS;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.imageWrap}>
        {product.imageUrl ? (
          <Image source={{ uri: product.imageUrl }} style={styles.image} resizeMode="contain" />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]} />
        )}
        {isNew ? (
          <View style={styles.newBadge}>
            <Text style={styles.newBadgeText}>Neu</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={2}>
          {product.name}
        </Text>
        {product.brand ? <Text style={styles.brand}>{product.brand}</Text> : null}
        <View style={styles.ratingRow}>
          <StarRating value={product.averageRating} />
          <Text style={styles.ratingText}>
            {product.averageRating.toFixed(1)} ({product.ratingsCount})
          </Text>
        </View>
        {product.tags.length > 0 ? (
          <View style={styles.tagsRow}>
            {product.tags.map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 6,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  cardPressed: {
    opacity: 0.7,
  },
  imageWrap: {
    width: 96,
    height: 96,
  },
  image: {
    width: 96,
    height: 96,
    backgroundColor: '#f0f0f0',
  },
  imagePlaceholder: {
    backgroundColor: '#e5e5e5',
  },
  newBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    backgroundColor: colors.primary,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  newBadgeText: {
    fontSize: 10,
    fontFamily: fonts.bodyBold,
    color: '#fff',
  },
  info: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  name: {
    fontSize: 16,
    fontFamily: fonts.bodyMedium,
    color: colors.text,
  },
  brand: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: '#666',
    marginTop: 2,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  stars: {
    fontSize: 13,
    color: '#f5a623',
    marginRight: 6,
  },
  ratingText: {
    fontSize: 12,
    fontFamily: fonts.body,
    color: '#888',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
    gap: 6,
  },
  tag: {
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tagText: {
    fontSize: 11,
    fontFamily: fonts.bodyMedium,
    color: colors.primaryDark,
  },
});

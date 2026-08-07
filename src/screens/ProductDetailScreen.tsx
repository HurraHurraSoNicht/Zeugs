import { useEffect, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Breadcrumb from '../components/Breadcrumb';
import { useAuth } from '../hooks/useAuth';
import { useProducts } from '../hooks/useProducts';
import { fetchMyRating } from '../services/ratingsApi';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import type { NutritionFacts } from '../types/nutrition';
import type { TabScreenProps } from '../types/navigation';
import { getDeviceId } from '../utils/deviceId';

const STAR_VALUES = [1, 2, 3, 4, 5];

type Props = TabScreenProps<'ProductDetail'>;

const NUTRITION_ROWS: { key: keyof NutritionFacts; label: string; unit: string }[] = [
  { key: 'energyKcal', label: 'Energie', unit: 'kcal' },
  { key: 'energyKj', label: 'Energie', unit: 'kJ' },
  { key: 'fat', label: 'Fett', unit: 'g' },
  { key: 'saturatedFat', label: 'davon gesättigte Fettsäuren', unit: 'g' },
  { key: 'carbohydrates', label: 'Kohlenhydrate', unit: 'g' },
  { key: 'sugars', label: 'davon Zucker', unit: 'g' },
  { key: 'fiber', label: 'Ballaststoffe', unit: 'g' },
  { key: 'protein', label: 'Eiweiß', unit: 'g' },
  { key: 'salt', label: 'Salz', unit: 'g' },
];

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

function NutritionTable({ nutrition }: { nutrition: NutritionFacts | null }) {
  if (!nutrition) {
    return <Text style={styles.emptyText}>Keine Nährwertangaben verfügbar.</Text>;
  }

  return (
    <View style={styles.table}>
      {NUTRITION_ROWS.map(({ key, label, unit }) => {
        const value = nutrition[key];
        return (
          <View key={key} style={styles.tableRow}>
            <Text style={styles.tableLabel}>{label}</Text>
            <Text style={styles.tableValue}>{value != null ? `${value} ${unit}` : '–'}</Text>
          </View>
        );
      })}
    </View>
  );
}

function VoteStars({
  value,
  disabled,
  onVote,
}: {
  value: number | null;
  disabled: boolean;
  onVote: (stars: number) => void;
}) {
  return (
    <View style={styles.voteStarsRow}>
      {STAR_VALUES.map((starValue) => {
        const filled = value != null && starValue <= value;
        return (
          <Pressable
            key={starValue}
            onPress={() => onVote(starValue)}
            disabled={disabled}
            hitSlop={6}
            style={({ pressed }) => [styles.voteStarButton, pressed && styles.voteStarButtonPressed]}
          >
            <Text style={[styles.voteStar, filled && styles.voteStarFilled]}>{filled ? '★' : '☆'}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function ProductDetailScreen({ route, navigation }: Props) {
  const { productId } = route.params;
  const { isAdmin } = useAuth();
  const { getProductById, rateProduct } = useProducts();
  const product = getProductById(productId);
  const [copied, setCopied] = useState(false);
  const [myRating, setMyRating] = useState<number | null>(null);
  const [voting, setVoting] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const deviceId = await getDeviceId();
        const stars = await fetchMyRating(productId, deviceId);
        if (!cancelled) {
          setMyRating(stars);
        }
      } catch {
        // Voting still works without a pre-highlighted star, so a failed
        // lookup here isn't worth surfacing as an error.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [productId]);

  const handleVote = async (stars: number) => {
    const previous = myRating;
    setMyRating(stars);
    setVoting(true);
    setVoteError(null);
    try {
      const deviceId = await getDeviceId();
      await rateProduct(productId, deviceId, stars);
    } catch (err) {
      setMyRating(previous);
      setVoteError(err instanceof Error ? err.message : 'Bewertung konnte nicht gespeichert werden.');
    } finally {
      setVoting(false);
    }
  };

  const handleCopyId = async () => {
    if (!product) {
      return;
    }
    await Clipboard.setStringAsync(product.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const breadcrumbItems = [
    { label: 'Entdecken', onPress: () => navigation.goBack() },
    { label: product?.name ?? 'Produkt nicht gefunden' },
  ];

  if (!product) {
    return (
      <View style={styles.container}>
        <Breadcrumb items={breadcrumbItems} />
        <Text style={styles.emptyText}>
          Dieses Produkt konnte nicht gefunden werden.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Breadcrumb items={breadcrumbItems} />
      <ScrollView contentContainerStyle={styles.content}>
        {product.imageUrl ? (
          <Image
            source={{ uri: product.imageUrl }}
            style={styles.image}
            resizeMode="contain"
          />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]} />
        )}

        <Text style={styles.name}>{product.name}</Text>
        {product.brand ? <Text style={styles.brand}>{product.brand}</Text> : null}

        <View style={styles.ratingRow}>
          <Text style={styles.stars}>
            {'★★★★★'.slice(0, Math.round(product.averageRating))}
            {'☆☆☆☆☆'.slice(0, 5 - Math.round(product.averageRating))}
          </Text>
          <Text style={styles.ratingText}>
            {product.averageRating.toFixed(1)} ({product.ratingsCount} Bewertungen)
          </Text>
        </View>

        <View style={styles.voteSection}>
          <Text style={styles.voteLabel}>Deine Bewertung</Text>
          <VoteStars value={myRating} disabled={voting} onVote={handleVote} />
          {voteError ? <Text style={styles.voteErrorText}>{voteError}</Text> : null}
        </View>

        {isAdmin ? (
          <View style={styles.idRow}>
            <Text style={styles.idLabel}>ID:</Text>
            <Text style={styles.idText} selectable>
              {product.id}
            </Text>
            <Pressable
              onPress={handleCopyId}
              style={({ pressed }) => [styles.copyButton, pressed && styles.copyButtonPressed]}
            >
              <Text style={styles.copyButtonText}>{copied ? 'Kopiert ✓' : 'Kopieren'}</Text>
            </Pressable>
          </View>
        ) : null}
        <Text style={styles.dateText}>Hinzugefügt am {formatDate(product.discoveredAt)}</Text>

        {product.tags.length > 0 ? (
          <View style={styles.tagsRow}>
            {product.tags.map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {product.description ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Beschreibung</Text>
            <Text style={styles.description}>{product.description}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Nährwerte (pro 100 g/ml)</Text>
          <NutritionTable nutrition={product.nutrition} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  image: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: '#f0f0f0',
  },
  imagePlaceholder: {
    backgroundColor: '#e5e5e5',
  },
  name: {
    fontSize: 24,
    fontFamily: fonts.heading,
    color: colors.text,
  },
  brand: {
    fontSize: 15,
    fontFamily: fonts.body,
    color: '#666',
    marginTop: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  stars: {
    fontSize: 16,
    color: '#f5a623',
    marginRight: 8,
  },
  ratingText: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: '#888',
  },
  voteSection: {
    marginTop: 14,
  },
  voteLabel: {
    fontSize: 13,
    fontFamily: fonts.bodyMedium,
    color: '#333',
    marginBottom: 4,
  },
  voteStarsRow: {
    flexDirection: 'row',
  },
  voteStarButton: {
    padding: 4,
  },
  voteStarButtonPressed: {
    opacity: 0.6,
  },
  voteStar: {
    fontSize: 28,
    color: '#ccc',
  },
  voteStarFilled: {
    color: '#f5a623',
  },
  voteErrorText: {
    fontSize: 12,
    fontFamily: fonts.body,
    color: colors.danger,
    marginTop: 4,
  },
  idRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    flexWrap: 'wrap',
  },
  idLabel: {
    fontSize: 11,
    fontFamily: fonts.body,
    color: '#aaa',
    marginRight: 4,
  },
  idText: {
    fontSize: 11,
    fontFamily: fonts.body,
    color: '#aaa',
    marginRight: 8,
  },
  copyButton: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  copyButtonPressed: {
    backgroundColor: '#f0f0f0',
  },
  copyButtonText: {
    fontSize: 11,
    fontFamily: fonts.bodyMedium,
    color: colors.primary,
  },
  dateText: {
    fontSize: 12,
    fontFamily: fonts.body,
    color: '#888',
    marginTop: 4,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 8,
  },
  tag: {
    backgroundColor: colors.primaryLight,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  tagText: {
    fontSize: 12,
    fontFamily: fonts.bodyMedium,
    color: colors.primaryDark,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: fonts.heading,
    color: colors.text,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    fontFamily: fonts.body,
    lineHeight: 20,
    color: '#333',
  },
  table: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  tableLabel: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: '#444',
  },
  tableValue: {
    fontSize: 13,
    fontFamily: fonts.bodyMedium,
    color: colors.text,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: fonts.body,
    color: '#888',
    marginTop: 16,
    marginHorizontal: 16,
  },
});

import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import ArticleTeaserCard from '../components/ArticleTeaserCard';
import HexagonTile from '../components/HexagonTile';
import { HOME_CATEGORIES } from '../data/homeCategories';
import { useArticles } from '../hooks/useArticles';
import { useProducts } from '../hooks/useProducts';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import type { TabScreenProps } from '../types/navigation';
import logoImage from '../../images/snakkerslogo.png';

type Props = TabScreenProps<'Home'>;

const COLUMNS = 3;
const HEX_ASPECT = 2 / Math.sqrt(3); // width / height of a flat-top hexagon
const HORIZONTAL_PADDING = 32;
const COLUMN_GAP = 8;
const RANDOM_PRODUCT_WINDOW_DAYS = 14;

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
}

export default function HomeScreen({ navigation }: Props) {
  const { width } = useWindowDimensions();
  const { products } = useProducts();
  const { articles } = useArticles();
  const [searchQuery, setSearchQuery] = useState('');

  // fetchArticles already orders by published_at desc, so the first entry
  // is the newest — promoted here as a teaser below the category hexagons.
  const latestArticle = articles[0] ?? null;

  // "Kennst du eigentlich schon...?" — a random pick from products added in
  // the last 14 days. Memoized on `products` (a stable reference from
  // useProducts() that only changes when the data actually refetches) so it
  // doesn't re-randomize on every unrelated re-render, e.g. while typing in
  // the search box above.
  const randomProduct = useMemo(() => {
    const cutoff = Date.now() - RANDOM_PRODUCT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const recent = products.filter((product) => new Date(product.discoveredAt).getTime() >= cutoff);
    if (recent.length === 0) {
      return null;
    }
    return recent[Math.floor(Math.random() * recent.length)];
  }, [products]);

  const { hexWidth, hexHeight, rowOverlap } = useMemo(() => {
    const w = (width - HORIZONTAL_PADDING - COLUMN_GAP * (COLUMNS - 1)) / COLUMNS;
    const h = w / HEX_ASPECT;
    return { hexWidth: w, hexHeight: h, rowOverlap: h * 0.13 };
  }, [width]);

  const rows = useMemo(() => chunk(HOME_CATEGORIES, COLUMNS), []);

  // "Alle Produkte" counts everything; every other tile counts products that
  // list its category id (a product can belong to more than one category).
  const countsByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const category of HOME_CATEGORIES) {
      counts[category.id] =
        category.id === 'all' ? products.length : products.filter((p) => p.categories.includes(category.id)).length;
    }
    return counts;
  }, [products]);

  const handleSearch = () => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      return;
    }
    navigation.navigate('Discover', { searchQuery: trimmed });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.logoWrap}>
        <Image source={logoImage} style={styles.logo} resizeMode="contain" />
      </View>

      <View style={styles.searchBar}>
        <Pressable onPress={handleSearch} hitSlop={8}>
          <Text style={styles.searchIcon}>🔍</Text>
        </Pressable>
        <TextInput
          style={styles.searchInput}
          placeholder="Suche nach neuen Produkten…"
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        <Text style={styles.scanIcon}>▤</Text>
      </View>

      <View style={styles.grid}>
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} style={[styles.row, rowIndex > 0 && { marginTop: -rowOverlap }]}>
            {row.map((category, colIndex) => (
              <View
                key={category.id}
                style={{
                  width: hexWidth,
                  height: hexHeight,
                  marginRight: colIndex < row.length - 1 ? COLUMN_GAP : 0,
                }}
              >
                <HexagonTile
                  label={category.label}
                  emoji={category.emoji}
                  color={category.color}
                  size={hexWidth}
                  count={countsByCategory[category.id]}
                  onPress={() =>
                    navigation.navigate('Discover', {
                      categoryId: category.id === 'all' ? undefined : category.id,
                    })
                  }
                />
              </View>
            ))}
          </View>
        ))}
      </View>

      {randomProduct ? (
        <View style={styles.articleSection}>
          <Text style={styles.articleSectionHeader}>Kennst du eigentlich schon...?</Text>
          <Pressable
            onPress={() => navigation.navigate('ProductDetail', { productId: randomProduct.id })}
            style={({ pressed }) => [styles.randomProductCard, pressed && styles.randomProductCardPressed]}
          >
            {randomProduct.imageUrl ? (
              <Image source={{ uri: randomProduct.imageUrl }} style={styles.randomProductImage} resizeMode="contain" />
            ) : (
              <View style={[styles.randomProductImage, styles.randomProductImagePlaceholder]} />
            )}
            <View style={styles.randomProductInfo}>
              {randomProduct.brand ? <Text style={styles.randomProductBrand}>{randomProduct.brand}</Text> : null}
              <Text style={styles.randomProductName} numberOfLines={2}>
                {randomProduct.name}
              </Text>
            </View>
          </Pressable>
        </View>
      ) : null}

      {latestArticle ? (
        <View style={styles.articleSection}>
          <Text style={styles.articleSectionHeader}>🍿 Neu im Snack-e-zine</Text>
          <View style={styles.articleCardWrap}>
            <ArticleTeaserCard
              article={latestArticle}
              onPress={() => navigation.navigate('ArticleDetail', { articleId: latestArticle.id })}
            />
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
  },
  logoWrap: {
    alignItems: 'center',
    marginBottom: 4,
  },
  logo: {
    width: 220,
    height: 220 / 1.5,
    borderRadius: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 24,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: fonts.body,
    color: colors.text,
  },
  scanIcon: {
    fontSize: 18,
    color: colors.textFaint,
    marginLeft: 8,
  },
  grid: {
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
  },
  articleSection: {
    marginTop: 24,
  },
  articleSectionHeader: {
    fontSize: 18,
    fontFamily: fonts.heading,
    color: colors.text,
    marginBottom: 4,
  },
  randomProductCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  randomProductCardPressed: {
    opacity: 0.85,
  },
  randomProductImage: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  randomProductImagePlaceholder: {
    backgroundColor: '#e5e5e5',
  },
  randomProductInfo: {
    flex: 1,
    marginLeft: 12,
  },
  randomProductBrand: {
    fontSize: 12,
    fontFamily: fonts.body,
    color: '#666',
  },
  randomProductName: {
    fontSize: 15,
    fontFamily: fonts.bodyMedium,
    color: colors.text,
    marginTop: 2,
  },
  // ArticleTeaserCard already carries its own marginHorizontal: 16 (it's
  // normally used inside a FlatList with no ambient padding on Snack-e-zine)
  // — cancel that here since this ScrollView's contentContainerStyle already
  // adds 16px on each side, so the card lines up with the hexagons/search
  // bar above instead of sitting 32px in.
  articleCardWrap: {
    marginHorizontal: -16,
  },
});

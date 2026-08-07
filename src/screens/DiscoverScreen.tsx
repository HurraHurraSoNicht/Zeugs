import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import ProductCard from '../components/ProductCard';
import TagFilterBar from '../components/TagFilterBar';
import { HOME_CATEGORIES } from '../data/homeCategories';
import { useProducts } from '../hooks/useProducts';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import type { Product } from '../types/product';
import type { TabScreenProps } from '../types/navigation';

type Props = TabScreenProps<'Discover'>;

type SortField = 'name' | 'date';

const PAGE_SIZE = 50;

export default function DiscoverScreen({ navigation, route }: Props) {
  const { products, loading, error } = useProducts();
  const [sortField, setSortField] = useState<SortField>('name');
  const [nameAscending, setNameAscending] = useState(true);
  const [dateAscending, setDateAscending] = useState(true);

  const handleSortByName = () => {
    if (sortField === 'name') {
      setNameAscending((current) => !current);
    } else {
      setSortField('name');
    }
  };

  const handleSortByDate = () => {
    if (sortField === 'date') {
      setDateAscending((current) => !current);
    } else {
      setSortField('date');
    }
  };

  // Tracks the active category filter, seeded from the Home screen's
  // hexagon tap (route.params.categoryId) but kept in its own state so the
  // "Filter aufheben" button can clear it without navigating away — the tab
  // navigator keeps this screen mounted, so route.params only changes again
  // once Home sends a new one.
  const [categoryId, setCategoryId] = useState(route.params?.categoryId);
  useEffect(() => {
    setCategoryId(route.params?.categoryId);
  }, [route.params?.categoryId]);

  const activeCategory = useMemo(
    () => HOME_CATEGORIES.find((category) => category.id === categoryId) ?? null,
    [categoryId],
  );

  // Same seed-then-locally-clearable pattern as categoryId above, for the
  // free-text search coming from the Home screen's search bar.
  const [searchQuery, setSearchQuery] = useState(route.params?.searchQuery);
  useEffect(() => {
    setSearchQuery(route.params?.searchQuery);
  }, [route.params?.searchQuery]);

  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const product of products) {
      for (const tag of product.tags) {
        tagSet.add(tag);
      }
    }
    return [...tagSet].sort((a, b) => a.localeCompare(b, 'de'));
  }, [products]);

  const sortedProducts = useMemo(() => {
    const normalizedQuery = searchQuery?.trim().toLowerCase() ?? '';
    const filtered = products.filter((product) => {
      if (categoryId && !product.categories.includes(categoryId)) {
        return false;
      }
      if (normalizedQuery) {
        const haystack = `${product.name} ${product.brand ?? ''}`.toLowerCase();
        if (!haystack.includes(normalizedQuery)) {
          return false;
        }
      }
      return selectedTags.every((tag) => product.tags.includes(tag));
    });
    const sorted = [...filtered].sort((a, b) => {
      if (sortField === 'date') {
        return new Date(a.discoveredAt).getTime() - new Date(b.discoveredAt).getTime();
      }
      return a.name.localeCompare(b.name, 'de');
    });
    const ascending = sortField === 'date' ? dateAscending : nameAscending;
    return ascending ? sorted : sorted.reverse();
  }, [products, sortField, nameAscending, dateAscending, categoryId, searchQuery, selectedTags]);

  // Sorting/filters change the underlying result set, so the page the admin
  // was on may no longer make sense (or may not exist anymore) — jump back
  // to page 1 whenever any of them change, same as most paginated apps.
  const [page, setPage] = useState(1);
  useEffect(() => {
    setPage(1);
  }, [sortField, nameAscending, dateAscending, categoryId, searchQuery, selectedTags]);

  const totalPages = Math.max(1, Math.ceil(sortedProducts.length / PAGE_SIZE));
  const pagedProducts = useMemo(
    () => sortedProducts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [sortedProducts, page],
  );

  const listRef = useRef<FlatList<Product>>(null);
  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, [page]);

  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        data={pagedProducts}
        keyExtractor={(item: Product) => item.id}
        renderItem={({ item }) => (
          <ProductCard
            product={item}
            onPress={() => navigation.navigate('ProductDetail', { productId: item.id })}
          />
        )}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            <View style={styles.headerRow}>
              <Text style={styles.header}>Entdecken</Text>
              <View style={styles.sortButtonGroup}>
                <Pressable
                  onPress={handleSortByName}
                  style={({ pressed }) => [
                    styles.sortButton,
                    sortField === 'name' && styles.sortButtonActive,
                    pressed && styles.sortButtonPressed,
                  ]}
                >
                  <Text style={[styles.sortButtonText, sortField === 'name' && styles.sortButtonTextActive]}>
                    Name {nameAscending ? 'A-Z' : 'Z-A'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleSortByDate}
                  style={({ pressed }) => [
                    styles.sortButton,
                    sortField === 'date' && styles.sortButtonActive,
                    pressed && styles.sortButtonPressed,
                  ]}
                >
                  <Text style={[styles.sortButtonText, sortField === 'date' && styles.sortButtonTextActive]}>
                    Datum {dateAscending ? '↑' : '↓'}
                  </Text>
                </Pressable>
              </View>
            </View>
            {activeCategory ? (
              <View style={styles.filterRow}>
                <Text style={styles.filterChipText}>
                  {activeCategory.emoji} {activeCategory.label}
                </Text>
                <Pressable
                  onPress={() => setCategoryId(undefined)}
                  style={({ pressed }) => [styles.filterClear, pressed && styles.filterClearPressed]}
                >
                  <Text style={styles.filterClearText}>Filter aufheben ✕</Text>
                </Pressable>
              </View>
            ) : null}
            <View style={styles.searchBar}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Nach Name oder Hersteller suchen…"
                placeholderTextColor="#999"
                value={searchQuery ?? ''}
                onChangeText={(text) => setSearchQuery(text || undefined)}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {searchQuery ? (
                <Pressable onPress={() => setSearchQuery(undefined)} hitSlop={8}>
                  <Text style={styles.searchClearIcon}>✕</Text>
                </Pressable>
              ) : null}
            </View>
            <TagFilterBar allTags={allTags} selectedTags={selectedTags} onChangeSelectedTags={setSelectedTags} />
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.statusRow}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.statusRowText}>Produkte werden geladen…</Text>
            </View>
          ) : error ? (
            <Text style={[styles.statusText, styles.errorText]}>{error}</Text>
          ) : activeCategory || searchQuery || selectedTags.length > 0 ? (
            <Text style={styles.statusText}>Keine Produkte für diese Filterkombination.</Text>
          ) : (
            <Text style={styles.statusText}>Noch keine Produkte — über den Admin-Tab hinzufügen.</Text>
          )
        }
        ListFooterComponent={
          sortedProducts.length > PAGE_SIZE ? (
            <View style={styles.paginationRow}>
              <Pressable
                onPress={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
                style={({ pressed }) => [
                  styles.pageButton,
                  page <= 1 && styles.pageButtonDisabled,
                  pressed && page > 1 && styles.pageButtonPressed,
                ]}
              >
                <Text style={[styles.pageButtonText, page <= 1 && styles.pageButtonTextDisabled]}>← Zurück</Text>
              </Pressable>
              <Text style={styles.pageIndicatorText}>
                Seite {page} von {totalPages}
              </Text>
              <Pressable
                onPress={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page >= totalPages}
                style={({ pressed }) => [
                  styles.pageButton,
                  page >= totalPages && styles.pageButtonDisabled,
                  pressed && page < totalPages && styles.pageButtonPressed,
                ]}
              >
                <Text style={[styles.pageButtonText, page >= totalPages && styles.pageButtonTextDisabled]}>
                  Weiter →
                </Text>
              </Pressable>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    paddingBottom: 16,
    flexGrow: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
  },
  header: {
    fontSize: 24,
    fontFamily: fonts.heading,
    color: colors.text,
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
    marginHorizontal: 16,
    marginBottom: 12,
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
  searchClearIcon: {
    fontSize: 16,
    color: colors.textFaint,
    marginLeft: 8,
    paddingHorizontal: 4,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: colors.primaryLight,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterChipText: {
    fontSize: 13,
    fontFamily: fonts.bodyMedium,
    color: colors.primaryDark,
  },
  filterClear: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  filterClearPressed: {
    opacity: 0.6,
  },
  filterClearText: {
    fontSize: 12,
    fontFamily: fonts.bodyMedium,
    color: colors.primaryDark,
  },
  sortButtonGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  sortButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  sortButtonPressed: {
    backgroundColor: colors.primaryLight,
  },
  sortButtonActive: {
    backgroundColor: colors.primary,
  },
  sortButtonText: {
    fontSize: 13,
    fontFamily: fonts.bodyMedium,
    color: colors.primaryDark,
  },
  sortButtonTextActive: {
    color: '#fff',
  },
  statusRow: {
    marginTop: 32,
    alignItems: 'center',
    gap: 8,
  },
  statusRowText: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: '#888',
  },
  statusText: {
    textAlign: 'center',
    fontSize: 13,
    fontFamily: fonts.body,
    color: '#888',
    marginHorizontal: 24,
    marginTop: 32,
  },
  errorText: {
    color: colors.danger,
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 8,
  },
  pageButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pageButtonPressed: {
    backgroundColor: colors.primaryLight,
  },
  pageButtonDisabled: {
    borderColor: '#ddd',
  },
  pageButtonText: {
    fontSize: 13,
    fontFamily: fonts.bodyMedium,
    color: colors.primaryDark,
  },
  pageButtonTextDisabled: {
    color: '#bbb',
  },
  pageIndicatorText: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: '#666',
  },
});

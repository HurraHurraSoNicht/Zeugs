import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import ArticleTeaserCard from '../components/ArticleTeaserCard';
import { useArticles } from '../hooks/useArticles';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import type { Article } from '../types/article';
import type { TabScreenProps } from '../types/navigation';

type Props = TabScreenProps<'SnackEZine'>;

export default function SnackEZineScreen({ navigation }: Props) {
  const { articles, loading, error } = useArticles();

  return (
    <View style={styles.container}>
      <FlatList
        data={articles}
        keyExtractor={(item: Article) => item.id}
        renderItem={({ item }) => (
          <ArticleTeaserCard
            article={item}
            onPress={() => navigation.navigate('ArticleDetail', { articleId: item.id })}
          />
        )}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.hero}>
            <Text style={styles.heroEmoji}>🍿</Text>
            <Text style={styles.heroTitle}>Snack-e-zine</Text>
            <Text style={styles.heroSubtitle}>
              Dein Magazin für Infos rund um Snacks, Zutaten und Markteinführungen!
            </Text>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.statusRow}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.statusRowText}>Artikel werden geladen…</Text>
            </View>
          ) : error ? (
            <Text style={[styles.statusText, styles.errorText]}>{error}</Text>
          ) : (
            <Text style={styles.statusText}>Noch keine Artikel — über den Admin-Tab hinzufügen.</Text>
          )
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
    paddingBottom: 32,
  },
  hero: {
    backgroundColor: colors.primaryDark,
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 32,
    marginBottom: 8,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  heroEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 30,
    fontFamily: fonts.heading,
    color: '#fff',
  },
  heroSubtitle: {
    fontSize: 14,
    fontFamily: fonts.body,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 6,
    maxWidth: 420,
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
});

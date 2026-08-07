import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import Markdown from 'react-native-markdown-display';
import Breadcrumb from '../components/Breadcrumb';
import { useArticles } from '../hooks/useArticles';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { markdownRules } from '../utils/markdownRules';
import { markdownStyles } from '../utils/markdownStyles';
import type { TabScreenProps } from '../types/navigation';

type Props = TabScreenProps<'ArticleDetail'>;

export default function ArticleDetailScreen({ route, navigation }: Props) {
  const { articleId } = route.params;
  const { getArticleById } = useArticles();
  const article = getArticleById(articleId);

  const breadcrumbItems = [
    { label: 'Snack-e-zine', onPress: () => navigation.goBack() },
    { label: article?.title ?? 'Artikel nicht gefunden' },
  ];

  if (!article) {
    return (
      <View style={styles.container}>
        <Breadcrumb items={breadcrumbItems} />
        <Text style={styles.emptyText}>Dieser Artikel konnte nicht gefunden werden.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Breadcrumb items={breadcrumbItems} />
      <ScrollView contentContainerStyle={styles.content}>
        {article.imageUrl ? (
          <Image source={{ uri: article.imageUrl }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]} />
        )}

        <Text style={styles.title}>{article.title}</Text>

        {article.tags.length > 0 ? (
          <View style={styles.tagsRow}>
            {article.tags.map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {article.teaser ? <Text style={styles.teaser}>{article.teaser}</Text> : null}

        {article.body ? (
          <View style={styles.body}>
            <Markdown style={markdownStyles} rules={markdownRules}>
              {article.body}
            </Markdown>
          </View>
        ) : (
          <Text style={styles.emptyText}>Noch kein Text für diesen Artikel.</Text>
        )}
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
  title: {
    fontSize: 24,
    fontFamily: fonts.heading,
    color: colors.text,
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
  teaser: {
    fontSize: 16,
    fontFamily: fonts.bodyMedium,
    color: '#333',
    marginTop: 16,
    lineHeight: 22,
  },
  body: {
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: fonts.body,
    color: '#888',
    marginTop: 16,
    marginHorizontal: 16,
  },
});

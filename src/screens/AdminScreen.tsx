import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import ProductEditForm from '../components/ProductEditForm';
import ArticleEditForm from '../components/ArticleEditForm';
import SignalWordFilterBar from '../components/SignalWordFilterBar';
import { useProducts } from '../hooks/useProducts';
import { useArticles } from '../hooks/useArticles';
import { useNewSitemapEntries } from '../hooks/useNewSitemapEntries';
import { useSignalWordFilter } from '../hooks/useSignalWordFilter';
import { useAutomationSettings } from '../hooks/useAutomationSettings';
import { scrapeProductFromUrl } from '../services/productScraper';
import { getProductByBarcode, searchProducts, type OpenFoodFactsSearchResult } from '../services/openFoodFacts';
import { deleteUserAccount, findUserByEmail, type AdminUser } from '../services/usersApi';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import type { Product } from '../types/product';
import type { Article } from '../types/article';
import type { NewSitemapEntry } from '../types/manufacturer';

type Status = 'idle' | 'loading' | 'success' | 'error';

const EMPTY_ARTICLE: Article = {
  id: '',
  title: '',
  teaser: null,
  body: null,
  imageUrl: null,
  tags: [],
  publishedAt: '',
};

const EMPTY_PRODUCT: Product = {
  id: '',
  name: '',
  brand: null,
  quantity: null,
  description: null,
  imageUrl: null,
  source: 'manual',
  sourceUrl: null,
  category: null,
  discoveredAt: '',
  averageRating: 0,
  ratingsCount: 0,
  tags: [],
  categories: [],
  nutrition: null,
};

// Open Food Facts's search endpoint has been observed to start rejecting
// requests with a "temporarily unavailable" page after just a couple of
// quick searches, clearing again after roughly a minute (see the
// openfoodfacts-api skill). This is a heuristic, not a documented limit —
// the documented API limit (10 req/min) would allow ~6s between requests;
// 20s is a middle ground still being tested against the stricter
// undocumented block. If it starts tripping again, raise this back up.
const SEARCH_COOLDOWN_SECONDS = 20;

function SearchResultRow({
  result,
  onPress,
  adding,
}: {
  result: OpenFoodFactsSearchResult;
  onPress: () => void;
  adding: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={adding}
      style={({ pressed }) => [styles.resultRow, pressed && !adding && styles.resultRowPressed]}
    >
      {result.imageUrl ? (
        <Image source={{ uri: result.imageUrl }} style={styles.resultImage} />
      ) : (
        <View style={[styles.resultImage, styles.resultImagePlaceholder]} />
      )}
      <View style={styles.resultInfo}>
        <Text style={styles.resultName} numberOfLines={2}>
          {result.name}
        </Text>
        {result.brand ? <Text style={styles.resultBrand}>{result.brand}</Text> : null}
      </View>
      {adding ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.resultAddHint}>+</Text>}
    </Pressable>
  );
}

function formatDaysAgo(isoDate: string): string {
  const days = Math.floor((Date.now() - new Date(isoDate).getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 0) {
    return 'heute';
  }
  return days === 1 ? 'vor 1 Tag' : `vor ${days} Tagen`;
}

function NewSitemapEntryRow({ entry }: { entry: NewSitemapEntry }) {
  return (
    <Pressable
      onPress={() => Linking.openURL(entry.url)}
      style={({ pressed }) => [styles.resultRow, pressed && styles.resultRowPressed]}
    >
      <View style={styles.resultInfo}>
        <Text style={styles.resultName} numberOfLines={2}>
          {entry.url}
        </Text>
        <Text style={styles.resultBrand}>
          {entry.manufacturerHostname} · {formatDaysAgo(entry.firstSeenAt)}
        </Text>
      </View>
    </Pressable>
  );
}

type Section = 'products' | 'articles' | 'newProducts' | 'users';

export default function AdminScreen() {
  const { addProduct, editProduct, removeProduct, getProductById } = useProducts();
  const { articles, addArticle, editArticle, removeArticle } = useArticles();
  const { entries: newEntries, loading: newEntriesLoading, error: newEntriesError } = useNewSitemapEntries();
  const { signalWords, setSignalWords } = useSignalWordFilter();
  const {
    settings: automationSettings,
    loading: automationSettingsLoading,
    saving: automationSettingsSaving,
    setSitemapAutoCheckEnabled,
  } = useAutomationSettings();
  const [dismissedEntryIds, setDismissedEntryIds] = useState<Set<string>>(new Set());
  const signalFilteredEntries = useMemo(() => {
    if (signalWords.length === 0) {
      return newEntries;
    }
    return newEntries.filter((entry) => {
      const haystack = entry.url.toLowerCase();
      return signalWords.some((word) => haystack.includes(word));
    });
  }, [newEntries, signalWords]);
  const visibleNewEntries = useMemo(
    () => signalFilteredEntries.filter((entry) => !dismissedEntryIds.has(entry.id)),
    [signalFilteredEntries, dismissedEntryIds],
  );
  const handleClearNewEntries = () => {
    setDismissedEntryIds(
      (current) => new Set([...current, ...signalFilteredEntries.map((entry) => entry.id)]),
    );
  };

  const [section, setSection] = useState<Section>('products');

  // A fetched/scraped product sits here for review & editing before it's
  // actually added to the product list. When editingProductId is set, the
  // same form is reused to edit an existing product instead — saving then
  // updates that product rather than inserting a new one.
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Set only when pendingProduct came from the URL scraper (see
  // handleAddFromUrl) — Open Food Facts results and manual edits never touch
  // a manufacturer's sitemap, so this stays null for those and the
  // save-success message below skips the sitemap line entirely.
  const [scrapedHasSitemap, setScrapedHasSitemap] = useState<boolean | null>(null);

  // Primary: text search against Open Food Facts (no barcodes on hand).
  const [query, setQuery] = useState('');
  const [searchStatus, setSearchStatus] = useState<Status>('idle');
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [results, setResults] = useState<OpenFoodFactsSearchResult[]>([]);
  const [addingCode, setAddingCode] = useState<string | null>(null);
  const [nextSearchAllowedAt, setNextSearchAllowedAt] = useState<number | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  useEffect(() => {
    if (nextSearchAllowedAt === null) {
      return;
    }
    const tick = () => {
      const remaining = Math.ceil((nextSearchAllowedAt - Date.now()) / 1000);
      setCooldownSeconds(Math.max(0, remaining));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [nextSearchAllowedAt]);

  // Secondary: paste an arbitrary product URL and best-effort scrape it.
  const [url, setUrl] = useState('');
  const [urlStatus, setUrlStatus] = useState<Status>('idle');
  const [urlMessage, setUrlMessage] = useState<string | null>(null);

  // Update an existing product: load it by id into the same edit form.
  const [updateIdInput, setUpdateIdInput] = useState('');
  const [loadStatus, setLoadStatus] = useState<Status>('idle');
  const [loadMessage, setLoadMessage] = useState<string | null>(null);

  // Delete an existing product by its id.
  const [deleteId, setDeleteId] = useState('');
  const [deleteStatus, setDeleteStatus] = useState<Status>('idle');
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleSearch = async () => {
    const trimmed = query.trim();
    if (!trimmed || searchStatus === 'loading' || cooldownSeconds > 0) {
      return;
    }
    setSearchStatus('loading');
    setSearchMessage(null);
    setResults([]);
    try {
      const found = await searchProducts(trimmed);
      setSearchStatus('idle');
      if (found.length === 0) {
        setSearchMessage('Keine Treffer gefunden.');
      }
      setResults(found);
    } catch (error) {
      setSearchStatus('error');
      setSearchMessage(error instanceof Error ? error.message : 'Unbekannter Fehler bei der Suche.');
    } finally {
      setNextSearchAllowedAt(Date.now() + SEARCH_COOLDOWN_SECONDS * 1000);
    }
  };

  const handleSelectResult = async (result: OpenFoodFactsSearchResult) => {
    if (addingCode) {
      return;
    }
    setAddingCode(result.code);
    setSearchMessage(null);
    setScrapedHasSitemap(null);
    try {
      const product = await getProductByBarcode(result.code);
      setPendingProduct(product);
    } catch (error) {
      setSearchMessage(error instanceof Error ? error.message : 'Unbekannter Fehler beim Hinzufügen.');
    } finally {
      setAddingCode(null);
    }
  };

  const handleAddFromUrl = async () => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl || urlStatus === 'loading') {
      return;
    }
    setUrlStatus('loading');
    setUrlMessage(null);
    setSaveError(null);
    setScrapedHasSitemap(null);
    try {
      const { product, hasSitemap } = await scrapeProductFromUrl(trimmedUrl);
      setPendingProduct(product);
      setScrapedHasSitemap(hasSitemap);
      setUrlStatus('idle');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unbekannter Fehler beim Scrapen.';
      setUrlStatus('error');
      setUrlMessage(message);
      // Scraping failed (Status 403, robots-Sperre, unparsbare Seite, ...) —
      // statt einer Sackgasse direkt das leere Formular öffnen, damit das
      // Produkt manuell angelegt werden kann.
      setPendingProduct({ ...EMPTY_PRODUCT, sourceUrl: trimmedUrl });
      setSaveError(`${message} Bitte Produkt manuell ausfüllen.`);
    }
  };

  const handleLoadForEdit = () => {
    const trimmedId = updateIdInput.trim();
    if (!trimmedId) {
      return;
    }
    const existing = getProductById(trimmedId);
    if (!existing) {
      setLoadStatus('error');
      setLoadMessage('Kein Produkt mit dieser ID gefunden.');
      return;
    }
    setLoadStatus('idle');
    setLoadMessage(null);
    setEditingProductId(existing.id);
    setPendingProduct(existing);
    setScrapedHasSitemap(null);
  };

  const handleSaveProduct = async () => {
    if (!pendingProduct || saving) {
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      if (editingProductId) {
        const saved = await editProduct(editingProductId, pendingProduct);
        setLoadMessage(`„${saved.name}" wurde aktualisiert (ID: ${saved.id}).`);
        setLoadStatus('success');
        setUpdateIdInput('');
        setEditingProductId(null);
      } else {
        const saved = await addProduct(pendingProduct);
        const sitemapNote =
          scrapedHasSitemap === null
            ? ''
            : scrapedHasSitemap
              ? ' Sitemap erstellt.'
              : ' Sitemap konnte nicht erstellt werden.';
        setSearchMessage(`„${saved.name}" wurde in Supabase gespeichert (ID: ${saved.id}).${sitemapNote}`);
        setResults([]);
        setQuery('');
        setUrl('');
        setScrapedHasSitemap(null);
      }
      setPendingProduct(null);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Speichern fehlgeschlagen.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setPendingProduct(null);
    setEditingProductId(null);
    setSaveError(null);
  };

  const handleDelete = async () => {
    const trimmedId = deleteId.trim();
    if (!trimmedId || deleting) {
      return;
    }
    const existing = getProductById(trimmedId);
    if (!existing) {
      setDeleteStatus('error');
      setDeleteMessage('Kein Produkt mit dieser ID gefunden.');
      return;
    }
    setDeleting(true);
    try {
      await removeProduct(trimmedId);
      setDeleteStatus('success');
      setDeleteMessage(`„${existing.name}" wurde gelöscht.`);
      setDeleteId('');
    } catch (error) {
      setDeleteStatus('error');
      setDeleteMessage(error instanceof Error ? error.message : 'Löschen fehlgeschlagen.');
    } finally {
      setDeleting(false);
    }
  };

  // Article authoring: a create/edit draft, mirroring pendingProduct above,
  // plus a simple list of existing articles with inline edit/delete (no
  // search-by-id flow needed here — articles are hand-authored, not
  // imported, so the admin already knows which ones exist).
  const [pendingArticle, setPendingArticle] = useState<Article | null>(null);
  const [editingArticleId, setEditingArticleId] = useState<string | null>(null);
  const [savingArticle, setSavingArticle] = useState(false);
  const [saveArticleError, setSaveArticleError] = useState<string | null>(null);
  const [deletingArticleId, setDeletingArticleId] = useState<string | null>(null);
  const [articleMessage, setArticleMessage] = useState<string | null>(null);

  const handleStartNewArticle = () => {
    setPendingArticle(EMPTY_ARTICLE);
    setEditingArticleId(null);
    setSaveArticleError(null);
  };

  const handleEditArticle = (article: Article) => {
    setPendingArticle(article);
    setEditingArticleId(article.id);
    setSaveArticleError(null);
  };

  const handleSaveArticle = async () => {
    if (!pendingArticle || savingArticle) {
      return;
    }
    setSavingArticle(true);
    setSaveArticleError(null);
    try {
      if (editingArticleId) {
        await editArticle(editingArticleId, pendingArticle);
        setArticleMessage(`„${pendingArticle.title}" wurde aktualisiert.`);
      } else {
        const saved = await addArticle(pendingArticle);
        setArticleMessage(`„${saved.title}" wurde veröffentlicht.`);
      }
      setPendingArticle(null);
      setEditingArticleId(null);
    } catch (error) {
      setSaveArticleError(error instanceof Error ? error.message : 'Speichern fehlgeschlagen.');
    } finally {
      setSavingArticle(false);
    }
  };

  const handleCancelArticleEdit = () => {
    setPendingArticle(null);
    setEditingArticleId(null);
    setSaveArticleError(null);
  };

  const handleDeleteArticle = async (article: Article) => {
    if (deletingArticleId) {
      return;
    }
    setDeletingArticleId(article.id);
    setArticleMessage(null);
    try {
      await removeArticle(article.id);
      setArticleMessage(`„${article.title}" wurde gelöscht.`);
    } catch (error) {
      setArticleMessage(error instanceof Error ? error.message : 'Löschen fehlgeschlagen.');
    } finally {
      setDeletingArticleId(null);
    }
  };

  // Nutzerverwaltung: search a user by exact email, then delete on confirm.
  const [userEmailQuery, setUserEmailQuery] = useState('');
  const [userSearchStatus, setUserSearchStatus] = useState<Status>('idle');
  const [userSearchMessage, setUserSearchMessage] = useState<string | null>(null);
  const [foundUser, setFoundUser] = useState<AdminUser | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);

  const handleSearchUser = async () => {
    const trimmed = userEmailQuery.trim();
    if (!trimmed || userSearchStatus === 'loading') {
      return;
    }
    setUserSearchStatus('loading');
    setUserSearchMessage(null);
    setFoundUser(null);
    try {
      const user = await findUserByEmail(trimmed);
      setUserSearchStatus('idle');
      if (!user) {
        setUserSearchMessage('Kein Nutzer mit dieser E-Mail-Adresse gefunden.');
      }
      setFoundUser(user);
    } catch (error) {
      setUserSearchStatus('error');
      setUserSearchMessage(error instanceof Error ? error.message : 'Unbekannter Fehler bei der Suche.');
    }
  };

  const handleDeleteUser = async () => {
    if (!foundUser || deletingUser) {
      return;
    }
    setDeletingUser(true);
    try {
      await deleteUserAccount(foundUser.id);
      setUserSearchMessage(`Nutzer „${foundUser.email}" wurde gelöscht.`);
      setFoundUser(null);
      setUserEmailQuery('');
    } catch (error) {
      setUserSearchStatus('error');
      setUserSearchMessage(error instanceof Error ? error.message : 'Löschen fehlgeschlagen.');
    } finally {
      setDeletingUser(false);
    }
  };

  const userSearchDisabled = userSearchStatus === 'loading' || !userEmailQuery.trim();

  const searchDisabled = searchStatus === 'loading' || !query.trim() || cooldownSeconds > 0;
  const urlDisabled = urlStatus === 'loading' || !url.trim();
  const updateLoadDisabled = !updateIdInput.trim();
  const deleteDisabled = !deleteId.trim() || deleting;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.header}>Admin</Text>

      <View style={styles.subNav}>
        <Pressable
          onPress={() => setSection('products')}
          style={[styles.subNavButton, section === 'products' && styles.subNavButtonActive]}
        >
          <Text style={[styles.subNavButtonText, section === 'products' && styles.subNavButtonTextActive]}>
            Produkte ändern und hinzufügen
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setSection('articles')}
          style={[styles.subNavButton, section === 'articles' && styles.subNavButtonActive]}
        >
          <Text style={[styles.subNavButtonText, section === 'articles' && styles.subNavButtonTextActive]}>
            Artikel ändern oder hinzufügen
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setSection('newProducts')}
          style={[styles.subNavButton, section === 'newProducts' && styles.subNavButtonActive]}
        >
          <Text style={[styles.subNavButtonText, section === 'newProducts' && styles.subNavButtonTextActive]}>
            Neue Produkte gefunden
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setSection('users')}
          style={[styles.subNavButton, section === 'users' && styles.subNavButtonActive]}
        >
          <Text style={[styles.subNavButtonText, section === 'users' && styles.subNavButtonTextActive]}>
            Nutzerverwaltung
          </Text>
        </Pressable>
      </View>

      {section === 'products' ? (
        pendingProduct ? (
          <ProductEditForm
            product={pendingProduct}
            onChange={setPendingProduct}
            onSave={handleSaveProduct}
            onCancel={handleCancelEdit}
            saving={saving}
            error={saveError}
            title={
              editingProductId
                ? 'Produkt aktualisieren'
                : pendingProduct.source === 'manual'
                  ? 'Produkt manuell anlegen'
                  : 'Produkt prüfen & bearbeiten'
            }
          />
        ) : (
        <>
          <View style={styles.form}>
            <Text style={styles.label}>Produkt suchen</Text>
            <TextInput
              style={styles.input}
              placeholder="z.B. Ritter Sport Intensive"
              placeholderTextColor="#999"
              value={query}
              onChangeText={(text) => {
                setQuery(text);
                if (searchStatus === 'error') {
                  setSearchStatus('idle');
                  setSearchMessage(null);
                }
              }}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
              editable={searchStatus !== 'loading'}
            />

            <Pressable
              onPress={handleSearch}
              disabled={searchDisabled}
              style={({ pressed }) => [
                styles.button,
                searchDisabled && styles.buttonDisabled,
                pressed && !searchDisabled && styles.buttonPressed,
              ]}
            >
              {searchStatus === 'loading' ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>
                  {cooldownSeconds > 0 ? `Suchen (${cooldownSeconds}s)` : 'Suchen'}
                </Text>
              )}
            </Pressable>

            {cooldownSeconds > 0 ? (
              <Text style={styles.cooldownHint}>
                Open Food Facts limitiert Suchanfragen — nächste Suche in {cooldownSeconds}s möglich.
              </Text>
            ) : null}

            {searchMessage ? (
              <Text style={[styles.message, searchStatus === 'error' && styles.messageError]}>{searchMessage}</Text>
            ) : null}

            {results.length > 0 ? (
              <View style={styles.resultsList}>
                {results.map((result) => (
                  <SearchResultRow
                    key={result.code}
                    result={result}
                    adding={addingCode === result.code}
                    onPress={() => handleSelectResult(result)}
                  />
                ))}
              </View>
            ) : null}
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Alternative: Produkt-URL</Text>
            <TextInput
              style={styles.input}
              placeholder="Produkt-URL einfügen"
              placeholderTextColor="#999"
              value={url}
              onChangeText={(text) => {
                setUrl(text);
                if (urlStatus !== 'idle') {
                  setUrlStatus('idle');
                  setUrlMessage(null);
                }
              }}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              editable={urlStatus !== 'loading'}
            />

            <Pressable
              onPress={handleAddFromUrl}
              disabled={urlDisabled}
              style={({ pressed }) => [
                styles.button,
                urlDisabled && styles.buttonDisabled,
                pressed && !urlDisabled && styles.buttonPressed,
              ]}
            >
              {urlStatus === 'loading' ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Hinzufügen</Text>
              )}
            </Pressable>

            {urlMessage ? (
              <Text style={[styles.message, urlStatus === 'error' && styles.messageError]}>{urlMessage}</Text>
            ) : null}
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Produkt aktualisieren</Text>
            <TextInput
              style={styles.input}
              placeholder="Produkt-ID einfügen"
              placeholderTextColor="#999"
              value={updateIdInput}
              onChangeText={(text) => {
                setUpdateIdInput(text);
                if (loadStatus !== 'idle') {
                  setLoadStatus('idle');
                  setLoadMessage(null);
                }
              }}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Pressable
              onPress={handleLoadForEdit}
              disabled={updateLoadDisabled}
              style={({ pressed }) => [
                styles.button,
                updateLoadDisabled && styles.buttonDisabled,
                pressed && !updateLoadDisabled && styles.buttonPressed,
              ]}
            >
              <Text style={styles.buttonText}>Laden</Text>
            </Pressable>

            {loadMessage ? (
              <Text style={[styles.message, loadStatus === 'error' && styles.messageError]}>{loadMessage}</Text>
            ) : null}
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Produkt löschen</Text>
            <TextInput
              style={styles.input}
              placeholder="Produkt-ID einfügen"
              placeholderTextColor="#999"
              value={deleteId}
              onChangeText={(text) => {
                setDeleteId(text);
                if (deleteStatus !== 'idle') {
                  setDeleteStatus('idle');
                  setDeleteMessage(null);
                }
              }}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Pressable
              onPress={handleDelete}
              disabled={deleteDisabled}
              style={({ pressed }) => [
                styles.deleteButton,
                deleteDisabled && styles.deleteButtonDisabled,
                pressed && !deleteDisabled && styles.buttonPressed,
              ]}
            >
              {deleting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Löschen</Text>}
            </Pressable>

            {deleteMessage ? (
              <Text style={[styles.message, deleteStatus === 'error' && styles.messageError]}>{deleteMessage}</Text>
            ) : null}
          </View>
        </>
        )
      ) : section === 'articles' ? (
        pendingArticle ? (
        <ArticleEditForm
          article={pendingArticle}
          onChange={setPendingArticle}
          onSave={handleSaveArticle}
          onCancel={handleCancelArticleEdit}
          saving={savingArticle}
          error={saveArticleError}
          title={editingArticleId ? 'Artikel aktualisieren' : 'Artikel erstellen'}
        />
        ) : (
          <View style={styles.form}>
            <Text style={styles.label}>Snack-e-zine Artikel</Text>

            <Pressable
              onPress={handleStartNewArticle}
              style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            >
              <Text style={styles.buttonText}>Neuer Artikel</Text>
            </Pressable>

            {articleMessage ? <Text style={styles.message}>{articleMessage}</Text> : null}

            {articles.length > 0 ? (
              <View style={styles.resultsList}>
                {articles.map((article) => (
                  <View key={article.id} style={styles.articleRow}>
                    {article.imageUrl ? (
                      <Image source={{ uri: article.imageUrl }} style={styles.resultImage} />
                    ) : (
                      <View style={[styles.resultImage, styles.resultImagePlaceholder]} />
                    )}
                    <View style={styles.resultInfo}>
                      <Text style={styles.resultName} numberOfLines={2}>
                        {article.title}
                      </Text>
                    </View>
                    <Pressable onPress={() => handleEditArticle(article)} style={styles.articleActionButton}>
                      <Text style={styles.articleActionText}>Bearbeiten</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleDeleteArticle(article)}
                      disabled={deletingArticleId === article.id}
                      style={styles.articleActionButton}
                    >
                      {deletingArticleId === article.id ? (
                        <ActivityIndicator color="#c62828" />
                      ) : (
                        <Text style={[styles.articleActionText, styles.articleActionTextDanger]}>Löschen</Text>
                      )}
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.cooldownHint}>Noch keine Artikel.</Text>
            )}
          </View>
        )
      ) : section === 'newProducts' ? (
        <View style={styles.form}>
          <Text style={styles.label}>Neue Produkte gefunden</Text>
          <Text style={styles.cooldownHint}>
            URLs aus Hersteller-Sitemaps, die in den letzten 7 Tagen neu aufgetaucht sind.
          </Text>

          <View style={styles.automationRow}>
            <View style={styles.automationTextWrap}>
              <Text style={styles.automationLabel}>Tägliche Sitemap-Prüfung (18 Uhr)</Text>
              <Text style={styles.automationHint}>
                Prüft automatisch jeden Tag alle Hersteller-Sitemaps auf neue Produkte.
              </Text>
            </View>
            {automationSettingsLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Switch
                value={automationSettings?.sitemapAutoCheckEnabled ?? false}
                onValueChange={setSitemapAutoCheckEnabled}
                disabled={automationSettingsSaving || !automationSettings}
                trackColor={{ true: colors.primary }}
              />
            )}
          </View>

          {newEntriesLoading ? (
            <ActivityIndicator color={colors.primary} style={styles.newEntriesLoading} />
          ) : newEntriesError ? (
            <Text style={[styles.message, styles.messageError]}>{newEntriesError}</Text>
          ) : (
            <>
              <SignalWordFilterBar words={signalWords} onChangeWords={setSignalWords} />

              {visibleNewEntries.length > 0 ? (
                <>
                  <Pressable
                    onPress={handleClearNewEntries}
                    style={({ pressed }) => [styles.clearButton, pressed && styles.clearButtonPressed]}
                  >
                    <Text style={styles.clearButtonText}>Alle löschen</Text>
                  </Pressable>
                  <View style={styles.resultsList}>
                    {visibleNewEntries.map((entry) => (
                      <NewSitemapEntryRow key={entry.id} entry={entry} />
                    ))}
                  </View>
                </>
              ) : newEntries.length === 0 ? (
                <Text style={styles.cooldownHint}>Keine neuen Produkte in den letzten 7 Tagen.</Text>
              ) : signalFilteredEntries.length === 0 ? (
                <Text style={styles.cooldownHint}>Keine Treffer für die gewählten Signalwörter.</Text>
              ) : (
                <Text style={styles.cooldownHint}>Alle Einträge wurden ausgeblendet.</Text>
              )}
            </>
          )}
        </View>
      ) : (
        <View style={styles.form}>
          <Text style={styles.label}>Nutzer suchen</Text>
          <TextInput
            style={styles.input}
            placeholder="E-Mail-Adresse"
            placeholderTextColor="#999"
            value={userEmailQuery}
            onChangeText={(text) => {
              setUserEmailQuery(text);
              setUserSearchStatus('idle');
              setUserSearchMessage(null);
              setFoundUser(null);
            }}
            onSubmitEditing={handleSearchUser}
            returnKeyType="search"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={userSearchStatus !== 'loading'}
          />

          <Pressable
            onPress={handleSearchUser}
            disabled={userSearchDisabled}
            style={({ pressed }) => [
              styles.button,
              userSearchDisabled && styles.buttonDisabled,
              pressed && !userSearchDisabled && styles.buttonPressed,
            ]}
          >
            {userSearchStatus === 'loading' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Suchen</Text>
            )}
          </Pressable>

          {userSearchMessage ? (
            <Text style={[styles.message, userSearchStatus === 'error' && styles.messageError]}>
              {userSearchMessage}
            </Text>
          ) : null}

          {foundUser ? (
            <View style={styles.resultRow}>
              <View style={styles.resultInfo}>
                <Text style={styles.resultName}>{foundUser.email}</Text>
                <Text style={styles.resultBrand}>Registriert seit {formatDaysAgo(foundUser.createdAt)}</Text>
              </View>
              <Pressable
                onPress={handleDeleteUser}
                disabled={deletingUser}
                style={({ pressed }) => [
                  styles.deleteButton,
                  styles.userDeleteButton,
                  deletingUser && styles.deleteButtonDisabled,
                  pressed && !deletingUser && styles.buttonPressed,
                ]}
              >
                {deletingUser ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Löschen</Text>}
              </Pressable>
            </View>
          ) : null}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  header: {
    fontSize: 24,
    fontFamily: fonts.heading,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 16,
    color: colors.text,
  },
  subNav: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },
  subNavButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  subNavButtonActive: {
    backgroundColor: colors.primary,
  },
  subNavButtonText: {
    fontSize: 13,
    fontFamily: fonts.bodyMedium,
    color: colors.textMuted,
    textAlign: 'center',
  },
  subNavButtonTextActive: {
    color: '#fff',
  },
  form: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  label: {
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: fonts.body,
    color: colors.text,
    backgroundColor: '#fafafa',
  },
  button: {
    marginTop: 12,
    backgroundColor: colors.cta,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonDisabled: {
    backgroundColor: '#f3c299',
  },
  deleteButton: {
    marginTop: 12,
    backgroundColor: colors.danger,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonDisabled: {
    backgroundColor: '#e59a9a',
  },
  userDeleteButton: {
    marginTop: 0,
    paddingHorizontal: 16,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: fonts.bodyMedium,
  },
  message: {
    marginTop: 12,
    fontSize: 13,
    fontFamily: fonts.body,
    color: '#2e7d32',
  },
  cooldownHint: {
    marginTop: 12,
    fontSize: 12,
    fontFamily: fonts.body,
    color: '#888',
  },
  newEntriesLoading: {
    marginTop: 12,
  },
  automationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    padding: 12,
    backgroundColor: colors.background,
    borderRadius: 8,
    gap: 12,
  },
  automationTextWrap: {
    flex: 1,
  },
  automationLabel: {
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
    color: colors.text,
  },
  automationHint: {
    fontSize: 12,
    fontFamily: fonts.body,
    color: '#888',
    marginTop: 2,
  },
  clearButton: {
    marginTop: 12,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  clearButtonPressed: {
    backgroundColor: colors.background,
  },
  clearButtonText: {
    fontSize: 13,
    fontFamily: fonts.bodyMedium,
    color: colors.textMuted,
  },
  messageError: {
    color: colors.danger,
  },
  resultsList: {
    marginTop: 12,
    gap: 8,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    padding: 8,
  },
  resultRowPressed: {
    backgroundColor: colors.primaryLight,
  },
  resultImage: {
    width: 44,
    height: 44,
    borderRadius: 6,
  },
  resultImagePlaceholder: {
    backgroundColor: '#e5e5e5',
  },
  resultInfo: {
    flex: 1,
    marginLeft: 10,
  },
  resultName: {
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
    color: colors.text,
  },
  resultBrand: {
    fontSize: 12,
    fontFamily: fonts.body,
    color: '#666',
    marginTop: 2,
  },
  resultAddHint: {
    fontSize: 20,
    color: colors.primary,
    fontFamily: fonts.bodyMedium,
    paddingHorizontal: 8,
  },
  articleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    padding: 8,
  },
  articleActionButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  articleActionText: {
    fontSize: 12,
    fontFamily: fonts.bodyMedium,
    color: colors.primary,
  },
  articleActionTextDanger: {
    color: colors.danger,
  },
});

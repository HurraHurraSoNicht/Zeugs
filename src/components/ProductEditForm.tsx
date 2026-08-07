import { useEffect, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { HOME_CATEGORIES } from '../data/homeCategories';
import { uploadProductImage } from '../services/productImagesApi';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import type { NutritionFacts } from '../types/nutrition';
import type { Product } from '../types/product';
import { normalizeScrapedText } from '../utils/normalizeScrapedText';
import { parseNutritionText } from '../utils/parseNutritionText';

// "Alle Produkte" is a catch-all view, not a real category a product can
// be assigned to — every product implicitly belongs to it.
const ASSIGNABLE_CATEGORIES = HOME_CATEGORIES.filter((category) => category.id !== 'all');

interface ProductEditFormProps {
  product: Product;
  onChange: (product: Product) => void;
  onSave: () => void;
  onCancel: () => void;
  saving?: boolean;
  error?: string | null;
  title?: string;
}

const EMPTY_NUTRITION: NutritionFacts = {
  energyKcal: null,
  energyKj: null,
  fat: null,
  saturatedFat: null,
  carbohydrates: null,
  sugars: null,
  fiber: null,
  protein: null,
  salt: null,
};

const NUTRITION_FIELDS: { key: keyof NutritionFacts; label: string; unit: string }[] = [
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

function numberOrNull(text: string): number | null {
  const trimmed = text.trim().replace(',', '.');
  if (!trimmed) {
    return null;
  }
  const parsed = parseFloat(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

type NutritionTextState = Record<keyof NutritionFacts, string>;

function nutritionToText(nutrition: NutritionFacts | null): NutritionTextState {
  const source = nutrition ?? EMPTY_NUTRITION;
  const result = {} as NutritionTextState;
  for (const { key } of NUTRITION_FIELDS) {
    const value = source[key];
    result[key] = value != null ? String(value) : '';
  }
  return result;
}

export default function ProductEditForm({
  product,
  onChange,
  onSave,
  onCancel,
  saving = false,
  error = null,
  title = 'Produkt prüfen & bearbeiten',
}: ProductEditFormProps) {
  const [imageError, setImageError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Populated on a failed Speichern attempt (see handleSavePress) and shown
  // inline under the relevant field; cleared as soon as the admin edits that
  // field again so a fixed field doesn't keep showing a stale error.
  const [validationErrors, setValidationErrors] = useState<{
    image: string | null;
    description: string | null;
    tags: string | null;
    categories: string | null;
  }>({ image: null, description: null, tags: null, categories: null });

  const clearValidationError = (field: keyof typeof validationErrors) => {
    setValidationErrors((current) => (current[field] ? { ...current, [field]: null } : current));
  };
  useEffect(() => {
    setValidationErrors({ image: null, description: null, tags: null, categories: null });
  }, [product.id]);

  // Kept as its own state instead of deriving from product.tags.join(', ') on
  // every render — otherwise each keystroke re-parses+re-joins the string,
  // which strips a trailing/in-progress comma (an empty segment gets
  // filtered out) and snaps the input back, making it look like commas
  // can't be typed at all. Only resync when a different product is loaded.
  const [tagsText, setTagsText] = useState(product.tags.join(', '));
  useEffect(() => {
    setTagsText(product.tags.join(', '));
  }, [product.id]);

  // Same reasoning as tagsText: showing the nutrition inputs' value straight
  // from the parsed number (e.g. via String(product.nutrition[key])) means
  // every keystroke re-parses and re-formats it, which drops a trailing/
  // in-progress "," or "." and snaps the field back — making it look like a
  // comma (decimal separator) can't be typed at all. Kept as separate text
  // state per field instead, only resynced when a different product loads.
  const [nutritionText, setNutritionText] = useState<NutritionTextState>(() =>
    nutritionToText(product.nutrition),
  );
  useEffect(() => {
    setNutritionText(nutritionToText(product.nutrition));
  }, [product.id]);

  const updateField = <K extends keyof Product>(key: K, value: Product[K]) => {
    onChange({ ...product, [key]: value });
  };

  const updateNutrition = (key: keyof NutritionFacts, text: string) => {
    setNutritionText((current) => ({ ...current, [key]: text }));
    const current = product.nutrition ?? EMPTY_NUTRITION;
    onChange({ ...product, nutrition: { ...current, [key]: numberOrNull(text) } });
  };

  const [nutritionPasteText, setNutritionPasteText] = useState('');
  const [parseMessage, setParseMessage] = useState<string | null>(null);

  const handleParseNutrition = () => {
    if (!nutritionPasteText.trim()) {
      return;
    }
    const { nutrition: parsed, matchedCount } = parseNutritionText(nutritionPasteText);
    const current = product.nutrition ?? EMPTY_NUTRITION;
    const merged = { ...current };
    const updatedText = { ...nutritionText };
    (Object.keys(parsed) as (keyof NutritionFacts)[]).forEach((key) => {
      const value = parsed[key];
      if (value != null) {
        merged[key] = value;
        updatedText[key] = String(value);
      }
    });
    onChange({ ...product, nutrition: merged });
    setNutritionText(updatedText);
    setParseMessage(
      matchedCount > 0
        ? `${matchedCount} von 9 Werten erkannt und übernommen — bitte unten prüfen.`
        : 'Keine Werte erkannt. Bitte unten manuell eintragen.',
    );
  };

  const toggleCategory = (categoryId: string) => {
    const next = product.categories.includes(categoryId)
      ? product.categories.filter((id) => id !== categoryId)
      : [...product.categories, categoryId];
    updateField('categories', next);
    clearValidationError('categories');
  };

  const handleNormalizeDescription = () => {
    if (!product.description) {
      return;
    }
    updateField('description', normalizeScrapedText(product.description));
  };

  const handlePickImage = async () => {
    setImageError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setImageError('Zugriff auf Fotos/Bilder wurde nicht erlaubt.');
      return;
    }
    setUploading(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        base64: true,
        quality: 0.7,
      });
      if (result.canceled || !result.assets?.[0]) {
        return;
      }
      const asset = result.assets[0];
      if (!asset.base64) {
        setImageError('Bild konnte nicht gelesen werden.');
        return;
      }
      const mimeType = asset.mimeType ?? 'image/jpeg';
      const imageUrl = await uploadProductImage(asset.base64, mimeType);
      updateField('imageUrl', imageUrl);
      clearValidationError('image');
    } catch (err) {
      setImageError(err instanceof Error ? err.message : 'Bild konnte nicht hochgeladen werden.');
    } finally {
      setUploading(false);
    }
  };

  const nameValid = product.name.trim().length > 0;

  const handleSavePress = () => {
    const errors = {
      image: product.imageUrl ? null : 'Bitte ein Bild hinzufügen.',
      description: product.description?.trim() ? null : 'Bitte eine Beschreibung eingeben.',
      tags: product.tags.length > 0 ? null : 'Bitte mindestens einen Tag eingeben.',
      categories: product.categories.length > 0 ? null : 'Bitte mindestens eine Kategorie auswählen.',
    };
    setValidationErrors(errors);
    if (Object.values(errors).some(Boolean)) {
      return;
    }
    onSave();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>{title}</Text>

      {product.imageUrl ? (
        <Image source={{ uri: product.imageUrl }} style={styles.image} resizeMode="contain" />
      ) : (
        <View style={[styles.image, styles.imagePlaceholder]} />
      )}

      <Text style={styles.label}>Bild-URL</Text>
      <TextInput
        style={styles.input}
        placeholder="https://..."
        placeholderTextColor="#999"
        value={product.imageUrl ?? ''}
        onChangeText={(text) => {
          updateField('imageUrl', text || null);
          clearValidationError('image');
        }}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Pressable
        onPress={handlePickImage}
        disabled={uploading}
        style={({ pressed }) => [
          styles.secondaryButton,
          pressed && !uploading && styles.secondaryButtonPressed,
        ]}
      >
        {uploading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Text style={styles.secondaryButtonText}>Bild hochladen</Text>
        )}
      </Pressable>
      {imageError ? <Text style={styles.errorText}>{imageError}</Text> : null}
      {validationErrors.image ? <Text style={styles.errorText}>{validationErrors.image}</Text> : null}

      <Text style={styles.label}>Name</Text>
      <TextInput style={styles.input} value={product.name} onChangeText={(text) => updateField('name', text)} />

      <Text style={styles.label}>Hersteller</Text>
      <TextInput
        style={styles.input}
        value={product.brand ?? ''}
        onChangeText={(text) => updateField('brand', text || null)}
      />

      <Text style={styles.label}>Menge / Gewicht</Text>
      <TextInput
        style={styles.input}
        placeholder="z.B. 250 g, 500 ml, 3 x 100 g"
        placeholderTextColor="#999"
        value={product.quantity ?? ''}
        onChangeText={(text) => updateField('quantity', text || null)}
      />

      <Text style={styles.label}>Beschreibung</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={product.description ?? ''}
        onChangeText={(text) => {
          updateField('description', text || null);
          clearValidationError('description');
        }}
        multiline
      />
      <Pressable
        onPress={handleNormalizeDescription}
        disabled={!product.description}
        style={({ pressed }) => [
          styles.secondaryButton,
          !product.description && styles.secondaryButtonDisabled,
          pressed && !!product.description && styles.secondaryButtonPressed,
        ]}
      >
        <Text style={styles.secondaryButtonText}>Text normalisieren</Text>
      </Pressable>
      {validationErrors.description ? <Text style={styles.errorText}>{validationErrors.description}</Text> : null}

      <Text style={styles.label}>Tags (kommagetrennt)</Text>
      <TextInput
        style={styles.input}
        placeholder="vegan, bio, glutenfrei"
        placeholderTextColor="#999"
        value={tagsText}
        onChangeText={(text) => {
          setTagsText(text);
          updateField(
            'tags',
            text
              .split(',')
              .map((tag) => tag.trim())
              .filter(Boolean),
          );
          clearValidationError('tags');
        }}
      />
      {validationErrors.tags ? <Text style={styles.errorText}>{validationErrors.tags}</Text> : null}

      <Text style={styles.label}>Kategorien</Text>
      <View style={styles.categoriesGrid}>
        {ASSIGNABLE_CATEGORIES.map((category) => {
          const checked = product.categories.includes(category.id);
          return (
            <Pressable
              key={category.id}
              onPress={() => toggleCategory(category.id)}
              style={({ pressed }) => [styles.categoryRow, pressed && styles.categoryRowPressed]}
            >
              <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                {checked ? <Text style={styles.checkboxMark}>✓</Text> : null}
              </View>
              <Text style={styles.categoryLabel}>
                {category.emoji} {category.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {validationErrors.categories ? <Text style={styles.errorText}>{validationErrors.categories}</Text> : null}

      <Text style={styles.sectionSubtitle}>Nährwerte (pro 100 g/ml)</Text>

      <Text style={styles.label}>Nährwerte per Text übernehmen</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        placeholder={
          'z.B. von der Verpackung kopiert:\nEnergie 2300 kJ / 550 kcal, Fett 30 g, davon gesättigte ' +
          'Fettsäuren 10 g, Kohlenhydrate 40 g, davon Zucker 20 g, Ballaststoffe 5 g, Eiweiß 10 g, Salz 1,2 g'
        }
        placeholderTextColor="#999"
        value={nutritionPasteText}
        onChangeText={setNutritionPasteText}
        multiline
      />
      <Pressable
        onPress={handleParseNutrition}
        disabled={!nutritionPasteText.trim()}
        style={({ pressed }) => [
          styles.secondaryButton,
          !nutritionPasteText.trim() && styles.secondaryButtonDisabled,
          pressed && !!nutritionPasteText.trim() && styles.secondaryButtonPressed,
        ]}
      >
        <Text style={styles.secondaryButtonText}>Werte übernehmen</Text>
      </Pressable>
      {parseMessage ? <Text style={styles.parseMessage}>{parseMessage}</Text> : null}

      {NUTRITION_FIELDS.map(({ key, label, unit }) => (
        <View key={key} style={styles.nutritionRow}>
          <Text style={styles.nutritionLabel}>
            {label} ({unit})
          </Text>
          <TextInput
            style={styles.nutritionInput}
            keyboardType="decimal-pad"
            value={nutritionText[key]}
            onChangeText={(text) => updateNutrition(key, text)}
          />
        </View>
      ))}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.actionsRow}>
        <Pressable
          onPress={onCancel}
          disabled={saving}
          style={({ pressed }) => [styles.cancelButton, pressed && !saving && styles.cancelButtonPressed]}
        >
          <Text style={styles.cancelButtonText}>Abbrechen</Text>
        </Pressable>
        <Pressable
          onPress={handleSavePress}
          disabled={!nameValid || saving}
          style={({ pressed }) => [
            styles.saveButton,
            (!nameValid || saving) && styles.saveButtonDisabled,
            pressed && nameValid && !saving && styles.saveButtonPressed,
          ]}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Speichern</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: fonts.heading,
    color: colors.text,
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 14,
    fontFamily: fonts.heading,
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  image: {
    width: '100%',
    height: 160,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: '#f0f0f0',
  },
  imagePlaceholder: {
    backgroundColor: '#e5e5e5',
  },
  label: {
    fontSize: 13,
    fontFamily: fonts.bodyMedium,
    color: '#333',
    marginTop: 10,
    marginBottom: 6,
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
  multiline: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  secondaryButton: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonPressed: {
    backgroundColor: colors.primaryLight,
  },
  secondaryButtonDisabled: {
    borderColor: '#ccc',
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
  },
  categoriesGrid: {
    marginTop: 4,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  categoryRowPressed: {
    opacity: 0.6,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
  },
  checkboxMark: {
    color: '#fff',
    fontSize: 13,
    fontFamily: fonts.bodyBold,
    lineHeight: 14,
  },
  categoryLabel: {
    fontSize: 14,
    fontFamily: fonts.body,
    color: colors.text,
  },
  parseMessage: {
    marginTop: 6,
    marginBottom: 4,
    fontSize: 12,
    fontFamily: fonts.body,
    color: '#2e7d32',
  },
  errorText: {
    marginTop: 6,
    fontSize: 12,
    fontFamily: fonts.body,
    color: colors.danger,
  },
  nutritionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  nutritionLabel: {
    flex: 1,
    fontSize: 13,
    fontFamily: fonts.body,
    color: '#444',
    marginRight: 8,
  },
  nutritionInput: {
    width: 90,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    fontFamily: fonts.body,
    color: colors.text,
    backgroundColor: '#fafafa',
    textAlign: 'right',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonPressed: {
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    color: '#555',
    fontSize: 15,
    fontFamily: fonts.bodyMedium,
  },
  saveButton: {
    flex: 1,
    backgroundColor: colors.cta,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonPressed: {
    opacity: 0.85,
  },
  saveButtonDisabled: {
    backgroundColor: '#f3c299',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: fonts.bodyMedium,
  },
});

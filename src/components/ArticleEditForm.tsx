import { useEffect, useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { uploadArticleImage } from '../services/articleImagesApi';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import type { Article } from '../types/article';

interface ArticleEditFormProps {
  article: Article;
  onChange: (article: Article) => void;
  onSave: () => void;
  onCancel: () => void;
  saving?: boolean;
  error?: string | null;
  title?: string;
}

export default function ArticleEditForm({
  article,
  onChange,
  onSave,
  onCancel,
  saving = false,
  error = null,
  title = 'Artikel erstellen',
}: ArticleEditFormProps) {
  const [imageError, setImageError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Kept as its own state instead of deriving from article.tags.join(', ')
  // on every render — otherwise each keystroke re-parses+re-joins the
  // string, which strips a trailing/in-progress comma (an empty segment
  // gets filtered out) and snaps the input back, making it look like commas
  // can't be typed at all (see the identical comment in ProductEditForm).
  // Only resync when a different article is loaded.
  const [tagsText, setTagsText] = useState(article.tags.join(', '));
  useEffect(() => {
    setTagsText(article.tags.join(', '));
  }, [article.id]);

  const updateField = <K extends keyof Article>(key: K, value: Article[K]) => {
    onChange({ ...article, [key]: value });
  };

  // Tracks the Text field's cursor/selection (read-only) so the formatting
  // toolbar below knows where to insert or wrap markdown syntax. This is
  // deliberately NOT fed back into the TextInput as a controlled `selection`
  // prop — doing that once caused a feedback loop (onSelectionChange fires
  // on every keystroke too, re-asserting a slightly-stale selection on each
  // render) that blocked normal typing entirely on web. Repositioning the
  // cursor after a toolbar click is instead done imperatively via the ref
  // below, one-shot, so it never interferes with regular typing.
  const [bodySelection, setBodySelection] = useState({ start: 0, end: 0 });
  const bodyInputRef = useRef<TextInput>(null);
  const pendingCursorRef = useRef<number | null>(null);

  useEffect(() => {
    if (pendingCursorRef.current != null) {
      const cursor = pendingCursorRef.current;
      pendingCursorRef.current = null;
      // setNativeProps is a native-only TextInput method — react-native-web's
      // ref doesn't implement it, and calling it there throws (not just
      // no-ops), so this must be feature-detected rather than called
      // unconditionally. Cursor just won't auto-reposition on web.
      const input = bodyInputRef.current;
      if (input && typeof input.setNativeProps === 'function') {
        input.setNativeProps({ selection: { start: cursor, end: cursor } });
      }
    }
  }, [article.body]);

  const wrapBodySelection = (marker: string, placeholder: string) => {
    const text = article.body ?? '';
    const { start, end } = bodySelection;
    const selected = text.slice(start, end);
    const inner = selected || placeholder;
    const newText = text.slice(0, start) + marker + inner + marker + text.slice(end);
    pendingCursorRef.current = start + marker.length + inner.length + marker.length;
    updateField('body', newText);
  };

  const applyBodyHeading = (level: 1 | 2) => {
    const text = article.body ?? '';
    const { start } = bodySelection;
    const lineStart = text.lastIndexOf('\n', Math.max(start - 1, 0)) + 1;
    const restOfLine = text.slice(lineStart);
    const stripped = restOfLine.replace(/^#{1,6}\s+/, '');
    const marker = '#'.repeat(level) + ' ';
    const newText = text.slice(0, lineStart) + marker + stripped;
    pendingCursorRef.current = start + marker.length - (restOfLine.length - stripped.length);
    updateField('body', newText);
  };

  // Table cells are single-line, so a "|" or a line break in the text would
  // break the row's syntax — both get neutralized before insertion.
  const escapeTableCell = (text: string) => text.replace(/\|/g, '\\|').replace(/\r?\n+/g, ' ').trim();

  const [insertingBodyImage, setInsertingBodyImage] = useState(false);

  // Inserts an uploaded image beside the currently selected text using a
  // 2-column GFM table as a layout trick (invisible borders, see
  // markdownStyles.ts/markdownRules.tsx) — left cell keeps the selected
  // text (or a placeholder), right cell gets the image. The blank lines
  // around the block are required so markdown-it parses it as a table
  // rather than folding it into the surrounding paragraph.
  //
  // The image is uploaded to Supabase Storage rather than embedded as a
  // base64 data URI: a data URI is one giant unbroken string with no
  // spaces/newlines, and putting that inside a plain multiline TextInput
  // (a real <textarea> on web) can hang the browser's text-layout engine
  // for anything but a tiny image — confirmed by testing with a ~400KB
  // photo, which froze the tab. A short Storage URL avoids that entirely.
  const handleInsertBodyImage = async () => {
    setImageError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setImageError('Zugriff auf Fotos/Bilder wurde nicht erlaubt.');
      return;
    }
    setInsertingBodyImage(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        base64: true,
        quality: 0.6,
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
      const imageUrl = await uploadArticleImage(asset.base64, mimeType);

      const text = article.body ?? '';
      const { start, end } = bodySelection;
      const leftText = escapeTableCell(text.slice(start, end)) || 'Bildbeschreibung hier einfügen';
      const block = `\n\n|  |  |\n| --- | --- |\n| ${leftText} | ![Bild](${imageUrl}) |\n\n`;
      const newText = text.slice(0, start) + block + text.slice(end);
      pendingCursorRef.current = start + block.length;
      updateField('body', newText);
    } catch (err) {
      setImageError(err instanceof Error ? err.message : 'Bild konnte nicht hochgeladen werden.');
    } finally {
      setInsertingBodyImage(false);
    }
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
      const imageUrl = await uploadArticleImage(asset.base64, mimeType);
      updateField('imageUrl', imageUrl);
    } catch (err) {
      setImageError(err instanceof Error ? err.message : 'Bild konnte nicht hochgeladen werden.');
    } finally {
      setUploading(false);
    }
  };

  const titleValid = article.title.trim().length > 0;

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>{title}</Text>

      {article.imageUrl ? (
        <Image source={{ uri: article.imageUrl }} style={styles.image} />
      ) : (
        <View style={[styles.image, styles.imagePlaceholder]} />
      )}

      <Text style={styles.label}>Bild-URL</Text>
      <TextInput
        style={styles.input}
        placeholder="https://..."
        placeholderTextColor="#999"
        value={article.imageUrl ?? ''}
        onChangeText={(text) => updateField('imageUrl', text || null)}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Pressable
        onPress={handlePickImage}
        disabled={uploading}
        style={({ pressed }) => [styles.secondaryButton, pressed && !uploading && styles.secondaryButtonPressed]}
      >
        {uploading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Text style={styles.secondaryButtonText}>Bild hochladen</Text>
        )}
      </Pressable>
      {imageError ? <Text style={styles.errorText}>{imageError}</Text> : null}

      <Text style={styles.label}>Titel</Text>
      <TextInput style={styles.input} value={article.title} onChangeText={(text) => updateField('title', text)} />

      <Text style={styles.label}>Teaser</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={article.teaser ?? ''}
        onChangeText={(text) => updateField('teaser', text || null)}
        multiline
      />

      <Text style={styles.label}>Text</Text>
      <View style={styles.markdownToolbar}>
        <Pressable onPress={() => applyBodyHeading(1)} style={styles.toolbarButton}>
          <Text style={styles.toolbarButtonText}>H1</Text>
        </Pressable>
        <Pressable onPress={() => applyBodyHeading(2)} style={styles.toolbarButton}>
          <Text style={styles.toolbarButtonText}>H2</Text>
        </Pressable>
        <Pressable onPress={() => wrapBodySelection('**', 'fett')} style={styles.toolbarButton}>
          <Text style={[styles.toolbarButtonText, styles.toolbarButtonBold]}>F</Text>
        </Pressable>
        <Pressable onPress={() => wrapBodySelection('*', 'kursiv')} style={styles.toolbarButton}>
          <Text style={[styles.toolbarButtonText, styles.toolbarButtonItalic]}>K</Text>
        </Pressable>
        <Pressable
          onPress={handleInsertBodyImage}
          disabled={insertingBodyImage}
          style={styles.toolbarButton}
        >
          {insertingBodyImage ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <Text style={styles.toolbarButtonText}>🖼️ Bild</Text>
          )}
        </Pressable>
      </View>
      <TextInput
        ref={bodyInputRef}
        style={[styles.input, styles.multilineBody]}
        value={article.body ?? ''}
        onChangeText={(text) => updateField('body', text || null)}
        onSelectionChange={(event) => setBodySelection(event.nativeEvent.selection)}
        multiline
      />
      <Text style={styles.hint}>
        Markdown wird unterstützt: **fett**, *kursiv*, # Überschrift, ## Unterüberschrift. 🖼️ Bild fügt ein
        hochgeladenes Bild neben dem markierten Text ein.
      </Text>

      <Text style={styles.label}>Tags (kommagetrennt)</Text>
      <TextInput
        style={styles.input}
        placeholder="rezepte, ernährung, trend"
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
        }}
      />

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
          onPress={onSave}
          disabled={!titleValid || saving}
          style={({ pressed }) => [
            styles.saveButton,
            (!titleValid || saving) && styles.saveButtonDisabled,
            pressed && titleValid && !saving && styles.saveButtonPressed,
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
  image: {
    width: '100%',
    height: 160,
    borderRadius: 8,
    marginBottom: 12,
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
  multilineBody: {
    minHeight: 160,
    textAlignVertical: 'top',
  },
  markdownToolbar: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  toolbarButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#fafafa',
  },
  toolbarButtonText: {
    fontSize: 13,
    fontFamily: fonts.bodyMedium,
    color: '#333',
  },
  toolbarButtonBold: {
    fontFamily: fonts.bodyBold,
  },
  toolbarButtonItalic: {
    fontStyle: 'italic',
  },
  hint: {
    fontSize: 11,
    fontFamily: fonts.body,
    color: '#999',
    marginTop: 6,
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
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
  },
  errorText: {
    marginTop: 6,
    fontSize: 12,
    fontFamily: fonts.body,
    color: colors.danger,
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

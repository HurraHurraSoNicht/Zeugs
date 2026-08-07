import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';

const MAX_TAGS = 3;

interface TagFilterBarProps {
  allTags: string[];
  selectedTags: string[];
  onChangeSelectedTags: (tags: string[]) => void;
}

export default function TagFilterBar({ allTags, selectedTags, onChangeSelectedTags }: TagFilterBarProps) {
  const [query, setQuery] = useState('');
  const atMax = selectedTags.length >= MAX_TAGS;

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || atMax) {
      return [];
    }
    return allTags
      .filter((tag) => !selectedTags.includes(tag) && tag.toLowerCase().startsWith(q))
      .slice(0, 8);
  }, [query, allTags, selectedTags, atMax]);

  const handleSelect = (tag: string) => {
    if (atMax) {
      return;
    }
    onChangeSelectedTags([...selectedTags, tag]);
    setQuery('');
  };

  const handleReset = () => {
    onChangeSelectedTags([]);
    setQuery('');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Nach Tags filtern (max. {MAX_TAGS})</Text>
      <TextInput
        style={[styles.input, atMax && styles.inputDisabled]}
        placeholder={atMax ? `Maximal ${MAX_TAGS} Tags ausgewählt` : 'Tag suchen (z. B. Protein)…'}
        placeholderTextColor="#999"
        value={query}
        onChangeText={setQuery}
        editable={!atMax}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {suggestions.length > 0 ? (
        <View style={styles.suggestions}>
          {suggestions.map((tag, index) => (
            <Pressable
              key={tag}
              onPress={() => handleSelect(tag)}
              style={({ pressed }) => [
                styles.suggestionItem,
                index === suggestions.length - 1 && styles.suggestionItemLast,
                pressed && styles.suggestionItemPressed,
              ]}
            >
              <Text style={styles.suggestionText}>{tag}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {selectedTags.length > 0 ? (
        <View style={styles.selectedRow}>
          <View style={styles.chipsWrap}>
            {selectedTags.map((tag) => (
              <View key={tag} style={styles.chip}>
                <Text style={styles.chipText}>{tag}</Text>
              </View>
            ))}
          </View>
          <Pressable
            onPress={handleReset}
            style={({ pressed }) => [styles.resetButton, pressed && styles.resetButtonPressed]}
          >
            <Text style={styles.resetButtonText}>Zurücksetzen ✕</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontFamily: fonts.bodyMedium,
    color: '#333',
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
  inputDisabled: {
    backgroundColor: '#f0f0f0',
    color: '#aaa',
  },
  suggestions: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  suggestionItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  suggestionItemLast: {
    borderBottomWidth: 0,
  },
  suggestionItemPressed: {
    backgroundColor: colors.primaryLight,
  },
  suggestionText: {
    fontSize: 14,
    fontFamily: fonts.body,
    color: colors.text,
  },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    flex: 1,
    gap: 6,
  },
  chip: {
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: {
    fontSize: 12,
    fontFamily: fonts.bodyMedium,
    color: colors.primaryDark,
  },
  resetButton: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  resetButtonPressed: {
    opacity: 0.6,
  },
  resetButtonText: {
    fontSize: 12,
    fontFamily: fonts.bodyMedium,
    color: colors.primaryDark,
  },
});

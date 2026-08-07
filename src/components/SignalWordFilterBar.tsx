import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';

interface SignalWordFilterBarProps {
  words: string[];
  onChangeWords: (words: string[]) => void;
}

// Mirrors TagFilterBar's look (text input + chips + Zurücksetzen), but the
// words here are free-text signal words the admin types (e.g. "produkt",
// "chips") rather than suggestions drawn from existing data — a URL matches
// if it contains any one of the entered words.
export default function SignalWordFilterBar({ words, onChangeWords }: SignalWordFilterBarProps) {
  const [query, setQuery] = useState('');

  const handleAdd = () => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed || words.includes(trimmed)) {
      setQuery('');
      return;
    }
    onChangeWords([...words, trimmed]);
    setQuery('');
  };

  const handleRemove = (word: string) => {
    onChangeWords(words.filter((current) => current !== word));
  };

  const handleReset = () => {
    onChangeWords([]);
    setQuery('');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Nach Signalwörtern filtern</Text>
      <TextInput
        style={styles.input}
        placeholder="Suchbegriff eingeben und Enter drücken…"
        placeholderTextColor="#999"
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={handleAdd}
        returnKeyType="done"
        autoCapitalize="none"
        autoCorrect={false}
      />
      {words.length > 0 ? (
        <View style={styles.selectedRow}>
          <View style={styles.chipsWrap}>
            {words.map((word) => (
              <Pressable
                key={word}
                onPress={() => handleRemove(word)}
                style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
              >
                <Text style={styles.chipText}>{word} ✕</Text>
              </Pressable>
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
  chipPressed: {
    opacity: 0.6,
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

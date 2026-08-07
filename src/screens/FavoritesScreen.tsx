import { StyleSheet, Text, View } from 'react-native';
import { fonts } from '../theme/fonts';

export default function FavoritesScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Noch keine Favoriten.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 16,
    fontFamily: fonts.body,
    color: '#666',
  },
});

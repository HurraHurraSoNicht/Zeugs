import { Image, StyleSheet, View } from 'react-native';

// Height the embedded image is scaled to — width always fills its column,
// resizeMode="contain" keeps the image's own aspect ratio inside that box
// instead of stretching/distorting it, regardless of the source photo's
// original dimensions.
const EMBEDDED_IMAGE_HEIGHT = 160;

const styles = StyleSheet.create({
  textColumn: {
    flex: 1.4,
    paddingRight: 12,
    justifyContent: 'center',
  },
  imageColumn: {
    flex: 1,
    justifyContent: 'center',
  },
  embeddedImage: {
    width: '100%',
    height: EMBEDDED_IMAGE_HEIGHT,
    borderRadius: 8,
  },
});

// Custom render rules for react-native-markdown-display (see
// ArticleDetailScreen.tsx). The article editor's "Bild einfügen" toolbar
// button (ArticleEditForm.tsx) writes a 2-column GFM table — left cell is
// the text, right cell is the image — purely as a layout mechanism, not
// real tabular data. These rules render that invisibly: no header, and the
// two columns get distinct proportions/alignment instead of the library's
// default equal-width table cells.
export const markdownRules = {
  thead: () => null,
  td: (node: any, children: React.ReactNode) => {
    const isImageColumn = node.index === 1;
    return (
      <View key={node.key} style={isImageColumn ? styles.imageColumn : styles.textColumn}>
        {children}
      </View>
    );
  },
  image: (node: any) => {
    const { src, alt } = node.attributes ?? {};
    if (!src) {
      return null;
    }
    return (
      <Image
        key={node.key}
        source={{ uri: src }}
        accessibilityLabel={alt}
        resizeMode="contain"
        style={styles.embeddedImage}
      />
    );
  },
};

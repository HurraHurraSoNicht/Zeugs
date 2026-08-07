import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';

export interface BreadcrumbItem {
  label: string;
  onPress?: () => void;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export default function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <View style={styles.container}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <View key={`${item.label}-${index}`} style={styles.itemWrapper}>
            {item.onPress ? (
              <Pressable onPress={item.onPress} hitSlop={8}>
                <Text style={styles.link}>{item.label}</Text>
              </Pressable>
            ) : (
              <Text style={[styles.label, isLast && styles.current]} numberOfLines={1}>
                {item.label}
              </Text>
            )}
            {!isLast && <Text style={styles.separator}>›</Text>}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: colors.background,
  },
  itemWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '100%',
  },
  link: {
    fontSize: 13,
    fontFamily: fonts.bodyMedium,
    color: colors.primaryDark,
  },
  label: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: '#666',
  },
  current: {
    color: colors.text,
    fontFamily: fonts.bodyMedium,
  },
  separator: {
    fontSize: 13,
    color: '#999',
    marginHorizontal: 6,
  },
});

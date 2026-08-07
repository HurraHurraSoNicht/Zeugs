import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

export type TabParamList = {
  Home: undefined;
  Discover: { categoryId?: string; searchQuery?: string } | undefined;
  Favorites: undefined;
  SnackEZine: undefined;
  Profile: undefined;
  Admin: undefined;
  // Not "real" tabs — pushed via navigate() with tabBarButton: () => null
  // (see App.tsx) so they live inside the Tab.Navigator and the bottom bar
  // stays visible on top of them, instead of covering the whole screen like
  // a root-stack screen would.
  ProductDetail: { productId: string };
  ArticleDetail: { articleId: string };
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList>;
  // Only ever mounted while signed out — see App.tsx, which swaps the whole
  // Stack.Navigator's screen set based on auth state.
  Login: undefined;
  Register: undefined;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

export type TabScreenProps<T extends keyof TabParamList> = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}

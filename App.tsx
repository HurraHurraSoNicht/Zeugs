import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold } from '@expo-google-fonts/nunito';
import { Fredoka_700Bold } from '@expo-google-fonts/fredoka';
import { ActivityIndicator, Text, View } from 'react-native';

import HomeScreen from './src/screens/HomeScreen';
import DiscoverScreen from './src/screens/DiscoverScreen';
// Favorites tab temporarily disabled — see the commented-out Tab.Screen
// below. Screen and route type are left in place to re-enable later.
// import FavoritesScreen from './src/screens/FavoritesScreen';
import SnackEZineScreen from './src/screens/SnackEZineScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import AdminScreen from './src/screens/AdminScreen';
import ProductDetailScreen from './src/screens/ProductDetailScreen';
import ArticleDetailScreen from './src/screens/ArticleDetailScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import { ProductsProvider } from './src/hooks/useProducts';
import { ArticlesProvider } from './src/hooks/useArticles';
import { AuthProvider, useAuth } from './src/hooks/useAuth';
import { colors } from './src/theme/colors';
import { fonts } from './src/theme/fonts';
import type { RootStackParamList, TabParamList } from './src/types/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const TAB_ICONS: Record<keyof TabParamList, string> = {
  Home: '🏠',
  Discover: '🔍',
  Favorites: '⭐',
  SnackEZine: '📰',
  Profile: '👤',
  Admin: '🛠️',
  ProductDetail: '',
  ArticleDetail: '',
};

function Tabs() {
  const { isAdmin } = useAuth();

  return (
    <Tab.Navigator
      // Default backBehavior is 'firstRoute' (always Home) — 'history' makes
      // ProductDetail's back button return to whichever tab it was opened
      // from instead.
      backBehavior="history"
      screenOptions={({ route }) => ({
        tabBarIcon: () => <Text>{TAB_ICONS[route.name]}</Text>,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontFamily: fonts.bodyMedium, fontSize: 11 },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Startseite', headerShown: false }} />
      <Tab.Screen name="Discover" component={DiscoverScreen} options={{ title: 'Entdecken', headerShown: false }} />
      {/* Temporarily removed from navigation — needed again later.
      <Tab.Screen name="Favorites" component={FavoritesScreen} options={{ title: 'Favoriten' }} />
      */}
      <Tab.Screen name="SnackEZine" component={SnackEZineScreen} options={{ title: 'Snack-e-zine', headerShown: false }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profil' }} />
      {isAdmin ? (
        <Tab.Screen name="Admin" component={AdminScreen} options={{ title: 'Admin', headerShown: false }} />
      ) : null}
      {/* Reachable only via navigate() from a product card / article teaser —
          kept out of the tab bar itself (tabBarButton: () => null) so the
          bar stays visible instead of disappearing like it would as a
          root-stack screen. */}
      <Tab.Screen
        name="ProductDetail"
        component={ProductDetailScreen}
        options={{ headerShown: false, tabBarButton: () => null }}
      />
      <Tab.Screen
        name="ArticleDetail"
        component={ArticleDetailScreen}
        options={{ headerShown: false, tabBarButton: () => null }}
      />
    </Tab.Navigator>
  );
}

// Swaps the entire root screen set based on auth state — signed out shows
// only Login/Register, signed in shows only Tabs. React Navigation resets
// to the new set automatically the moment `session` flips (see useAuth.tsx),
// so no manual navigation call is needed after a successful login/signup.
function RootNavigator() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {session ? (
        <Stack.Screen name="Tabs" component={Tabs} />
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Fredoka_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <AuthProvider>
      <ProductsProvider>
        <ArticlesProvider>
          <NavigationContainer>
            <StatusBar style="auto" />
            <RootNavigator />
          </NavigationContainer>
        </ArticlesProvider>
      </ProductsProvider>
    </AuthProvider>
  );
}

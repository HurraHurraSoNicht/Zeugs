import { useState } from 'react';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { uploadProfileImage } from '../services/profileImagesApi';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';

// First steps of the profile page, built incrementally ("Stück für Stück") —
// input fields + avatar upload with local state for now. No Supabase
// persistence for the form fields yet: the app has no login/auth flow, so
// there's no user to attach this data to until that's decided (see the
// profiles table in supabase/migrations/0001_init.sql, which expects an
// auth.users row). The avatar upload itself already goes to Supabase
// Storage (a public bucket, same as product/article images) since that part
// doesn't depend on having a logged-in user.
const MAX_AVATAR_DIMENSION = 300;

interface ProfileFormState {
  avatarUrl: string | null;
  accountName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  birthDate: string;
}

const EMPTY_PROFILE: ProfileFormState = {
  avatarUrl: null,
  accountName: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  birthDate: '',
};

export default function ProfileScreen() {
  const { signOut } = useAuth();
  const [profile, setProfile] = useState<ProfileFormState>(EMPTY_PROFILE);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  const handleLogout = async () => {
    setLoggingOut(true);
    setLogoutError(null);
    try {
      await signOut();
      // No further navigation needed — App.tsx swaps to the Login screen
      // automatically as soon as AuthProvider's session state clears.
    } catch (err) {
      setLogoutError(err instanceof Error ? err.message : 'Abmelden fehlgeschlagen.');
      setLoggingOut(false);
    }
  };

  const updateField = <K extends keyof ProfileFormState>(key: K, value: ProfileFormState[K]) => {
    setProfile((current) => ({ ...current, [key]: value }));
  };

  const handlePickAvatar = async () => {
    setAvatarError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setAvatarError('Zugriff auf Fotos/Bilder wurde nicht erlaubt.');
      return;
    }
    setUploadingAvatar(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
      });
      if (result.canceled || !result.assets?.[0]) {
        return;
      }
      const asset = result.assets[0];

      // Downscale to at most 300x300 (aspect ratio preserved) before
      // uploading. resize() only needs the longer side pinned to 300 — the
      // other side is derived automatically to keep the ratio. The unset
      // side must be omitted entirely, not passed as `null`: the web
      // implementation (expo-image-manipulator's ResizeAction.web.ts) only
      // treats an actually-`undefined` key as "not specified" — `null`
      // rounds to 0 there and breaks the canvas resize.
      const context = ImageManipulator.manipulate(asset.uri);
      const { width, height } = asset;
      if (width > MAX_AVATAR_DIMENSION || height > MAX_AVATAR_DIMENSION) {
        context.resize(width >= height ? { width: MAX_AVATAR_DIMENSION } : { height: MAX_AVATAR_DIMENSION });
      }
      const rendered = await context.renderAsync();
      const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.85, base64: true });

      if (!saved.base64) {
        setAvatarError('Bild konnte nicht verarbeitet werden.');
        return;
      }

      const avatarUrl = await uploadProfileImage(saved.base64, 'image/jpeg');
      updateField('avatarUrl', avatarUrl);
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : 'Bild konnte nicht hochgeladen werden.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Profil</Text>

      <View style={styles.form}>
        <View style={styles.avatarRow}>
          {profile.avatarUrl ? (
            <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarPlaceholderText}>👤</Text>
            </View>
          )}
          <Pressable
            onPress={handlePickAvatar}
            disabled={uploadingAvatar}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && !uploadingAvatar && styles.secondaryButtonPressed,
            ]}
          >
            {uploadingAvatar ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={styles.secondaryButtonText}>Profilbild hochladen</Text>
            )}
          </Pressable>
        </View>
        {avatarError ? <Text style={styles.errorText}>{avatarError}</Text> : null}

        <Text style={styles.label}>Kontoname</Text>
        <TextInput
          style={styles.input}
          placeholder="maxmustermann"
          placeholderTextColor="#999"
          value={profile.accountName}
          onChangeText={(text) => updateField('accountName', text)}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={styles.label}>Vorname</Text>
        <TextInput
          style={styles.input}
          placeholder="Max"
          placeholderTextColor="#999"
          value={profile.firstName}
          onChangeText={(text) => updateField('firstName', text)}
        />

        <Text style={styles.label}>Nachname</Text>
        <TextInput
          style={styles.input}
          placeholder="Mustermann"
          placeholderTextColor="#999"
          value={profile.lastName}
          onChangeText={(text) => updateField('lastName', text)}
        />

        <Text style={styles.label}>E-Mail-Adresse</Text>
        <TextInput
          style={styles.input}
          placeholder="max.mustermann@beispiel.de"
          placeholderTextColor="#999"
          value={profile.email}
          onChangeText={(text) => updateField('email', text)}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={styles.label}>Handynummer</Text>
        <TextInput
          style={styles.input}
          placeholder="+49 151 12345678"
          placeholderTextColor="#999"
          value={profile.phone}
          onChangeText={(text) => updateField('phone', text)}
          keyboardType="phone-pad"
        />

        <Text style={styles.label}>Geburtsdatum</Text>
        <TextInput
          style={styles.input}
          placeholder="TT.MM.JJJJ"
          placeholderTextColor="#999"
          value={profile.birthDate}
          onChangeText={(text) => updateField('birthDate', text)}
        />
      </View>

      <View style={styles.logoutRow}>
        {logoutError ? <Text style={styles.errorText}>{logoutError}</Text> : null}
        <Pressable
          onPress={handleLogout}
          disabled={loggingOut}
          style={({ pressed }) => [
            styles.logoutButton,
            pressed && !loggingOut && styles.logoutButtonPressed,
          ]}
        >
          {loggingOut ? (
            <ActivityIndicator color={colors.danger} />
          ) : (
            <Text style={styles.logoutButtonText}>Abmelden</Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: 32,
  },
  header: {
    fontSize: 24,
    fontFamily: fonts.heading,
    color: colors.text,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 16,
  },
  form: {
    marginHorizontal: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
  },
  avatarRow: {
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  avatarPlaceholder: {
    backgroundColor: '#e5e5e5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholderText: {
    fontSize: 40,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
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
    marginTop: 8,
    textAlign: 'center',
    fontSize: 12,
    fontFamily: fonts.body,
    color: colors.danger,
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
  logoutRow: {
    alignItems: 'flex-end',
    marginHorizontal: 16,
    marginTop: 16,
  },
  logoutButton: {
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutButtonPressed: {
    opacity: 0.6,
  },
  logoutButtonText: {
    color: colors.danger,
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
  },
});

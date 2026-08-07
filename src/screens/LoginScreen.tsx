import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import TurnstileWidget from '../components/TurnstileWidget';
import { useAuth } from '../hooks/useAuth';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import type { RootStackScreenProps } from '../types/navigation';
import logoImage from '../../images/snakkerslogo.png';

type Props = RootStackScreenProps<'Login'>;

// Empty when no Turnstile site has been set up yet (see .env.example) —
// the widget and the "please complete the captcha" check are both skipped
// in that case, so local dev keeps working before Cloudflare is configured.
const TURNSTILE_SITE_KEY = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY ?? '';

export default function LoginScreen({ navigation }: Props) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaError, setCaptchaError] = useState<string | null>(null);
  // Turnstile tokens are single-use — bumping this remounts the widget
  // (via its `key` below) to force a fresh challenge after a failed attempt,
  // rather than building an imperative reset API into TurnstileWidget.
  const [captchaResetSignal, setCaptchaResetSignal] = useState(0);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('Bitte E-Mail-Adresse und Passwort eingeben.');
      return;
    }
    if (TURNSTILE_SITE_KEY && !captchaToken) {
      setError('Bitte bestätige das Captcha.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await signIn(email.trim(), password, captchaToken ?? undefined);
      // No further navigation needed — App.tsx swaps to the Tabs screen set
      // as soon as AuthProvider's session state updates.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login fehlgeschlagen.');
      setCaptchaToken(null);
      setCaptchaResetSignal((current) => current + 1);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenImpressum = () => {
    if (Platform.OS === 'web') {
      window.open(`${window.location.origin}/impressum.html`, '_blank');
    } else {
      Linking.openURL('https://www.snakkers.de/impressum.html');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.logoWrap}>
          <Image source={logoImage} style={styles.logo} resizeMode="contain" />
        </View>

        <Text style={styles.welcomeText}>
          Willkommen bei Snakkers, deiner Lieblings-App für brandneue Foodprodukte. Jetzt noch schnell einloggen –
          dann kann es losgehen.
        </Text>

        <View style={styles.form}>
          <Text style={styles.label}>E-Mail</Text>
          <TextInput
            style={styles.input}
            placeholder="max.mustermann@beispiel.de"
            placeholderTextColor="#999"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setError(null);
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Passwort</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor="#999"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              setError(null);
            }}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />

          {TURNSTILE_SITE_KEY ? (
            <View style={styles.captchaWrap}>
              <TurnstileWidget
                key={captchaResetSignal}
                siteKey={TURNSTILE_SITE_KEY}
                onVerify={setCaptchaToken}
                onError={setCaptchaError}
              />
              {captchaError ? <Text style={styles.errorText}>{captchaError}</Text> : null}
            </View>
          ) : null}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable
            onPress={handleLogin}
            disabled={loading}
            style={({ pressed }) => [
              styles.button,
              loading && styles.buttonDisabled,
              pressed && !loading && styles.buttonPressed,
            ]}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Einloggen</Text>}
          </Pressable>
        </View>

        <Pressable onPress={() => navigation.navigate('Register')} style={styles.registerLink}>
          <Text style={styles.registerLinkText}>Du hast noch keinen Account?</Text>
          <Text style={styles.registerLinkTextBold}>
            Jetzt turboschnell, kostenfrei und easy registrieren!
          </Text>
        </Pressable>

        <Pressable onPress={handleOpenImpressum} style={styles.impressumLink}>
          <Text style={styles.impressumLinkText}>Impressum</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  logoWrap: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logo: {
    width: 220,
    height: 220 / 1.5,
    borderRadius: 16,
  },
  welcomeText: {
    textAlign: 'center',
    fontSize: 14,
    fontFamily: fonts.body,
    color: colors.textMuted,
    marginBottom: 24,
    lineHeight: 20,
  },
  form: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
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
  captchaWrap: {
    marginTop: 12,
    alignItems: 'center',
  },
  errorText: {
    marginTop: 10,
    fontSize: 12,
    fontFamily: fonts.body,
    color: colors.danger,
  },
  button: {
    marginTop: 16,
    backgroundColor: colors.cta,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonDisabled: {
    backgroundColor: '#f3c299',
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: fonts.bodyMedium,
  },
  registerLink: {
    marginTop: 24,
    alignItems: 'center',
  },
  registerLinkText: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: colors.textMuted,
  },
  registerLinkTextBold: {
    marginTop: 4,
    fontSize: 14,
    fontFamily: fonts.bodyBold,
    color: colors.primary,
    textAlign: 'center',
  },
  impressumLink: {
    marginTop: 16,
    alignItems: 'center',
  },
  impressumLinkText: {
    fontSize: 12,
    fontFamily: fonts.body,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
});

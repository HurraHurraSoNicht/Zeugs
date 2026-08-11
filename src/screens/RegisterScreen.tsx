import { useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import TurnstileWidget from '../components/TurnstileWidget';
import { useAuth } from '../hooks/useAuth';
import { useAutomationSettings } from '../hooks/useAutomationSettings';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import type { RootStackScreenProps } from '../types/navigation';
import logoImage from '../../images/snakkerslogo.png';

type Props = RootStackScreenProps<'Register'>;

// Empty when no Turnstile site has been set up yet (see .env.example) —
// the widget and the "please complete the captcha" check are both skipped
// in that case, so local dev keeps working before Cloudflare is configured.
const TURNSTILE_SITE_KEY = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY ?? '';

export default function RegisterScreen({ navigation }: Props) {
  const { signUp } = useAuth();
  const { settings: automationSettings, loading: automationSettingsLoading } = useAutomationSettings();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaError, setCaptchaError] = useState<string | null>(null);
  // Turnstile tokens are single-use — bumping this remounts the widget
  // (via its `key` below) to force a fresh challenge after a failed attempt,
  // rather than building an imperative reset API into TurnstileWidget.
  const [captchaResetSignal, setCaptchaResetSignal] = useState(0);

  const handleRegister = async () => {
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
      const { confirmationRequired } = await signUp(email.trim(), password, captchaToken ?? undefined);
      if (confirmationRequired) {
        setConfirmationEmail(email.trim());
      }
      // If confirmation isn't required, Supabase already returned a session
      // — AuthProvider picks that up and App.tsx swaps to the Tabs screens.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registrierung fehlgeschlagen.');
      setCaptchaToken(null);
      setCaptchaResetSignal((current) => current + 1);
    } finally {
      setLoading(false);
    }
  };

  if (automationSettingsLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (automationSettings && !automationSettings.registrationEnabled) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <View style={styles.logoWrap}>
            <Image source={logoImage} style={styles.logo} resizeMode="contain" />
          </View>
          <Text style={styles.confirmTitle}>Wartungsmodus</Text>
          <Text style={styles.welcomeText}>
            Eine Registrierung ist im Moment nicht möglich, Snakkers ist im Wartungsmodus.
          </Text>
          <Pressable onPress={() => navigation.navigate('Login')} style={styles.registerLink}>
            <Text style={styles.registerLinkText}>Du hast schon einen Account?</Text>
            <Text style={styles.registerLinkTextBold}>Jetzt einloggen</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (confirmationEmail) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <View style={styles.logoWrap}>
            <Image source={logoImage} style={styles.logo} resizeMode="contain" />
          </View>
          <Text style={styles.confirmTitle}>Fast geschafft! 🎉</Text>
          <Text style={styles.welcomeText}>
            Wir haben dir eine Bestätigungsmail an {confirmationEmail} geschickt. Bitte klicke auf den Link darin —
            danach kannst du dich einloggen.
          </Text>
          <Pressable
            onPress={() => navigation.navigate('Login')}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          >
            <Text style={styles.buttonText}>Zurück zum Login</Text>
          </Pressable>
        </View>
      </View>
    );
  }

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
          Turboschnell, kostenfrei und easy registrieren — und schon kannst du brandneue Foodprodukte entdecken.
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
            onPress={handleRegister}
            disabled={loading}
            style={({ pressed }) => [
              styles.button,
              loading && styles.buttonDisabled,
              pressed && !loading && styles.buttonPressed,
            ]}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Registrieren</Text>}
          </Pressable>
        </View>

        <Pressable onPress={() => navigation.navigate('Login')} style={styles.registerLink}>
          <Text style={styles.registerLinkText}>Du hast schon einen Account?</Text>
          <Text style={styles.registerLinkTextBold}>Jetzt einloggen</Text>
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
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
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
  confirmTitle: {
    textAlign: 'center',
    fontSize: 20,
    fontFamily: fonts.heading,
    color: colors.text,
    marginBottom: 12,
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
});

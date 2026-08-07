export interface TurnstileWidgetProps {
  siteKey: string;
  onVerify: (token: string) => void;
  onError?: (message: string) => void;
}

// Native (iOS/Android) fallback — Turnstile is a web widget with no
// first-party React Native renderer. Captcha protection on Register is
// web-only for now (see RegisterScreen.tsx, which skips requiring a token
// when this renders instead of TurnstileWidget.web.tsx's real widget).
export default function TurnstileWidget(_props: TurnstileWidgetProps) {
  return null;
}

import { Alert as RNAlert, Platform } from 'react-native';

type AlertButton = {
  text?: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

// RN's Alert.alert has no UI at all on react-native-web (it's a no-op stub) — this
// reimplements it with window.alert/confirm so every Alert.alert call in the app
// (errors, success messages, delete/sign-out confirmations) still does something on web.
function webAlert(title: string, message?: string, buttons?: AlertButton[]) {
  const text = [title, message].filter(Boolean).join('\n\n');

  if (!buttons || buttons.length <= 1) {
    window.alert(text);
    buttons?.[0]?.onPress?.();
    return;
  }

  const confirmed = window.confirm(text);
  const target = confirmed
    ? buttons.find((b) => b.style !== 'cancel')
    : buttons.find((b) => b.style === 'cancel');
  target?.onPress?.();
}

export const Alert = {
  alert: Platform.OS === 'web' ? webAlert : RNAlert.alert,
};

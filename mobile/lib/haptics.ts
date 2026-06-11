import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/** Feedback tátil curto ao pressionar e segurar (long press) num cartão. */
export function hapticLongPress(): void {
  if (Platform.OS === 'web') {
    return;
  }
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
    /* dispositivo sem motor ou permissão */
  });
}

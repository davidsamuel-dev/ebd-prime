import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const PROMPTED_KEY = 'ebd_notif_permission_prompted_v1';

export type NotificationPermissionStatus = 'undetermined' | 'granted' | 'denied';

export type NotificationPermissionResult = {
  status: NotificationPermissionStatus;
  canAskAgain: boolean;
};

/** Push remoto e registo de token não funcionam no Expo Go (SDK 53+). */
export function isPushAvailableInThisBuild(): boolean {
  if (Platform.OS === 'web') {
    return false;
  }
  return Constants.appOwnership !== 'expo';
}

/** Já mostrámos o pedido de permissão (após onboarding). */
export async function wasNotificationPermissionPrompted(): Promise<boolean> {
  try {
    const v = await SecureStore.getItemAsync(PROMPTED_KEY);
    return v === '1';
  } catch {
    return false;
  }
}

async function markNotificationPermissionPrompted(): Promise<void> {
  try {
    await SecureStore.setItemAsync(PROMPTED_KEY, '1');
  } catch {
    /* ignore */
  }
}

type NotificationsModule = typeof import('expo-notifications');

async function loadNotificationsModule(): Promise<NotificationsModule | null> {
  if (!isPushAvailableInThisBuild()) {
    return null;
  }
  try {
    return await import('expo-notifications');
  } catch {
    return null;
  }
}

async function ensureAndroidChannel(Notifications: NotificationsModule): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }
  await Notifications.setNotificationChannelAsync('default', {
    name: 'EBD Prime',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#0078D4',
  });
}

/**
 * Abre o diálogo nativo de permissão (iOS/Android), típico após o primeiro cadastro.
 * No Expo Go retorna `null` (use development build para testar push).
 */
export async function requestNotificationPermissionAfterOnboarding(): Promise<NotificationPermissionResult | null> {
  if (!isPushAvailableInThisBuild()) {
    return null;
  }

  const Notifications = await loadNotificationsModule();
  if (Notifications == null) {
    return null;
  }

  await ensureAndroidChannel(Notifications);

  const existing = await Notifications.getPermissionsAsync();
  if (existing.status === 'granted') {
    await markNotificationPermissionPrompted();
    return { status: existing.status, canAskAgain: false };
  }

  const alreadyPrompted = await wasNotificationPermissionPrompted();
  if (alreadyPrompted && existing.canAskAgain === false) {
    return {
      status: existing.status,
      canAskAgain: false,
    };
  }

  const result = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
  });

  await markNotificationPermissionPrompted();

  return {
    status: result.status,
    canAskAgain: result.canAskAgain ?? true,
  };
}

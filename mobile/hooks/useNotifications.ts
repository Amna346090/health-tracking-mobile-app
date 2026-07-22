import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { registerPushToken } from '../api/notifications';

// Configure how incoming notifications are presented while the app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  false,
  }),
});

export function useNotifications(isLoggedIn: boolean): void {
  const router = useRouter();
  const responseListenerRef = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    if (!isLoggedIn) return;

    (async () => {
      try {
        // Android requires a notification channel
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name:              'default',
            importance:        Notifications.AndroidImportance.MAX,
            vibrationPattern:  [0, 250, 250, 250],
            lightColor:        '#6366F1',
          });
        }

        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') return;

        // getExpoPushTokenAsync requires a projectId in standalone builds;
        // in Expo Go it resolves automatically.
        const { data: token } = await Notifications.getExpoPushTokenAsync();
        await registerPushToken(token);
      } catch {
        // Non-fatal — push notifications are optional
      }
    })();

    // Deep-link: tap on notification → open the relevant detail screen
    responseListenerRef.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as Record<string, unknown>;
        if (typeof data.assignmentId === 'number') {
          router.push(`/assignment/${data.assignmentId}`);
        } else if (typeof data.messageId === 'number' && typeof data.patientId === 'number') {
          router.push(`/messages/${data.patientId}`);
        } else if (typeof data.appointmentId === 'number' && typeof data.patientId === 'number') {
          router.push(`/appointments/${data.patientId}`);
        } else if (typeof data.testRequestId === 'number' && typeof data.patientId === 'number') {
          router.push(`/test-requests/${data.patientId}`);
        } else if (data.type === 'TOUCH_BASE_DUE' && typeof data.patientId === 'number') {
          router.push(`/patient-dashboard/${data.patientId}`);
        }
      },
    );

    return () => {
      if (responseListenerRef.current) {
        Notifications.removeNotificationSubscription(responseListenerRef.current);
        responseListenerRef.current = null;
      }
    };
  }, [isLoggedIn]);
}

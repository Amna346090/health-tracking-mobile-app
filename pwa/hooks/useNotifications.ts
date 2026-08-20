import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { registerPushToken } from '../api/notifications';
import { emitPushEvent } from '../lib/pushEvents';

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
  const receivedListenerRef = useRef<Notifications.Subscription | null>(null);

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

        // getExpoPushTokenAsync requires an explicit projectId outside of Expo Go
        // (standalone/EAS builds don't infer it automatically).
        const projectId =
          Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
        const { data: token } = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined,
        );
        await registerPushToken(token);
      } catch (e) {
        // Non-fatal — push notifications are optional, but log for diagnosability
        console.warn('[push] failed to register for push notifications:', e);
      }
    })();

    // Live refresh: notification arrives while the app is open → tell whichever
    // screen cares, so it can quietly refetch instead of showing stale data.
    receivedListenerRef.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        const data = notification.request.content.data as Record<string, unknown>;
        if (typeof data.messageId === 'number' && typeof data.patientId === 'number') {
          emitPushEvent(`message:${data.patientId}`);
        }
        if (typeof data.appointmentId === 'number' && typeof data.patientId === 'number') {
          emitPushEvent(`appointments:${data.patientId}`);
        }
        if (typeof data.testRequestId === 'number' && typeof data.patientId === 'number') {
          emitPushEvent(`testRequests:${data.patientId}`);
        }
        // Every push to staff/admin also has a matching row in the in-app Notification
        // list and drives the bell badge — refresh both whenever any push lands.
        emitPushEvent('notification');
      },
    );

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
      if (receivedListenerRef.current) {
        Notifications.removeNotificationSubscription(receivedListenerRef.current);
        receivedListenerRef.current = null;
      }
    };
  }, [isLoggedIn]);
}

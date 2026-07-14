type ExpoPushMessage = import('expo-server-sdk').ExpoPushMessage;

let expoPromise: Promise<InstanceType<(typeof import('expo-server-sdk'))['default']>> | null = null;

async function getExpo() {
  if (!expoPromise) {
    expoPromise = import('expo-server-sdk').then(({ default: Expo }) => new Expo());
  }
  return expoPromise;
}

export async function sendPushNotification(
  token: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  const { default: Expo } = await import('expo-server-sdk');
  const expo = await getExpo();

  if (!Expo.isExpoPushToken(token)) {
    throw new Error(`Not a valid Expo push token: ${token}`);
  }

  const messages: ExpoPushMessage[] = [{ to: token, title, body, data, sound: 'default' }];
  const chunks = expo.chunkPushNotifications(messages);

  for (const chunk of chunks) {
    const receipts = await expo.sendPushNotificationsAsync(chunk);
    for (const receipt of receipts) {
      if (receipt.status === 'error') {
        throw new Error(receipt.message ?? 'Expo push error');
      }
    }
  }
}

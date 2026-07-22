import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../context/auth';
import { LoadingScreen } from '../components/LoadingScreen';
import { useNotifications } from '../hooks/useNotifications';
import { colors } from '../theme';

function NavigationGuard() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useNotifications(!!user);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (user && (inAuthGroup || segments[0] === undefined)) {
      router.replace('/(tabs)');
    }
  }, [user, segments, isLoading]);

  if (isLoading) return <LoadingScreen />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      {/* Assignment detail — slides over tabs (patient) */}
      <Stack.Screen name="assignment/[id]" options={{ animation: 'slide_from_right' }} />
      {/* Medication catalog screens — slides over tabs (staff) */}
      <Stack.Screen name="medication/[id]" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="medication/add" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="medication/assign" options={{ animation: 'slide_from_bottom' }} />
      {/* Staff: patient health log detail */}
      <Stack.Screen name="health-log/[patientId]" options={{ animation: 'slide_from_right' }} />
      {/* Photo viewer (full-screen black bg) */}
      <Stack.Screen name="photo/[id]" options={{ animation: 'fade', presentation: 'fullScreenModal' }} />
      {/* Full photo gallery */}
      <Stack.Screen name="photos/[patientId]" options={{ animation: 'slide_from_right' }} />
      {/* Activity timeline */}
      <Stack.Screen name="history/[patientId]" options={{ animation: 'slide_from_right' }} />
      {/* Staff CRM patient view */}
      <Stack.Screen name="patient-dashboard/[patientId]" options={{ animation: 'slide_from_right' }} />
      {/* Appointments — patient request/reschedule, staff read-only */}
      <Stack.Screen name="appointments/[patientId]" options={{ animation: 'slide_from_right' }} />
      {/* Messages inbox */}
      <Stack.Screen name="messages/[patientId]" options={{ animation: 'slide_from_right' }} />
      {/* Document uploads */}
      <Stack.Screen name="documents/[patientId]" options={{ animation: 'slide_from_right' }} />
      {/* Test/scan requests */}
      <Stack.Screen name="test-requests/[patientId]" options={{ animation: 'slide_from_right' }} />
      {/* Health metrics (cholesterol, lipid profile, etc.) */}
      <Stack.Screen name="health-metrics/[patientId]" options={{ animation: 'slide_from_right' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationGuard />
        <StatusBar style="auto" backgroundColor={colors.bg.app} />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

import { LoadingScreen } from '../components/LoadingScreen';

// Serves as the initial entry point. NavigationGuard in _layout.tsx handles
// redirecting to (auth)/login or (tabs) once auth state resolves.
export default function Index() {
  return <LoadingScreen />;
}

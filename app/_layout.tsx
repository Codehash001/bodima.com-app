import { supabase } from '@/lib/supabase';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { router, Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/useColorScheme';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const pathname = usePathname();

  useEffect(() => {
    const run = async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      // If user is logged in and on welcome/auth, send based on role
      if (session && (pathname === '/' || pathname?.startsWith('/auth'))) {
        const role = (session.user.app_metadata as any)?.role;
        if (role === 'owner') router.replace({ pathname: '/(owner-tabs)' as any });
        else if (role) router.replace({ pathname: '/(tabs)' });
        else router.replace({ pathname: '/auth/select-role' });
      }
    };
    run();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // Only respond to explicit sign-in/out transitions
      if (event === 'SIGNED_IN') {
        // If coming from welcome/auth flows, route based on role
        if (pathname === '/' || pathname?.startsWith('/auth')) {
          const role = (session?.user.app_metadata as any)?.role;
          if (role === 'owner') router.replace({ pathname: '/(owner-tabs)' as any });
          else if (role) router.replace({ pathname: '/(tabs)' });
          else router.replace({ pathname: '/auth/select-role' });
        }
        return;
      }

      if (event === 'SIGNED_OUT') {
        // If currently in tabs, kick back to login
        if (pathname?.startsWith('/(tabs)') || pathname?.startsWith('/(owner-tabs)')) {
          router.replace({ pathname: '/auth/login' });
        }
        return;
      }

      // Ignore TOKEN_REFRESH / USER_UPDATED etc to avoid disrupting in-tab navigation
    });
    return () => { sub.subscription.unsubscribe(); };
  }, [pathname]);

  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider value={DefaultTheme}>
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="auth" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="(owner-tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="messages" options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" />
        </Stack>
        <StatusBar style="dark" />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

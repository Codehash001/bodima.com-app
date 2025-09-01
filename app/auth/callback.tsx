import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { useURL } from 'expo-linking';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';

export default function OAuthCallback() {
  const url = useURL();
  const [done, setDone] = useState(false);

  useEffect(() => {
    const run = async () => {
      if (!url || done) return;
      try {
        // Exchange the code in the deep link for a session
        const { data, error } = await supabase.auth.exchangeCodeForSession(url);
        if (error) throw error;

        // Fallback: sometimes session is not immediately present
        let session: Session | null = data.session;
        if (!session) {
          const { data: s } = await supabase.auth.getSession();
          session = s.session;
        }

        const role = (session?.user.app_metadata as any)?.role;
        if (role) router.replace({ pathname: '/(tabs)' });
        else router.replace({ pathname: '/auth/select-role' });
      } catch (e: any) {
        Alert.alert('OAuth error', e?.message || 'Failed to sign in');
        router.replace({ pathname: '/auth/login' });
      } finally {
        setDone(true);
      }
    };
    run();
  }, [url, done]);

  return (
    <View style={styles.center}> 
      <ActivityIndicator size="large" color="#16C784" />
      <Text style={{ marginTop: 8 }}>Completing sign-in…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
});

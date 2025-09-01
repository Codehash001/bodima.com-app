import { supabase } from '@/lib/supabase';
import { makeRedirectUri } from 'expo-auth-session';
import { Link, router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onLogin = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const role = (data.session?.user.app_metadata as any)?.role;
      if (role) router.replace('/(tabs)');
      else router.replace('/auth/select-role');
    } catch (e: any) {
      Alert.alert('Login failed', e.message || 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  const onGoogle = async () => {
    try {
      setLoading(true);
      const redirectTo = makeRedirectUri({ scheme: 'bodima', path: 'auth/callback' });
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: false },
      } as any);
      if (error) throw error;
      // The browser will open; session will be handled on return via listener in root layout
    } catch (e: any) {
      Alert.alert('Google sign-in failed', e.message || 'Try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Log in</Text>
      <TextInput
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
      />
      <TextInput
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={styles.input}
      />
      <Pressable disabled={loading} onPress={onLogin} style={[styles.btn, styles.btnPrimary, loading && { opacity: 0.6 }]}>
        <Text style={styles.btnPrimaryText}>{loading ? 'Please wait…' : 'Log in'}</Text>
      </Pressable>

      <Pressable disabled={loading} onPress={onGoogle} style={[styles.btn, styles.btnOutline]}>
        <Text style={styles.btnOutlineText}>Continue with Google</Text>
      </Pressable>

      <View style={{ height: 16 }} />
      <Link href={{ pathname: '/auth/signup' }}>Don't have an account? Sign up</Link>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 48,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  btn: { height: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  btnPrimary: { backgroundColor: '#16C784' },
  btnPrimaryText: { color: '#fff', fontWeight: '700' },
  btnOutline: { borderWidth: 1, borderColor: '#16C784' },
  btnOutlineText: { color: '#16C784', fontWeight: '700' },
});

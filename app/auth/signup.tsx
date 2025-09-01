import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { makeRedirectUri } from 'expo-auth-session';
import { Link, router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

WebBrowser.maybeCompleteAuthSession();

export default function SignupScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSignup = async () => {
    try {
      setLoading(true);
      if (!password || password.length < 6) {
        throw new Error('Password must be at least 6 characters');
      }
      if (password !== confirmPassword) {
        throw new Error('Passwords do not match');
      }
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) throw error;
      Alert.alert('Check your email', 'We sent you a verification code.');
      router.push({ pathname: '/auth/verify', params: { email } });
    } catch (e: any) {
      Alert.alert('Sign up failed', e.message || 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  const onGoogle = async () => {
    try {
      setLoading(true);
      const redirectTo = makeRedirectUri({ scheme: 'bodima', path: 'auth/callback' });
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: false },
      } as any);
      if (error) throw error;
    } catch (e: any) {
      Alert.alert('Google sign-in failed', e.message || 'Try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Create account</Text>
      <TextInput
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
      />
      <View style={styles.inputWrap}>
        <TextInput
          placeholder="Password"
          secureTextEntry={!showPassword}
          value={password}
          onChangeText={setPassword}
          style={[styles.input, { paddingRight: 44 }]}
        />
        <Pressable style={styles.eyeBtn} onPress={() => setShowPassword((s) => !s)}>
          <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color="#6b7280" />
        </Pressable>
      </View>
      <View style={styles.inputWrap}>
        <TextInput
          placeholder="Confirm password"
          secureTextEntry={!showConfirmPassword}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          style={[styles.input, { paddingRight: 44 }]}
        />
        <Pressable style={styles.eyeBtn} onPress={() => setShowConfirmPassword((s) => !s)}>
          <Ionicons name={showConfirmPassword ? 'eye-off' : 'eye'} size={20} color="#6b7280" />
        </Pressable>
      </View>
      <Pressable disabled={loading} onPress={onSignup} style={[styles.btn, styles.btnPrimary, loading && { opacity: 0.6 }]}>
        <Text style={styles.btnPrimaryText}>{loading ? 'Please wait…' : 'Sign up'}</Text>
      </Pressable>

      <Pressable disabled={loading} onPress={onGoogle} style={[styles.btn, styles.btnOutline]}>
        <Text style={styles.btnOutlineText}>Continue with Google</Text>
      </Pressable>

      <View style={{ height: 16 }} />
      <Link href={{ pathname: '/auth/login' }}>Already have an account? Log in</Link>
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
  inputWrap: { position: 'relative' },
  eyeBtn: { position: 'absolute', right: 12, top: 12, height: 24, width: 24, alignItems: 'center', justifyContent: 'center' },
  btn: { height: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  btnPrimary: { backgroundColor: '#16C784' },
  btnPrimaryText: { color: '#fff', fontWeight: '700' },
  btnOutline: { borderWidth: 1, borderColor: '#16C784' },
  btnOutlineText: { color: '#16C784', fontWeight: '700' },
});

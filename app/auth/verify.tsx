import { supabase } from '@/lib/supabase';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function VerifyScreen() {
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(emailParam || '');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const codeRef = useRef<TextInput>(null);

  const otpLength = 6; // adjust if your Supabase OTP length is different

  useEffect(() => {
    const t = setTimeout(() => codeRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, []);

  const onVerify = async () => {
    try {
      const emailTrimmed = email.trim();
      const codeTrimmed = code.trim();
      setErrorText(null);

      if (!emailTrimmed) {
        setErrorText('Enter your email');
        return;
      }
      if (codeTrimmed.length !== otpLength) {
        setErrorText(`Enter the ${otpLength}-digit code`);
        return;
      }

      setLoading(true);
      const { data, error } = await supabase.auth.verifyOtp({
        email: emailTrimmed,
        token: codeTrimmed,
        type: 'signup',
      });
      // Debug logs to Metro
      console.log('[verifyOtp] data:', JSON.stringify(data));
      if (error) {
        console.error('[verifyOtp] error:', error);
        throw error;
      }
      const role = data.session?.user.user_metadata?.role;
      // Reset loading before navigation to avoid stuck button label
      setLoading(false);
      // Navigate and stop executing
      if (role) {
        router.replace('/(tabs)');
        return;
      }
      router.replace('/auth/select-role');
      return;
    } catch (e: any) {
      const msg = e?.message || 'Please try again';
      setErrorText(msg);
      Alert.alert('Verification failed', msg);
    } finally {
      // Keep as safety in case we didn't already clear loading
      setLoading(false);
    }
  };

  const onResend = async () => {
    try {
      const emailTrimmed = email.trim();
      if (!emailTrimmed) {
        Alert.alert('Enter email', 'Please enter your email to resend the code.');
        return;
      }
      setResending(true);
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: emailTrimmed,
      });
      if (error) throw error;
      Alert.alert('Code sent', 'We have resent the verification code to your email.');
    } catch (e: any) {
      const msg = e?.message || 'Please try again';
      setErrorText(msg);
      Alert.alert('Could not resend', msg);
    } finally {
      setResending(false);
    }
  };

  const verifyDisabled = loading || code.trim().length !== otpLength || !email.trim();

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      keyboardVerticalOffset={Platform.select({ ios: 64, android: 0 })}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>Verify your email</Text>
        <TextInput
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            if (errorText) setErrorText(null);
          }}
          style={styles.input}
          returnKeyType="next"
        />
        <TextInput
          ref={codeRef}
          placeholder={`${otpLength}-digit code`}
          keyboardType="number-pad"
          inputMode="numeric"
          textContentType="oneTimeCode"
          selectTextOnFocus
          value={code}
          onChangeText={(v) => {
            setCode(v);
            if (errorText) setErrorText(null);
          }}
          style={styles.input}
          maxLength={otpLength}
          returnKeyType="done"
        />
        {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}
        <Pressable disabled={verifyDisabled} onPress={onVerify} style={[styles.btn, styles.btnPrimary, (verifyDisabled || loading) && { opacity: 0.6 }]}>
          <Text style={styles.btnPrimaryText}>{loading ? 'Verifying…' : 'Verify'}</Text>
        </Pressable>
        <View style={{ height: 8 }} />
        <Pressable disabled={resending} onPress={onResend} style={[styles.btn, styles.btnOutline, resending && { opacity: 0.6 }]}> 
          <Text style={styles.btnOutlineText}>{resending ? 'Resending…' : 'Resend code'}</Text>
        </Pressable>
      </SafeAreaView>
    </KeyboardAvoidingView>
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
  errorText: { color: '#EF4444', marginTop: 4, marginBottom: 4 },
});

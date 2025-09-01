import { setUserRole, supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SelectRoleScreen() {
  const [loading, setLoading] = useState<string | null>(null);

  const setRole = async (role: 'seeker' | 'owner') => {
    try {
      setLoading(role);
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error('Not authenticated');
      await setUserRole(role);
      router.replace(role === 'owner' ? '/(owner-tabs)' : '/(tabs)');
    } catch (e: any) {
      Alert.alert('Failed to set role', e.message || 'Try again');
    } finally {
      setLoading(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ padding: 20 }}>
        <Text style={styles.title}>Choose your role</Text>
        <Text style={styles.subtitle}>This helps us set up the right experience for you.</Text>

        <View style={styles.cardGrid}>
          <Pressable
            onPress={() => setRole('seeker')}
            disabled={!!loading}
            style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
          >
            <View style={styles.cardBadge}><Text>👤</Text></View>
            <Text style={styles.cardTitle}>Room Seeker</Text>
            <Text style={styles.cardDesc}>Find available rooms and message property owners.</Text>
            <View style={[styles.cardCta, loading === 'seeker' && { opacity: 0.6 }]}>
              <Text style={styles.cardCtaText}>{loading === 'seeker' ? 'Setting…' : 'Continue as Seeker'}</Text>
            </View>
          </Pressable>

          <Pressable
            onPress={() => setRole('owner')}
            disabled={!!loading}
            style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
          >
            <View style={styles.cardBadge}><Text>🏠</Text></View>
            <Text style={styles.cardTitle}>Property Owner</Text>
            <Text style={styles.cardDesc}>List your rooms, manage inquiries, and chat with seekers.</Text>
            <View style={[styles.cardCtaOutline, loading === 'owner' && { opacity: 0.6 }]}>
              <Text style={styles.cardCtaOutlineText}>{loading === 'owner' ? 'Setting…' : 'Continue as Owner'}</Text>
            </View>
          </Pressable>
        </View>

        <Text style={styles.note}>You can change this later from settings.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 6, color: '#11181C' },
  subtitle: { color: '#6b7280', marginBottom: 16 },
  cardGrid: { gap: 12 },
  card: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    padding: 16,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  cardBadge: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F0FDF4', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  cardTitle: { fontSize: 18, fontWeight: '800', color: '#11181C', marginBottom: 4 },
  cardDesc: { color: '#6b7280', marginBottom: 12 },
  cardCta: { height: 44, borderRadius: 10, backgroundColor: '#16C784', alignItems: 'center', justifyContent: 'center' },
  cardCtaText: { color: '#fff', fontWeight: '700' },
  cardCtaOutline: { height: 44, borderRadius: 10, borderWidth: 1, borderColor: '#16C784', alignItems: 'center', justifyContent: 'center' },
  cardCtaOutlineText: { color: '#16C784', fontWeight: '700' },
  note: { color: '#6b7280', marginTop: 12 },
});

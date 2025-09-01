import { Colors } from '@/constants/Colors';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const GREEN = Colors.light.tint; // #16C784

export default function OwnerHomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Welcome, Owner</Text>
      <Text style={styles.subtitle}>Manage your properties and messages here.</Text>

      <Pressable
        style={styles.addBtn}
        onPress={() => router.push({ pathname: '/(owner-tabs)/inventory', params: { new: '1' } })}
      >
        <Text style={styles.addBtnText}>+ Add New Property</Text>
      </Pressable>

      {/* You can show quick stats here (total listings, active, pending, etc.) */}
      <View style={styles.card}> 
        <Text style={styles.cardTitle}>Quick Actions</Text>
        <Text style={styles.cardItem}>• Add a property</Text>
        <Text style={styles.cardItem}>• View inventory</Text>
        <Text style={styles.cardItem}>• Check messages</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  title: { fontSize: 22, fontWeight: '800', color: '#11181C' },
  subtitle: { color: '#6b7280', marginTop: 4 },
  addBtn: { marginTop: 16, height: 48, borderRadius: 12, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: '#fff', fontWeight: '800' },
  card: { marginTop: 16, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 12, backgroundColor: '#fff' },
  cardTitle: { fontWeight: '700', marginBottom: 8, color: '#11181C' },
  cardItem: { color: '#11181C', marginTop: 4 },
});

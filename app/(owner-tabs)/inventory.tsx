import { Colors } from '@/constants/Colors';
import { NewPropertyForm } from './property/new';
import { useLocalSearchParams, router } from 'expo-router';
import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const GREEN = Colors.light.tint;

type Item = { id: string; title: string; status: 'Active' | 'Draft'; priceLkr: number };
const MOCK: Item[] = [
  { id: 'p1', title: 'Room near Nugegoda', status: 'Active', priceLkr: 15000 },
  { id: 'p2', title: 'Single room - Kandy', status: 'Draft', priceLkr: 12000 },
];

export default function InventoryScreen() {
  const params = useLocalSearchParams();
  const [showForm, setShowForm] = React.useState(params?.new === '1');

  const onDone = () => {
    setShowForm(false);
    // remove query param
    router.replace('/(owner-tabs)/inventory');
  };

  if (showForm) {
    return (
      <SafeAreaView style={[styles.container, { padding: 0 }]}>        
        <NewPropertyForm embedded onCancel={onDone} onDone={onDone} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Inventory</Text>
        <Pressable style={styles.addBtn} onPress={() => setShowForm(true)}>
          <Text style={styles.addBtnText}>+ Add Property</Text>
        </Pressable>
      </View>

      <FlatList
        data={MOCK}
        keyExtractor={(i) => i.id}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.itemTitle}>{item.title}</Text>
            <View style={styles.rowBetween}>
              <Text style={styles.price}>{`LKR ${item.priceLkr.toLocaleString()}/mo`}</Text>
              <Text style={[styles.badge, item.status === 'Active' ? styles.badgeActive : styles.badgeDraft]}>
                {item.status}
              </Text>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '800', color: '#11181C' },
  addBtn: { height: 40, paddingHorizontal: 12, borderRadius: 10, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: '#fff', fontWeight: '800' },
  card: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 12, backgroundColor: '#fff' },
  itemTitle: { fontWeight: '700', color: '#11181C' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  price: { color: GREEN, fontWeight: '800' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden', color: '#fff', fontWeight: '700' },
  badgeActive: { backgroundColor: GREEN },
  badgeDraft: { backgroundColor: '#9CA3AF' },
});

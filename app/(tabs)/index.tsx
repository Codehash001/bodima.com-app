import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

type Listing = {
  id: string;
  title: string;
  priceLkr: number;
  location: string;
  beds: number;
  baths: number;
  image: any;
  type: 'All' | 'Single Room' | 'Double Room' | 'Hostel';
};

const GREEN = Colors.light.tint; // #16C784

const PLACEHOLDER = require('@/assets/images/Logo.png');

const CATEGORIES = ['All', 'Single Room', 'Double Room', 'Hostel'] as const;

export default function HomeScreen() {
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('All');
  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState<Listing[]>([]);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('property')
          .select('property_id, type, total_capacity, cost, district, cover_image_url, created_at')
          .order('created_at', { ascending: false })
          .limit(50);
        if (error) throw error;
        const mapType = (t: any): Listing['type'] => {
          switch (t) {
            case 'single_room':
              return 'Single Room';
            case 'multiple_rooms':
              return 'Double Room';
            case 'hostel':
              return 'Hostel';
            default:
              return 'All';
          }
        };
        const mapped: Listing[] = (data || []).map((p: any) => {
          const imageUri = p.cover_image_url || null;
          const price = p.cost ?? 0;
          const loc = p.district ?? 'Sri Lanka';
          const cap = p.total_capacity ?? 1;
          const t = mapType(p.type);
          return {
            id: p.property_id,
            title: `${t !== 'All' ? t : 'Property'} in ${loc}`,
            priceLkr: typeof price === 'number' ? price : Number(price) || 0,
            location: String(loc),
            beds: Number(cap) || 1,
            baths: 1,
            image: imageUri ? { uri: imageUri } : PLACEHOLDER,
            type: CATEGORIES.includes(t as any) ? (t as any) : 'All',
          };
        });
        setListings(mapped);
      } catch (e) {
        console.warn('Failed to load properties', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const data = useMemo(() => {
    return listings.filter((x) => category === 'All' || x.type === category);
  }, [category, listings]);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.container, { paddingBottom: insets.bottom }] }>
      {/* Top bar: brand + search icon */}
      <View style={styles.headerRow}>
        <Text style={styles.brandText}>Bodima.com</Text>
        <Pressable style={styles.searchIconBtn} onPress={() => { /* future: open search screen */ }}>
          <Feather name="search" size={20} color="#11181C" />
        </Pressable>
      </View>

      {/* Category chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
        {CATEGORIES.map((c) => (
          <Pressable
            key={c}
            onPress={() => setCategory(c)}
            style={[styles.chip, category === c && { backgroundColor: '#e8f8f1', borderColor: GREEN }]}
          >
            <Text style={[styles.chipText, category === c && { color: GREEN, fontWeight: '700' }]}>{c}</Text>
          </Pressable>
        ))}
        <View style={{ width: 8 }} />
      </ScrollView>

      {/* Recently added */}
      <Text style={styles.sectionTitle}>Recently added places</Text>
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 24 + insets.bottom }}
        renderItem={({ item }) => <ListingCard item={item} />}
        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={!loading ? <FeaturedSection listings={listings.slice(0, 10)} /> : null}
        ListEmptyComponent={
          loading
            ? <Text style={{ textAlign: 'center', color: '#6b7280', marginTop: 16 }}>Loading properties…</Text>
            : <Text style={{ textAlign: 'center', color: '#6b7280', marginTop: 16 }}>No properties yet.</Text>
        }
      />
    </SafeAreaView>
  );
}

import { router } from 'expo-router';

function ListingCard({ item }: { item: Listing }) {
  return (
    <Pressable style={styles.card} onPress={() => router.push({ pathname: '/property/[id]', params: { id: item.id } })}>
      <Image source={item.image} style={styles.cardImage} contentFit="cover" />
      <View style={styles.cardBody}>
        <Text style={styles.price}>{`LKR ${item.priceLkr.toLocaleString()}/month`}</Text>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <View style={styles.cardRow}>
          <Ionicons name="location-outline" size={16} color="#6b7280" />
          <Text style={styles.cardMuted}>{item.location}</Text>
        </View>
        <View style={styles.cardRow}>
          <Text style={styles.cardMuted}>{item.beds} Bedroom</Text>
          <View style={{ width: 16 }} />
          <Text style={styles.cardMuted}>{item.baths} Bathroom</Text>
        </View>
      </View>
    </Pressable>
  );
}

function FeaturedSection({ listings }: { listings: Listing[] }) {
  return (
    <View style={{ marginTop: 16 }}>
      <Text style={styles.sectionTitle}>Featured Places</Text>
      <FlatList
        data={listings}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => `feat-${item.id}`}
        contentContainerStyle={{ paddingVertical: 8 }}
        ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
        renderItem={({ item }) => (
          <View style={styles.featuredCard}>
            <Image source={item.image} style={styles.featuredImage} contentFit="cover" />
            <View style={{ padding: 8 }}>
              <Text numberOfLines={1} style={styles.featuredTitle}>{item.title}</Text>
              <Text style={styles.featuredPrice}>{`LKR ${item.priceLkr.toLocaleString()}/mo`}</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  brandText: { fontSize: 22, fontWeight: '800', color: GREEN },
  searchIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderWidth: 1,
  },
  chipsRow: { paddingVertical: 12, columnGap: 8, alignItems: 'center' },
  chip: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    backgroundColor: '#fff',
  },
  chipText: { color: '#11181C' },
  sectionTitle: { marginTop: 8, marginBottom: 8, fontWeight: '700', color: '#11181C' },

  card: { borderRadius: 12, overflow: 'hidden', backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB' },
  cardImage: { width: '100%', height: 160 },
  cardBody: { padding: 12 },
  price: { color: GREEN, fontWeight: '800', marginBottom: 4 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#11181C' },
  cardRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  cardMuted: { color: '#6b7280', marginLeft: 4 },

  featuredCard: {
    width: 220,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  featuredImage: { width: 220, height: 120 },
  featuredTitle: { fontSize: 14, fontWeight: '600', color: '#11181C' },
  featuredPrice: { color: GREEN, fontWeight: '700', marginTop: 2 },
});

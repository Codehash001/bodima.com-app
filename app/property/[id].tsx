import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View, FlatList, Dimensions, ViewToken } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const GREEN = Colors.light.tint;
const BORDER = '#E5E7EB';
const TEXT = '#11181C';
const MUTED = '#6b7280';

export default function PropertyDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [property, setProperty] = useState<any | null>(null);
  const [fac, setFac] = useState<any | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const flatRef = useRef<FlatList<string>>(null);
  const onViewRef = useRef((info: { viewableItems: ViewToken[]; changed: ViewToken[] }) => {
    const first = info.viewableItems[0];
    if (first && typeof first.index === 'number') {
      setViewerIndex(first.index);
    }
  });
  const viewConfigRef = useRef({ viewAreaCoveragePercentThreshold: 60 });

  // Ensure pager jumps to tapped image when opening
  useEffect(() => {
    if (viewerOpen && flatRef.current) {
      // Defer to next tick to ensure FlatList laid out
      setTimeout(() => {
        try {
          flatRef.current?.scrollToIndex({ index: viewerIndex, animated: false });
        } catch {}
      }, 0);
    }
  }, [viewerOpen, viewerIndex]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const { data: prop, error } = await supabase
          .from('property')
          .select('property_id, type, total_capacity, number_of_single_rooms, number_of_shared_rooms, cost, cost_type, district, cover_image_url, description, owner_id')
          .eq('property_id', id)
          .maybeSingle();
        if (error) throw error;
        setProperty(prop);
        if (prop) {
          const { data: facRow } = await supabase
            .from('property_facilities')
            .select('*')
            .eq('property_id', prop.property_id)
            .maybeSingle();
          setFac(facRow || null);

          const { data: imgs, error: imgErr } = await supabase
            .from('property_images')
            .select('image_url, sort_order')
            .eq('property_id', prop.property_id)
            .order('sort_order', { ascending: true });
          if (!imgErr) setImages((imgs || []).map((r: any) => r.image_url).filter(Boolean));
        }
      } catch (e) {
        console.warn('Failed to load property', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const cover = useMemo(() => {
    if (!property) return null as any;
    const uri = property.cover_image_url || images[0];
    return uri ? { uri } : require('@/assets/images/Logo.png');
  }, [property, images]);

  const gallery: string[] = useMemo(() => images, [images]);

  // Derived shared status must be declared before any early returns to keep hook order stable
  const sharedStatus = useMemo(() => {
    const single = property?.number_of_single_rooms ?? 0;
    const shared = property?.number_of_shared_rooms ?? 0;
    const t = property?.type as any;
    if (single > 0 && shared > 0) return 'Shared & non-shared';
    if (shared > 0) return 'Shared room';
    if (single > 0) return 'Non-shared (single) room';
    switch (t) {
      case 'hostel':
        return 'Shared room';
      case 'single_room':
        return 'Non-shared (single) room';
      case 'multiple_rooms':
        return 'Shared & non-shared';
      default:
        return 'Room type';
    }
  }, [property]);

  if (loading) {
    return (
      <SafeAreaView edges={['bottom']} style={[styles.container, { paddingBottom: insets.bottom }]}>
        <View style={[styles.center, { flex: 1 }]}>
          <ActivityIndicator />
          <Text style={{ marginTop: 8, color: MUTED }}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!property) {
    return (
      <SafeAreaView edges={['bottom']} style={[styles.container, { paddingBottom: insets.bottom }]}>
        <View style={[styles.center, { flex: 1 }]}>
          <Text style={{ color: MUTED }}>Property not found.</Text>
          <Pressable style={[styles.pillBtn, { marginTop: 12 }]} onPress={() => router.back()}>
            <Text style={[styles.pillText, { color: GREEN }]}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const mapType = (t: any): string => {
    switch (t) {
      case 'single_room':
        return 'Single Room';
      case 'multiple_rooms':
        return 'Double Room';
      case 'hostel':
        return 'Hostel';
      default:
        return 'Property';
    }
  };
  const title = `${mapType(property.type)} in ${property.district ?? 'Sri Lanka'}`;
  const price = property.cost ?? 0;
  const location = property.district ?? 'Sri Lanka';
  const costType: 'per_person' | 'full_property' | string = property.cost_type ?? 'per_person';
  const desc = property.description ?? '';
  const screenWidth = Dimensions.get('window').width;

  return (
    <SafeAreaView edges={['bottom']} style={[styles.container, { paddingBottom: insets.bottom }]}> 
      <ScrollView showsVerticalScrollIndicator={false} contentInsetAdjustmentBehavior="never" contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Cover */}
        <View style={styles.coverWrap}>
          <Image source={cover} style={styles.cover} contentFit="cover" />
          <View style={styles.coverBadge}><Text style={styles.coverBadgeText}>{`LKR ${Number(price).toLocaleString()}/month${costType==='per_person' ? ' per person' : ''}`}</Text></View>
        </View>

        {/* Header */}
        <View style={{ padding: 16 }}>
          <Text style={styles.title}>{title}</Text>
          <View style={[styles.row, { marginTop: 6 }]}>
            <Ionicons name="location-outline" size={16} color={MUTED} />
            <Text style={styles.muted}>{location}</Text>
          </View>
          {/* Simplified specs */}
          <View style={[styles.row, { marginTop: 8 }]}> 
            <Ionicons name="home-outline" size={16} color={MUTED} />
            <Text style={styles.muted}>{mapType(property.type)}</Text>
          </View>
          <View style={[styles.row, { marginTop: 6 }]}> 
            <Ionicons name="bed-outline" size={16} color={MUTED} />
            <Text style={styles.muted}>{sharedStatus}</Text>
          </View>
        </View>

        {/* Facilities */}
        {fac && (
          <View style={[styles.card, { marginHorizontal: 16 }] }>
            <Text style={styles.cardTitle}>Facilities</Text>
            <View style={styles.facList}>
              {fac.wifi && <FacilityRow label="Wi‑Fi" />}
              {fac.kitchen && <FacilityRow label="Kitchen" />}
              {fac.washing_machine && <FacilityRow label="Washing machine" />}
              {fac.gym && <FacilityRow label="Gym" />}
              {fac.cctv && <FacilityRow label="CCTV" />}
              {fac.parking && <FacilityRow label="Parking" />}
            </View>
            <View style={{ height: 8 }} />
            <View style={styles.utilRow}>
              <Text style={styles.utilLabel}>Water</Text>
              <Text style={styles.utilValue}>
                {fac.water_bill_policy === 'property' ? 'Paid by property' : 'Paid by visitor'}
                {fac.water_bill_policy === 'visitor' && fac.water_bill_cost ? ` • ~LKR ${Number(fac.water_bill_cost).toLocaleString()}/mo` : ''}
              </Text>
            </View>
            <View style={styles.utilRow}>
              <Text style={styles.utilLabel}>Electricity</Text>
              <Text style={styles.utilValue}>
                {fac.electricity_bill_policy === 'property' ? 'Paid by property' : 'Paid by visitor'}
                {fac.electricity_bill_policy === 'visitor' && fac.electricity_bill_cost ? ` • ~LKR ${Number(fac.electricity_bill_cost).toLocaleString()}/mo` : ''}
              </Text>
            </View>
          </View>
        )}

        {/* Description */}
        {!!desc && (
          <View style={[styles.card, { marginHorizontal: 16 }]}>
            <Text style={styles.cardTitle}>About this place</Text>
            <Text style={{ color: TEXT, lineHeight: 20 }}>{desc}</Text>
          </View>
        )}

        {/* Gallery */}
        {gallery.length > 0 && (
          <View style={{ marginTop: 12 }}>
            <Text style={[styles.cardTitle, { marginHorizontal: 16 }]}>Photos</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8 }}>
              {gallery.map((g, i) => (
                <Pressable key={`${g}-${i}`} onPress={() => { setViewerIndex(i); setViewerOpen(true); }}>
                  <Image source={{ uri: g }} style={styles.thumb} contentFit="cover" />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Fullscreen viewer */}
      <Modal visible={viewerOpen} transparent animationType="fade" onRequestClose={() => setViewerOpen(false)}>
        <View style={styles.viewerBackdrop}>
          <FlatList
            ref={flatRef}
            data={gallery}
            horizontal
            pagingEnabled
            initialScrollIndex={viewerIndex}
            getItemLayout={(_, index) => ({ length: screenWidth, offset: screenWidth * index, index })}
            keyExtractor={(uri, idx) => `${uri}-${idx}`}
            renderItem={({ item }) => (
              <View style={{ width: screenWidth, height: '100%', justifyContent: 'center', alignItems: 'center' }}>
                <Image source={{ uri: item }} style={styles.viewerImage} contentFit="contain" />
              </View>
            )}
            onViewableItemsChanged={onViewRef.current}
            viewabilityConfig={viewConfigRef.current}
            showsHorizontalScrollIndicator={false}
          />

          {/* Close icon */}
          <Pressable style={styles.viewerCloseIcon} onPress={() => setViewerOpen(false)}>
            <Ionicons name="close" size={26} color="#fff" />
          </Pressable>

          {/* Prev/Next */}
          {gallery.length > 1 && (
            <>
              <Pressable
                style={styles.viewerNavLeft}
                onPress={() => {
                  const prev = Math.max(0, viewerIndex - 1);
                  flatRef.current?.scrollToIndex({ index: prev, animated: true });
                }}>
                <Ionicons name="chevron-back" size={30} color="#fff" />
              </Pressable>
              <Pressable
                style={styles.viewerNavRight}
                onPress={() => {
                  const next = Math.min(gallery.length - 1, viewerIndex + 1);
                  flatRef.current?.scrollToIndex({ index: next, animated: true });
                }}>
                <Ionicons name="chevron-forward" size={30} color="#fff" />
              </Pressable>
            </>
          )}
        </View>
      </Modal>

      {/* Bottom CTAs */}
      <View style={[styles.footerBar, { paddingBottom: 16 + insets.bottom }]}> 
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Pressable style={[styles.ctaBtn, { flex: 1 }]} onPress={async () => {
            try {
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) return;
              if (!property?.owner_id || !property?.property_id) return;
              const seeker_id = user.id;
              const owner_id = property.owner_id as string;
              const propId = property.property_id as string;

              // 1) Try get existing conversation
              const { data: existing, error: selErr } = await supabase
                .from('conversations')
                .select('conversation_id')
                .eq('seeker_id', seeker_id)
                .eq('owner_id', owner_id)
                .eq('property_id', propId)
                .maybeSingle();
              if (selErr) { /* ignore not found */ }

              let convId = existing?.conversation_id as string | undefined;
              if (!convId) {
                // 2) Create conversation
                const { data: created, error: insErr } = await supabase
                  .from('conversations')
                  .insert({ seeker_id, owner_id, property_id: propId })
                  .select('conversation_id')
                  .single();
                if (insErr) throw insErr;
                convId = created!.conversation_id as string;
              }
              // 3) Navigate to thread (also pass pid for header property chip)
              router.push({ pathname: '/messages/[id]', params: { id: convId!, pid: propId } });
            } catch (e) { /* noop */ }
          }}>
            <Text style={[styles.ctaText]}>Contact owner</Text>
          </Pressable>
          <Pressable style={[styles.ctaOutline, { flex: 1 }]} onPress={() => { /* TODO: schedule viewing flow */ }}>
            <Text style={[styles.ctaOutlineText]}>Schedule view</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

function Badge({ text }: { text: string }) {
  return (
    <View style={styles.badge}><Text style={styles.badgeText}>{text}</Text></View>
  );
}

function FacilityRow({ label }: { label: string }) {
  return (
    <View style={styles.facItem}>
      <Ionicons name="checkmark-circle" size={18} color={GREEN} />
      <Text style={styles.facText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { alignItems: 'center', justifyContent: 'center' },
  coverWrap: { borderBottomWidth: 1, borderColor: BORDER },
  cover: { width: '100%', height: 220 },
  coverBadge: { position: 'absolute', bottom: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  coverBadgeText: { color: '#fff', fontWeight: '800' },
  title: { fontSize: 22, fontWeight: '800', color: TEXT },
  row: { flexDirection: 'row', alignItems: 'center' },
  muted: { color: MUTED, marginLeft: 4 },
  specsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, flexWrap: 'wrap' },
  specItem: { flexDirection: 'row', alignItems: 'center' },
  specDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB', marginHorizontal: 8 },

  card: { borderWidth: 1, borderColor: BORDER, borderRadius: 12, padding: 12, backgroundColor: '#fff', marginTop: 8 },
  cardTitle: { fontWeight: '800', color: TEXT, marginBottom: 8 },

  facRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  facList: { rowGap: 8 },
  facItem: { flexDirection: 'row', alignItems: 'center', columnGap: 8 },
  facText: { color: TEXT, fontWeight: '600' },
  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: BORDER },
  badgeText: { color: TEXT, fontWeight: '700' },

  thumb: { width: 160, height: 100, borderRadius: 10, borderWidth: 1, borderColor: BORDER, backgroundColor: '#F9FAFB', marginRight: 10 },

  footerBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: BORDER },
  ctaBtn: { marginTop: 8, height: 48, borderRadius: 12, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#fff', fontWeight: '800' },
  ctaOutline: { marginTop: 8, height: 48, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: GREEN },
  ctaOutlineText: { color: GREEN, fontWeight: '800' },
  pillBtn: { borderWidth: 1, borderColor: GREEN, borderRadius: 999, paddingHorizontal: 14, height: 36, alignItems: 'center', justifyContent: 'center' },
  pillText: { fontWeight: '800' },
  utilRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderTopWidth: 1, borderTopColor: BORDER },
  utilLabel: { color: MUTED },
  utilValue: { color: TEXT, fontWeight: '600', marginLeft: 8, flex: 1, textAlign: 'right' },
  viewerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  viewerImage: { width: '100%', height: '100%' },
  viewerClose: { position: 'absolute', top: 40, right: 20, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8 },
  viewerCloseText: { color: '#fff', fontWeight: '800' },
  viewerCloseIcon: { position: 'absolute', top: 40, right: 20, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  viewerNavLeft: { position: 'absolute', left: 12, top: '50%', marginTop: -24, width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  viewerNavRight: { position: 'absolute', right: 12, top: '50%', marginTop: -24, width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
});

import { supabase } from '@/lib/supabase';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ExploreMapScreen() {
  // Dynamically load react-native-maps so this screen evaluates in Expo Go
  // In a Development Build, the native module will be present and the map will render
  const Maps = useMemo(() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      return require('react-native-maps') as typeof import('react-native-maps');
    } catch {
      return null;
    }
  }, []);
  const [locPerm, setLocPerm] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  const [region, setRegion] = useState<{
    latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{ title: string; lat: number; lon: number }>>([]);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapRef = useRef<any>(null);

  type Property = {
    property_id: string;
    owner_id?: string | null;
    district: string | null;
    latitude: number | null;
    longitude: number | null;
    cost: number | null;
    cover_image_url: string | null;
    type: string | null;
  };
  const [properties, setProperties] = useState<Property[]>([]);
  const [loadingProps, setLoadingProps] = useState(false);
  const [selected, setSelected] = useState<Property | null>(null);
  const [showRoute, setShowRoute] = useState(false);
  const [myCoord, setMyCoord] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        setLocPerm(status);
        if (status !== 'granted') {
          Alert.alert('Location needed', 'Enable location to see nearby rooms');
          setLoading(false);
          return;
        }
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const nextRegion = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        };
        setRegion(nextRegion);
        setMyCoord({ latitude: nextRegion.latitude, longitude: nextRegion.longitude });
      } catch (e: any) {
        Alert.alert('Location error', e.message || 'Could not get your location');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  // Geocoding: search a place/city using Nominatim
  const onChangeQuery = (text: string) => {
    setQuery(text);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (!text) {
      setSearchResults([]);
      return;
    }
    searchDebounce.current = setTimeout(async () => {
      try {
        setSearching(true);
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text)}&addressdetails=1&limit=5`;
        const res = await fetch(url, { headers: { 'User-Agent': 'the-bodima-app/1.0' } });
        const json: any[] = await res.json();
        const results = (json || []).map((j) => ({
          title: j.display_name as string,
          lat: parseFloat(j.lat),
          lon: parseFloat(j.lon),
        })).filter((r) => !Number.isNaN(r.lat) && !Number.isNaN(r.lon));
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
  };

  const goToPlace = (res: { title: string; lat: number; lon: number }) => {
    setSearchResults([]);
    setQuery(res.title);
    setRegion((r) => ({
      latitude: res.lat,
      longitude: res.lon,
      latitudeDelta: r?.latitudeDelta ?? 0.03,
      longitudeDelta: r?.longitudeDelta ?? 0.03,
    }));
  };

  // Fetch nearby properties when region changes
  const fetchNearby = async (center: { latitude: number; longitude: number }) => {
    try {
      setLoadingProps(true);
      const kmPerDegLat = 111; // approx
      const kmPerDegLon = 111 * Math.cos((center.latitude * Math.PI) / 180);
      const radiusKm = 3; // search ~3km around center
      const dLat = radiusKm / kmPerDegLat;
      const dLon = radiusKm / kmPerDegLon;
      const minLat = center.latitude - dLat;
      const maxLat = center.latitude + dLat;
      const minLon = center.longitude - dLon;
      const maxLon = center.longitude + dLon;

      const { data, error } = await supabase
        .from('property')
        .select('property_id,owner_id,district,latitude,longitude,cost,cover_image_url,type')
        .gte('latitude', minLat)
        .lte('latitude', maxLat)
        .gte('longitude', minLon)
        .lte('longitude', maxLon)
        .limit(50);
      if (error) throw error;
      setProperties((data as any) || []);
    } catch (e: any) {
      // fail silently on map fetch
    } finally {
      setLoadingProps(false);
    }
  };

  useEffect(() => {
    if (!region) return;
    fetchNearby({ latitude: region.latitude, longitude: region.longitude });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region?.latitude, region?.longitude]);

  const recenter = async () => {
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const next = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };
      setRegion(next);
      setMyCoord({ latitude: next.latitude, longitude: next.longitude });
    } catch {}
  };

  // Extract components from dynamically required module
  const MapView = (Maps as any)?.default;
  const Marker = (Maps as any)?.Marker;
  const Callout = (Maps as any)?.Callout;
  const Polyline = (Maps as any)?.Polyline;
  const PROVIDER_GOOGLE = (Maps as any)?.PROVIDER_GOOGLE;
  const canRenderMap = Boolean(MapView && Marker && region && locPerm === 'granted');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Explore</Text>
        <Pressable onPress={recenter} style={styles.recenterBtn}>
          <Text style={styles.recenterText}>My location</Text>
        </Pressable>
      </View>

      {loading && (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={{ marginTop: 8 }}>Getting your location…</Text>
        </View>
      )}

      {!loading && (
        locPerm !== 'granted' ? (
          <View style={styles.center}>
            <Text>Location permission is required to find nearby rooms.</Text>
          </View>
        ) : (
          <View style={styles.mapWrap}>
            {canRenderMap ? (
              <MapView
                provider={PROVIDER_GOOGLE}
                style={styles.map}
                initialRegion={region!}
                region={region!}
                onRegionChangeComplete={setRegion as any}
                showsUserLocation
                showsMyLocationButton
                ref={mapRef}
              >
                {properties.filter(p => p.latitude && p.longitude).map((p) => (
                  <Marker
                    key={p.property_id}
                    coordinate={{ latitude: p.latitude as number, longitude: p.longitude as number }}
                    title={`${mapType(p.type) ?? 'Room'} • LKR ${Math.round(p.cost || 0).toLocaleString()}`}
                    onPress={() => setSelected(p)}
                  >
                    <View style={styles.pinCard}>
                      <Text style={styles.pinType}>{mapType(p.type)}</Text>
                      <Text style={styles.pinPrice}>LKR {Math.round(p.cost || 0).toLocaleString()}</Text>
                    </View>
                    {Callout && (
                      <Callout tooltip onPress={() => setSelected(p)}>
                        <View style={styles.callout}>
                          <Text numberOfLines={1} style={styles.calloutTitle}>{mapType(p.type) || 'Property'}</Text>
                          <Text numberOfLines={1} style={styles.calloutSubtitle}>{p.district || ''}</Text>
                          <Text style={styles.calloutChevron}>›</Text>
                        </View>
                      </Callout>
                    )}
                  </Marker>
                ))}

                {Polyline && showRoute && selected && myCoord && selected.latitude && selected.longitude && (
                  <Polyline
                    coordinates={[{ ...myCoord }, { latitude: selected.latitude as number, longitude: selected.longitude as number }]}
                    strokeColor={GREEN}
                    strokeWidth={4}
                  />
                )}
              </MapView>
            ) : (
              <View style={styles.center}>
                <Text style={{ textAlign: 'center', paddingHorizontal: 16 }}>
                  Map module not available in Expo Go. Build a Development Client to see the map.
                </Text>
              </View>
            )}

            {/* Search bar overlay */}
            <View style={styles.searchWrap} pointerEvents="box-none">
              <View style={styles.searchBar}>
                <TextInput
                  placeholder="Search city or place"
                  placeholderTextColor="#9CA3AF"
                  value={query}
                  onChangeText={onChangeQuery}
                  style={styles.searchInput}
                  returnKeyType="search"
                />
                {searching ? <ActivityIndicator size="small" /> : null}
              </View>
              {searchResults.length > 0 && (
                <View style={styles.searchResults}>
                  <ScrollView>
                    {searchResults.map((r, idx) => (
                      <Pressable key={`${r.lat}-${r.lon}-${idx}`} onPress={() => goToPlace(r)} style={styles.resultRow}>
                        <Text numberOfLines={1} style={styles.resultText}>{r.title}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Horizontal mini-cards removed as requested */}

            {/* Bottom details card */}
            {selected && (
              <View style={styles.bottomCard}>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  {selected.cover_image_url ? (
                    <Image source={{ uri: selected.cover_image_url }} style={styles.bottomThumb} contentFit="cover" />
                  ) : (
                    <View style={[styles.bottomThumb, { backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' }]}>
                      <Text style={{ color: '#6b7280', fontWeight: '700' }}>No image</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={styles.bottomTitle}>{selected.type || 'Property'} in {selected.district || '—'}</Text>
                    <Text style={styles.bottomPrice}>LKR {Math.round(selected.cost || 0).toLocaleString()} / mo</Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                      <Pressable
                        onPress={() => {
                          // Toggle in-map directions and fit map to both points
                          if (!selected || !selected.latitude || !selected.longitude || !myCoord) return;
                          const coords = [myCoord, { latitude: selected.latitude as number, longitude: selected.longitude as number }];
                          setShowRoute(s => !s);
                          requestAnimationFrame(() => {
                            try { mapRef.current?.fitToCoordinates(coords, { edgePadding: { top: 100, bottom: 260, left: 60, right: 60 }, animated: true }); } catch {}
                          });
                        }}
                        style={[styles.pillBtn, { backgroundColor: '#fff', borderColor: GREEN, borderWidth: 1 }]}
                      >
                        <Text style={[styles.pillBtnText, { color: GREEN }]}>Directions</Text>
                      </Pressable>
                      <Pressable
                        onPress={async () => {
                          try {
                            if (!selected?.owner_id) { router.push({ pathname: '/property/[id]', params: { id: selected.property_id } }); return; }
                            const { data: u } = await supabase.auth.getUser();
                            const seeker_id = u.user?.id;
                            if (!seeker_id) { router.push('/auth/login'); return; }
                            const owner_id = selected.owner_id as string;
                            const property_id = selected.property_id;
                            // 1) Try find existing conversation
                            let convId: string | null = null;
                            const { data: existing, error: exErr } = await supabase
                              .from('conversations')
                              .select('conversation_id')
                              .eq('seeker_id', seeker_id)
                              .eq('owner_id', owner_id)
                              .maybeSingle();
                            if (!exErr && existing) convId = (existing as any).conversation_id as string;
                            // 2) Create if missing
                            if (!convId) {
                              const { data: created, error: insErr } = await supabase
                                .from('conversations')
                                .insert({ seeker_id, owner_id, property_id })
                                .select('conversation_id')
                                .single();
                              if (insErr) throw insErr;
                              convId = created!.conversation_id as string;
                            }
                            // 3) Navigate to thread, pass pid for header chip
                            router.push({ pathname: '/messages/[id]', params: { id: convId!, pid: property_id } });
                          } catch {}
                        }}
                        style={[styles.pillBtn, { backgroundColor: GREEN }]}
                      >
                        <Text style={[styles.pillBtnText, { color: '#fff' }]}>Contact owner</Text>
                      </Pressable>
                    </View>
                  </View>
                  <Pressable onPress={() => setSelected(null)} style={styles.closeX}><Text style={{ color: '#6b7280', fontWeight: '900' }}>×</Text></Pressable>
                </View>
              </View>
            )}
          </View>
        )
      )}
    </SafeAreaView>
  );
}

function mapType(t?: string | null) {
  switch (t) {
    case 'single_room': return 'Single room';
    case 'multiple_rooms': return 'Multiple rooms';
    case 'hostel': return 'Hostel';
    default: return 'Room';
  }
}

const GREEN = '#16C784';
const BORDER = '#E5E7EB';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: GREEN },
  recenterBtn: { borderWidth: 1, borderColor: GREEN, borderRadius: 999, paddingHorizontal: 12, height: 32, alignItems: 'center', justifyContent: 'center' },
  recenterText: { color: GREEN, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mapWrap: { flex: 1 },
  map: { flex: 1 },
  pin: { backgroundColor: GREEN, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  pinText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  // New marker card showing type + price
  pinCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 },
  pinType: { color: '#11181C', fontWeight: '800', fontSize: 11 },
  pinPrice: { color: GREEN, fontWeight: '900', fontSize: 12, marginTop: 2 },
  // Marker callout (like the 2nd screenshot)
  callout: { backgroundColor: '#fff', borderRadius: 14, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: BORDER, flexDirection: 'row', alignItems: 'center', gap: 8, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  calloutTitle: { fontWeight: '900', color: '#11181C', maxWidth: 180 },
  calloutSubtitle: { color: '#6b7280', maxWidth: 220 },
  calloutChevron: { marginLeft: 6, color: '#6b7280', fontSize: 18, fontWeight: '900' },
  // Search UI
  searchWrap: { position: 'absolute', left: 12, right: 12, top: 6 },
  searchBar: { backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, height: 40, borderWidth: 1, borderColor: BORDER, flexDirection: 'row', alignItems: 'center', gap: 8, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  searchInput: { flex: 1, color: '#11181C', paddingVertical: 0 },
  searchResults: { marginTop: 6, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: BORDER, maxHeight: 220, overflow: 'hidden' },
  resultRow: { paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: BORDER },
  resultText: { color: '#11181C' },
  // Mini cards rail
  cardRail: { position: 'absolute', bottom: 120, left: 0, right: 0 },
  smallCard: { width: 160, marginHorizontal: 8, backgroundColor: '#fff', borderRadius: 12, padding: 8, borderWidth: 1, borderColor: BORDER, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 },
  smallThumb: { width: '100%', height: 90, borderRadius: 8, overflow: 'hidden' },
  smallTitle: { marginTop: 6, fontWeight: '800', color: '#11181C' },
  smallPrice: { color: GREEN, fontWeight: '800', marginTop: 2 },
  // Bottom card
  bottomCard: { position: 'absolute', left: 12, right: 12, bottom: 16, backgroundColor: '#fff', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: BORDER, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 12, elevation: 4 },
  bottomThumb: { width: 110, height: 90, borderRadius: 12, overflow: 'hidden' },
  bottomTitle: { fontSize: 16, fontWeight: '900', color: '#11181C' },
  bottomPrice: { marginTop: 4, color: GREEN, fontWeight: '900' },
  ctaBtn: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
  pillBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, borderWidth: 0 },
  pillBtnText: { fontWeight: '900' },
  closeX: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});

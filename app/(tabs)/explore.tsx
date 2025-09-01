import * as Location from 'expo-location';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
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
        setRegion({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        });
      } catch (e: any) {
        Alert.alert('Location error', e.message || 'Could not get your location');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  const markers = useMemo(() => {
    if (!region) return [] as Array<{ id: string; lat: number; lon: number; title: string; price: string }>;
    const { latitude: lat, longitude: lon } = region;
    return [
      { id: 'm1', lat: lat + 0.003, lon: lon + 0.002, title: 'Single Room', price: 'LKR 12,000' },
      { id: 'm2', lat: lat + 0.001, lon: lon - 0.002, title: 'Double Room', price: 'LKR 15,000' },
      { id: 'm3', lat: lat - 0.002, lon: lon + 0.001, title: 'Hostel Bed', price: 'LKR 8,000' },
    ];
  }, [region]);

  const recenter = async () => {
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setRegion({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      });
    } catch {}
  };

  // Extract components from dynamically required module
  const MapView = (Maps as any)?.default;
  const Marker = (Maps as any)?.Marker;
  const PROVIDER_GOOGLE = (Maps as any)?.PROVIDER_GOOGLE;
  const canRenderMap = Boolean(MapView && Marker && region && locPerm === 'granted');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Explore nearby</Text>
        <Pressable onPress={recenter} style={styles.recenterBtn}>
          <Text style={styles.recenterText}>Recenter</Text>
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
              >
                {markers.map((m) => (
                  <Marker key={m.id} coordinate={{ latitude: m.lat, longitude: m.lon }} title={`${m.title} • ${m.price}`}>
                    <View style={styles.pin}><Text style={styles.pinText}>{m.price}</Text></View>
                  </Marker>
                ))}
              </MapView>
            ) : (
              <View style={styles.center}>
                <Text style={{ textAlign: 'center', paddingHorizontal: 16 }}>
                  Map module not available in Expo Go. Build a Development Client to see the map.
                </Text>
              </View>
            )}
          </View>
        )
      )}
    </SafeAreaView>
  );
}

const GREEN = '#16C784';

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
});

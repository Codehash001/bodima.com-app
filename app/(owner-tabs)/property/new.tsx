import { supabase } from '@/lib/supabase';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import MapView, { MapPressEvent, Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const GREEN = '#16C784';
const MUTED = '#6b7280';
const BORDER = '#E5E7EB';
const TEXT = '#11181C';

const PROPERTY_TYPES: Array<{ key: any; label: string }> = [
  { key: 'single_room', label: 'Single room' },
  { key: 'multiple_rooms', label: 'Multiple rooms' },
  { key: 'hostel', label: 'Hostel' },
  { key: 'annex', label: 'Annex' },
  { key: 'house', label: 'House' },
];

const COST_TYPES: Array<{ key: any; label: string }> = [
  { key: 'per_person', label: 'Per person' },
  { key: 'full_property', label: 'Full property' },
];

const DISTRICTS = [
  'Colombo','Gampaha','Kalutara','Kandy','Matale','Nuwara Eliya','Galle','Matara','Hambantota','Jaffna','Kilinochchi','Mannar','Vavuniya','Mullaitivu','Batticaloa','Ampara','Trincomalee','Kurunegala','Puttalam','Anuradhapura','Polonnaruwa','Badulla','Monaragala','Ratnapura','Kegalle',
];

type NewPropertyFormProps = {
  embedded?: boolean;
  onCancel?: () => void;
  onDone?: () => void;
};

export function NewPropertyForm({ embedded, onCancel, onDone }: NewPropertyFormProps) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);

  // Step 1
  const [type, setType] = useState<any>('single_room');
  const [numSingle, setNumSingle] = useState<string>('0');
  const [numShared, setNumShared] = useState<string>('0');
  const [capacity, setCapacity] = useState<string>('0');
  const [costType, setCostType] = useState<any>('per_person');
  const [cost, setCost] = useState<string>('0');
  const [roomKind, setRoomKind] = useState<'single' | 'shared'>('single');

  // Step 2
  const [description, setDescription] = useState('');
  const [latitude, setLatitude] = useState<string>('');
  const [longitude, setLongitude] = useState<string>('');
  const [district, setDistrict] = useState('');
  const [mapRegion, setMapRegion] = useState<Region | null>(null);
  const [districtOpen, setDistrictOpen] = useState(false);

  // Step 3
  const [coverUri, setCoverUri] = useState<string>('');
  const [gallery, setGallery] = useState<string[]>([]); // local URIs
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerForCover, setPickerForCover] = useState(false);
  // Facilities
  const [wifi, setWifi] = useState(false);
  const [kitchen, setKitchen] = useState(false);
  const [washingMachine, setWashingMachine] = useState(false);
  const [gym, setGym] = useState(false);
  const [cctv, setCctv] = useState(false);
  const [parking, setParking] = useState(false);
  type BillPolicy = 'property' | 'visitor';
  const [waterPolicy, setWaterPolicy] = useState<BillPolicy>('property');
  const [waterCost, setWaterCost] = useState<string>('');
  const [electricPolicy, setElectricPolicy] = useState<BillPolicy>('property');
  const [electricCost, setElectricCost] = useState<string>('');

  const completion = useMemo(() => {
    const basics = [type, numSingle, numShared, capacity, costType, cost];
    const loc = [latitude, longitude, district];
    const imgs = [coverUri];
    const total = basics.length + loc.length + imgs.length + 1; // +1 for description
    const done = basics.filter(v => String(v).length > 0).length
      + loc.filter(v => String(v).length > 0).length
      + (description ? 1 : 0)
      + imgs.filter(Boolean).length;
    return Math.round((done / total) * 100);
  }, [type, numSingle, numShared, capacity, costType, cost, latitude, longitude, district, description, coverUri]);

  const pickImage = async (source: 'camera' | 'library', forCover: boolean) => {
    try {
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (perm.status !== 'granted') {
          Alert.alert('Permission needed', 'Please allow camera access.');
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.85,
        });
        if (result.canceled) return;
        const uri = result.assets[0]?.uri;
        if (!uri) return;
        if (forCover) setCoverUri(uri); else setGallery(prev => [...prev, uri]);
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (perm.status !== 'granted') {
          Alert.alert('Permission needed', 'Please allow photo library access.');
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.85,
        });
        if (result.canceled) return;
        const uri = result.assets[0]?.uri;
        if (!uri) return;
        if (forCover) setCoverUri(uri); else setGallery(prev => [...prev, uri]);
      }
    } catch (e: any) {
      Alert.alert('Image picker error', e?.message || 'Could not select image');
    } finally {
      setPickerOpen(false);
    }
  };
  // Keep capacity locked to 1 when Single Room + Single type is selected
  React.useEffect(() => {
    if (type === 'single_room' && roomKind === 'single') {
      if (capacity !== '1') setCapacity('1');
    }
  }, [type, roomKind]);
  const onMarkerDragStart = () => setScrollEnabled(false);
  const onMapTouchStart = () => setScrollEnabled(false);
  const onMapTouchEnd = () => setScrollEnabled(true);

  // Keep map in sync when user types lat/lng directly
  React.useEffect(() => {
    if (step !== 2) return;
    const latNum = parseFloat(latitude);
    const lngNum = parseFloat(longitude);
    if (!Number.isNaN(latNum) && !Number.isNaN(lngNum)) {
      setMapRegion((r) => ({
        latitude: latNum,
        longitude: lngNum,
        latitudeDelta: r?.latitudeDelta ?? 0.01,
        longitudeDelta: r?.longitudeDelta ?? 0.01,
      }));
    }
  }, [latitude, longitude, step]);

  const onMapPress = (e: MapPressEvent) => {
    const { latitude: lat, longitude: lng } = e.nativeEvent.coordinate;
    setLatitude(String(lat));
    setLongitude(String(lng));
    setMapRegion((r) => ({
      latitude: lat,
      longitude: lng,
      latitudeDelta: r?.latitudeDelta ?? 0.01,
      longitudeDelta: r?.longitudeDelta ?? 0.01,
    }));
  };

  const onMarkerDragEnd = (e: any) => {
    const { latitude: lat, longitude: lng } = e.nativeEvent.coordinate;
    setLatitude(String(lat));
    setLongitude(String(lng));
    setMapRegion((r) => ({
      latitude: lat,
      longitude: lng,
      latitudeDelta: r?.latitudeDelta ?? 0.01,
      longitudeDelta: r?.longitudeDelta ?? 0.01,
    }));
  };

  const removeGalleryAt = (idx: number) => setGallery(prev => prev.filter((_, i) => i !== idx));

  const next = () => setStep(s => Math.min(4, s + 1));
  const back = () => setStep(s => Math.max(1, s - 1));

  // Initialize map with current location when entering Step 2 (first time)
  React.useEffect(() => {
    const init = async () => {
      if (step !== 2) return;
      try {
        // If already have coordinates, just sync region
        const latNum = parseFloat(latitude);
        const lngNum = parseFloat(longitude);
        if (!Number.isNaN(latNum) && !Number.isNaN(lngNum)) {
          setMapRegion({ latitude: latNum, longitude: lngNum, latitudeDelta: 0.01, longitudeDelta: 0.01 });
          return;
        }
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({});
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setLatitude(String(lat));
        setLongitude(String(lng));
        setMapRegion({ latitude: lat, longitude: lng, latitudeDelta: 0.01, longitudeDelta: 0.01 });
      } catch {}
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const useMyLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow location access to use your current location.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      setLatitude(String(lat));
      setLongitude(String(lng));
      setMapRegion({ latitude: lat, longitude: lng, latitudeDelta: 0.01, longitudeDelta: 0.01 });
    } catch (e: any) {
      Alert.alert('Location error', e?.message || 'Unable to get current location');
    }
  };

  const submit = async () => {
    try {
      setSubmitting(true);
      // Basic validation
      if (!latitude || !longitude || !district) {
        throw new Error('Please fill location (latitude, longitude, district).');
      }
      if (gallery.length < 2) {
        throw new Error('Please add at least 2 additional images.');
      }
      if (waterPolicy === 'visitor' && (!waterCost || isNaN(parseFloat(waterCost)))) {
        throw new Error('Please provide an approximate water bill cost.');
      }
      if (electricPolicy === 'visitor' && (!electricCost || isNaN(parseFloat(electricCost)))) {
        throw new Error('Please provide an approximate electricity bill cost.');
      }
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      if (Number.isNaN(lat) || Number.isNaN(lng)) throw new Error('Latitude/Longitude must be numbers');

      const nSingle = type === 'single_room' ? (roomKind === 'single' ? 1 : 0) : (parseInt(numSingle || '0', 10) || 0);
      const nShared = type === 'single_room' ? (roomKind === 'shared' ? 1 : 0) : (parseInt(numShared || '0', 10) || 0);
      const totCap = (type === 'single_room' && roomKind === 'single') ? 1 : (parseInt(capacity || '0', 10) || 0);
      const price = parseFloat(cost || '0') || 0;

      const { data: u } = await supabase.auth.getUser();
      const ownerId = u.user?.id;
      if (!ownerId) throw new Error('Not authenticated');

      // Insert property (cover_image_url will be set after upload)
      const { data: inserted, error: insErr } = await supabase
        .from('property')
        .insert({
          owner_id: ownerId,
          type,
          number_of_single_rooms: nSingle,
          number_of_shared_rooms: nShared,
          total_capacity: totCap,
          cost_type: costType,
          cost: price,
          description,
          latitude: lat,
          longitude: lng,
          district,
          cover_image_url: null,
        })
        .select('property_id')
        .single();
      if (insErr) throw insErr;
      const propertyId = inserted.property_id as string;

      // Insert facilities
      const { error: facErr } = await supabase
        .from('property_facilities')
        .insert({
          property_id: propertyId,
          wifi,
          kitchen,
          washing_machine: washingMachine,
          gym,
          cctv,
          parking,
          water_bill_policy: waterPolicy,
          water_bill_cost: waterPolicy === 'visitor' ? parseFloat(waterCost || '0') : null,
          electricity_bill_policy: electricPolicy,
          electricity_bill_cost: electricPolicy === 'visitor' ? parseFloat(electricCost || '0') : null,
        });
      if (facErr) throw facErr;

      // Helper to read bytes
      const readBytes = async (uri: string) => {
        const res = await fetch(uri);
        const ab = await res.arrayBuffer();
        const bytes = new Uint8Array(ab);
        if (!bytes || bytes.byteLength === 0) throw new Error('Selected image was empty');
        // best-effort content-type guess
        const lc = uri.toLowerCase();
        const contentType = lc.endsWith('.png') ? 'image/png' : lc.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
        const ext = lc.endsWith('.png') ? 'png' : lc.endsWith('.webp') ? 'webp' : 'jpg';
        return { bytes, contentType, ext };
      };

      // Upload cover image
      let coverPublicUrl: string | null = null;
      if (coverUri) {
        const { bytes, contentType, ext } = await readBytes(coverUri);
        const coverPath = `${ownerId}/${propertyId}/cover.${ext}`;
        const { error: upErr } = await supabase.storage.from('property-images').upload(coverPath, bytes, {
          contentType,
          upsert: true,
        });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from('property-images').getPublicUrl(coverPath);
        coverPublicUrl = pub.publicUrl;
        // Update property with cover url
        const { error: updErr } = await supabase
          .from('property')
          .update({ cover_image_url: coverPublicUrl })
          .eq('property_id', propertyId);
        if (updErr) throw updErr;
      }

      // Upload gallery images
      for (let i = 0; i < gallery.length; i++) {
        const g = gallery[i];
        try {
          const { bytes, contentType, ext } = await readBytes(g);
          const imgPath = `${ownerId}/${propertyId}/g_${i + 1}_${Date.now()}.${ext}`;
          const { error: upErr } = await supabase.storage.from('property-images').upload(imgPath, bytes, {
            contentType,
            upsert: false,
          });
          if (upErr) throw upErr;
          const { data: pub } = supabase.storage.from('property-images').getPublicUrl(imgPath);
          const imageUrl = pub.publicUrl;
          const { error: imErr } = await supabase
            .from('property_images')
            .insert({ property_id: propertyId, image_url: imageUrl, sort_order: i });
          if (imErr) throw imErr;
        } catch (e) {
          // Continue with next image if one fails
        }
      }

      Alert.alert('Success', 'Property created successfully.');
      if (onDone) onDone(); else router.replace('/(owner-tabs)/inventory');
    } catch (e: any) {
      Alert.alert('Failed to create', e.message || 'Please try again');
    } finally {
      setSubmitting(false);
    }
  };

  const Content = (
    <>
      {!embedded && <Text style={[styles.title, { paddingHorizontal: 16, paddingTop: 8 }]}>Add New Property</Text>}
      <View style={[styles.progressRow, { paddingHorizontal: 16 }]}>
        <View style={styles.progressTrack}><View style={[styles.progressBar, { width: `${(step/4)*100}%` }]} /></View>
        <Text style={styles.progressText}>Step {step} of 4 </Text>
      </View>

      {embedded && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 }}>
          <Text style={[styles.title]}>Add New Property</Text>
          <Pressable onPress={onCancel} style={[styles.outlineBtn, { height: 36, paddingHorizontal: 12 }]}>
            <Text style={styles.outlineText}>Cancel</Text>
          </Pressable>
        </View>
      )}

      <View style={{ paddingHorizontal: 16 }}>
          {step === 1 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Basics</Text>

              <Text style={styles.label}>Property Type</Text>
              <View style={styles.segment}>
                {PROPERTY_TYPES.map(opt => (
                  <Pressable key={opt.key} onPress={() => setType(opt.key)} style={[styles.segmentItem, type === opt.key && styles.segmentItemActive]}>
                    <Text style={[styles.segmentText, type === opt.key && styles.segmentTextActive]}>{opt.label}</Text>
                  </Pressable>
                ))}
              </View>

              {type === 'single_room' ? (
                <>
                  <Text style={styles.label}>Room type</Text>
                  <View style={styles.segment}>
                    {[
                      { key: 'single', label: 'Single' },
                      { key: 'shared', label: 'Shared' },
                    ].map((opt: any) => (
                      <Pressable key={opt.key} onPress={() => setRoomKind(opt.key)} style={[styles.segmentItem, roomKind === opt.key && styles.segmentItemActive]}>
                        <Text style={[styles.segmentText, roomKind === opt.key && styles.segmentTextActive]}>{opt.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              ) : (
                <>
                  <Field label="Number of single rooms" value={numSingle} onChangeText={setNumSingle} keyboardType="numeric" placeholder="0" />
                  <Field label="Number of shared rooms" value={numShared} onChangeText={setNumShared} keyboardType="numeric" placeholder="0" />
                </>
              )}
              <Field
                label="Total capacity"
                value={type === 'single_room' && roomKind === 'single' ? '1' : capacity}
                onChangeText={setCapacity}
                editable={!(type === 'single_room' && roomKind === 'single')}
                keyboardType="numeric"
                placeholder="0"
                style={type === 'single_room' && roomKind === 'single' ? { backgroundColor: '#F3F4F6' } : undefined}
              />

              <Text style={styles.label}>Cost type</Text>
              <View style={styles.segment}>
                {COST_TYPES.map(opt => (
                  <Pressable key={opt.key} onPress={() => setCostType(opt.key)} style={[styles.segmentItem, costType === opt.key && styles.segmentItemActive]}>
                    <Text style={[styles.segmentText, costType === opt.key && styles.segmentTextActive]}>{opt.label}</Text>
                  </Pressable>
                ))}
              </View>
              <Field label="Cost (price)" value={cost} onChangeText={setCost} keyboardType="decimal-pad" placeholder="0.00" />
            </View>
          )}

          {step === 2 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Location & Details</Text>
              <Text style={styles.label}>District</Text>
              <Pressable onPress={() => setDistrictOpen(true)} style={[styles.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
                <Text style={{ color: district ? '#11181C' : '#9CA3AF' }}>{district || 'Select district'}</Text>
                <Text style={{ color: '#6b7280' }}>▼</Text>
              </Pressable>

              <Modal visible={districtOpen} animationType="slide" transparent>
                <View style={styles.modalBackdrop}>
                  <View style={styles.modalCard}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Text style={[styles.cardTitle, { marginBottom: 0 }]}>Select district</Text>
                      <TouchableOpacity onPress={() => setDistrictOpen(false)}>
                        <Text style={{ color: '#6b7280', fontWeight: '700' }}>Close</Text>
                      </TouchableOpacity>
                    </View>
                    <ScrollView style={{ maxHeight: 360 }}>
                      {DISTRICTS.map((d) => (
                        <TouchableOpacity key={d} style={styles.optionRow} onPress={() => { setDistrict(d); setDistrictOpen(false); }}>
                          <Text style={{ color: '#11181C' }}>{d}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                </View>
              </Modal>

              <View style={styles.mapCard}>
                <MapView
                  style={styles.map}
                  provider={PROVIDER_GOOGLE}
                  onPress={onMapPress}
                  onTouchStart={onMapTouchStart}
                  onTouchEnd={onMapTouchEnd}
                  initialRegion={mapRegion ?? {
                    latitude: 7.8731,
                    longitude: 80.7718,
                    latitudeDelta: 0.05,
                    longitudeDelta: 0.05,
                  }}
                  region={mapRegion ?? undefined}
                >
                  <Marker
                    coordinate={{
                      latitude: parseFloat(latitude || String(mapRegion?.latitude ?? 7.8731)),
                      longitude: parseFloat(longitude || String(mapRegion?.longitude ?? 80.7718)),
                    }}
                    draggable
                    onDragStart={onMarkerDragStart}
                    onDragEnd={(e) => { onMarkerDragEnd(e); onMapTouchEnd(); }}
                  />
                </MapView>
                <Text style={styles.hintText}>Hold and drag the pin to edit location</Text>
                <View style={styles.mapActions}>
                  <Pressable onPress={useMyLocation} style={styles.chipBtn}>
                    <Text style={styles.chipText}>Use my location</Text>
                  </Pressable>
                  <Text style={styles.coordsText} numberOfLines={1}>
                    {latitude && longitude ? `${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)}` : 'Tap/drag to set location'}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {step === 3 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Details & Images</Text>
              <Text style={styles.label}>Description</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Tell more about your property..."
                placeholderTextColor="#9CA3AF"
                multiline
                style={[styles.input, { minHeight: 100 }]}
              />
              <Text style={styles.label}>Cover image</Text>
              {coverUri ? (
                <Pressable onPress={() => { setPickerForCover(true); setPickerOpen(true); }} style={styles.coverWrapper}>
                  <Image source={{ uri: coverUri }} style={styles.cover} contentFit="cover" cachePolicy="none" />
                  <View style={styles.coverOverlay}><Text style={styles.coverOverlayText}>Change cover</Text></View>
                </Pressable>
              ) : (
                <Pressable onPress={() => { setPickerForCover(true); setPickerOpen(true); }} style={styles.coverPlaceholder}>
                  <Text style={{ color: MUTED, fontWeight: '700' }}>Add cover photo</Text>
                  <Text style={{ color: MUTED, fontSize: 12 }}>Recommended 4:3</Text>
                </Pressable>
              )}

              <Text style={[styles.label, { marginTop: 12 }]}>More images</Text>
              <View style={styles.grid}>
                {gallery.map((g, i) => (
                  <View key={`${g}-${i}`} style={{ position: 'relative' }}>
                    <Image source={{ uri: g }} style={styles.thumb} contentFit="cover" cachePolicy="none" />
                    <Pressable onPress={() => removeGalleryAt(i)} style={styles.removeTag}><Text style={{ color: '#fff', fontWeight: '800' }}>×</Text></Pressable>
                  </View>
                ))}
                <Pressable onPress={() => { setPickerForCover(false); setPickerOpen(true); }} style={styles.addTile}>
                  <Text style={styles.addTilePlus}>＋</Text>
                  <Text style={styles.addTileText}>Add photo</Text>
                </Pressable>
              </View>

              {gallery.length < 2 && (
                <Text style={{ color: '#EF4444', marginTop: 8, fontWeight: '600' }}>Please add at least 2 images.</Text>
              )}
            </View>
          )}

          {step === 4 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Facilities & Utilities</Text>
              <Text style={{ color: MUTED, marginBottom: 8 }}>
                Choose amenities available for this property and how utility bills are handled.
              </Text>

              <Text style={styles.label}>Amenities</Text>
              <View style={styles.facRow}>
                <Pressable onPress={() => setWifi(v => !v)} style={[styles.facChip, wifi && styles.facChipActive]}>
                  <Text style={[styles.facChipText, wifi && styles.facChipTextActive]}>Wi‑Fi</Text>
                </Pressable>
                <Pressable onPress={() => setKitchen(v => !v)} style={[styles.facChip, kitchen && styles.facChipActive]}>
                  <Text style={[styles.facChipText, kitchen && styles.facChipTextActive]}>Kitchen</Text>
                </Pressable>
                <Pressable onPress={() => setWashingMachine(v => !v)} style={[styles.facChip, washingMachine && styles.facChipActive]}>
                  <Text style={[styles.facChipText, washingMachine && styles.facChipTextActive]}>Washing machine</Text>
                </Pressable>
                <Pressable onPress={() => setGym(v => !v)} style={[styles.facChip, gym && styles.facChipActive]}>
                  <Text style={[styles.facChipText, gym && styles.facChipTextActive]}>Gym</Text>
                </Pressable>
                <Pressable onPress={() => setCctv(v => !v)} style={[styles.facChip, cctv && styles.facChipActive]}>
                  <Text style={[styles.facChipText, cctv && styles.facChipTextActive]}>CCTV</Text>
                </Pressable>
                <Pressable onPress={() => setParking(v => !v)} style={[styles.facChip, parking && styles.facChipActive]}>
                  <Text style={[styles.facChipText, parking && styles.facChipTextActive]}>Parking</Text>
                </Pressable>
              </View>

              <Text style={[styles.label, { marginTop: 12 }]}>Water bill</Text>
              <View style={styles.segment}>
                {(['property','visitor'] as BillPolicy[]).map((opt) => (
                  <Pressable key={opt} onPress={() => setWaterPolicy(opt)} style={[styles.segmentItem, waterPolicy === opt && styles.segmentItemActive]}>
                    <Text style={[styles.segmentText, waterPolicy === opt && styles.segmentTextActive]}>{opt === 'property' ? 'Paid by property' : 'Paid by visitor'}</Text>
                  </Pressable>
                ))}
              </View>
              {waterPolicy === 'visitor' && (
                <>
                  <Field label="Approximate water bill (per month)" value={waterCost} onChangeText={setWaterCost} keyboardType="decimal-pad" placeholder="0.00" />
                  <Text style={{ color: MUTED, fontSize: 12 }}>Enter an average monthly amount to help set expectations.</Text>
                </>
              )}

              <Text style={[styles.label, { marginTop: 8 }]}>Electricity bill</Text>
              <View style={styles.segment}>
                {(['property','visitor'] as BillPolicy[]).map((opt) => (
                  <Pressable key={opt} onPress={() => setElectricPolicy(opt)} style={[styles.segmentItem, electricPolicy === opt && styles.segmentItemActive]}>
                    <Text style={[styles.segmentText, electricPolicy === opt && styles.segmentTextActive]}>{opt === 'property' ? 'Paid by property' : 'Paid by visitor'}</Text>
                  </Pressable>
                ))}
              </View>
              {electricPolicy === 'visitor' && (
                <>
                  <Field label="Approximate electricity bill (per month)" value={electricCost} onChangeText={setElectricCost} keyboardType="decimal-pad" placeholder="0.00" />
                  <Text style={{ color: MUTED, fontSize: 12 }}>A rough monthly amount is fine.</Text>
                </>
              )}
            </View>
          )}
        </View>
        {/* Spacer so content isn't hidden behind fixed footer */}
        <View style={{ height: 110 }} />
    </>
  );

  const canSubmit = (
    gallery.length >= 2 &&
    (waterPolicy === 'property' || !!waterCost) &&
    (electricPolicy === 'property' || !!electricCost)
  );

  const Footer = (
    <View
      style={[
        styles.footerBar,
        {
          // Lift above the tab bar when embedded; keep a smaller lift otherwise
          bottom: (embedded ? 64 : 48),
          paddingBottom: 16 + (insets.bottom || 0),
        },
      ]}
    >
      {step > 1 && (
        <Pressable
          onPress={back}
          style={[styles.navBtn, { backgroundColor: '#fff', borderColor: BORDER, borderWidth: 1 }]}
        >
          <Text style={[styles.navText, { color: TEXT }]}>Back</Text>
        </Pressable>
      )}
      {step < 4 && (
        <Pressable onPress={next} style={[styles.navBtn, { backgroundColor: GREEN }]}>
          <Text style={[styles.navText, { color: '#fff' }]}>Next</Text>
        </Pressable>
      )}
      {step === 4 && (
        <Pressable
          disabled={submitting || !canSubmit}
          onPress={submit}
          style={[styles.navBtn, { backgroundColor: GREEN, opacity: (submitting || !canSubmit) ? 0.5 : 1 }]}
        >
          <Text style={[styles.navText, { color: '#fff' }]}>
            {submitting
              ? 'Saving…'
              : (gallery.length < 2
                  ? 'Add 2+ images'
                  : ((waterPolicy === 'visitor' && !waterCost) || (electricPolicy === 'visitor' && !electricCost))
                      ? 'Enter bill costs'
                      : 'Save property')}
          </Text>
        </Pressable>
      )}
    </View>
  );

  if (embedded) {
    return (
      <View style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.select({ ios: 'padding', android: undefined })}
          style={{ flex: 1 }}
        >
          <ScrollView scrollEnabled={scrollEnabled} contentContainerStyle={{ paddingVertical: 8 }}>{Content}</ScrollView>
        </KeyboardAvoidingView>
        {Footer}
        {/* Image source picker (embedded) */}
        <Modal visible={pickerOpen} animationType="slide" transparent>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={[styles.cardTitle, { marginBottom: 8 }]}>{pickerForCover ? 'Cover photo' : 'Add photo'}</Text>
              <TouchableOpacity style={styles.optionRow} onPress={() => pickImage('camera', pickerForCover)}>
                <Text style={{ color: TEXT, fontWeight: '700' }}>Take photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.optionRow} onPress={() => pickImage('library', pickerForCover)}>
                <Text style={{ color: TEXT, fontWeight: '700' }}>Choose from library</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.optionRow, { borderBottomWidth: 0 }]} onPress={() => setPickerOpen(false)}>
                <Text style={{ color: MUTED, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.select({ ios: 'padding', android: undefined })}
          style={{ flex: 1 }}
        >
          <ScrollView scrollEnabled={scrollEnabled} contentContainerStyle={{ paddingVertical: 8 }}>{Content}</ScrollView>
        </KeyboardAvoidingView>
        {Footer}
        {/* Image source picker */}
        <Modal visible={pickerOpen} animationType="slide" transparent>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={[styles.cardTitle, { marginBottom: 8 }]}>{pickerForCover ? 'Cover photo' : 'Add photo'}</Text>
              <TouchableOpacity style={styles.optionRow} onPress={() => pickImage('camera', pickerForCover)}>
                <Text style={{ color: TEXT, fontWeight: '700' }}>Take photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.optionRow} onPress={() => pickImage('library', pickerForCover)}>
                <Text style={{ color: TEXT, fontWeight: '700' }}>Choose from library</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.optionRow, { borderBottomWidth: 0 }]} onPress={() => setPickerOpen(false)}>
                <Text style={{ color: MUTED, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

function Field(props: any) {
  const { label, style, ...rest } = props;
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...rest}
        style={[styles.input, style]}
        placeholderTextColor="#9CA3AF"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '800', color: TEXT },
  progressRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, marginBottom: 12 },
  progressTrack: { flex: 1, height: 8, backgroundColor: BORDER, borderRadius: 6, overflow: 'hidden', marginRight: 8 },
  progressBar: { height: 8, backgroundColor: GREEN },
  progressText: { color: TEXT, fontWeight: '700' },

  card: { borderWidth: 1, borderColor: BORDER, borderRadius: 12, padding: 12, backgroundColor: '#fff', marginTop: 8 },
  cardTitle: { fontWeight: '800', color: TEXT, marginBottom: 8 },

  label: { marginBottom: 6, color: '#374151', fontWeight: '600' },
  input: { borderWidth: 1, borderColor: BORDER, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: '#fff' },

  segment: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  segmentItem: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: BORDER, backgroundColor: '#fff' },
  segmentItemActive: { backgroundColor: '#E6FFF5', borderColor: GREEN },
  segmentText: { color: TEXT, fontWeight: '700' },
  segmentTextActive: { color: GREEN },

  outlineBtn: { height: 44, borderRadius: 10, borderWidth: 1, borderColor: GREEN, alignItems: 'center', justifyContent: 'center' },
  outlineText: { color: GREEN, fontWeight: '800' },

  cover: { width: '100%', height: 160, borderRadius: 10, borderWidth: 1, borderColor: BORDER, backgroundColor: '#F9FAFB', marginBottom: 8 },
  coverWrapper: { position: 'relative' },
  coverOverlay: { position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  coverOverlayText: { color: '#fff', fontWeight: '800' },
  coverPlaceholder: { height: 160, borderRadius: 10, borderWidth: 1, borderColor: BORDER, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  thumb: { width: 100, height: 70, borderRadius: 8, borderWidth: 1, borderColor: BORDER, backgroundColor: '#F9FAFB' },
  removeTag: { position: 'absolute', top: -8, right: -8, width: 24, height: 24, borderRadius: 12, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center' },

  navBtn: { flex: 1, height: 48,width: '100%', borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  navText: { fontWeight: '800' },
  mapCard: { borderWidth: 1, borderColor: BORDER, borderRadius: 12, overflow: 'hidden', marginTop: 8, backgroundColor: '#fff' },
  map: { width: '100%', height: 340 },
  mapActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10 },
  chipBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: '#E6FFF5', borderWidth: 1, borderColor: GREEN },
  chipText: { color: GREEN, fontWeight: '800' },
  coordsText: { color: TEXT, fontWeight: '600', maxWidth: '55%' },
  hintText: { color: MUTED, fontSize: 12, paddingHorizontal: 12, paddingTop: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  addTile: { width: 100, height: 70, borderRadius: 8, borderWidth: 1, borderColor: BORDER, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  addTilePlus: { fontSize: 20, color: MUTED, fontWeight: '800', lineHeight: 20 },
  addTileText: { color: MUTED, fontSize: 12, marginTop: 4, fontWeight: '700' },
  footerBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -10,
    paddingTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', padding: 20, justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderRadius: 16, padding: 12, maxHeight: '85%' },
  optionRow: { paddingVertical: 12, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: BORDER },
  // Facilities styles
  facRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  facChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: BORDER, backgroundColor: '#fff' },
  facChipActive: { backgroundColor: '#E6FFF5', borderColor: GREEN },
  facChipText: { color: TEXT, fontWeight: '700' },
  facChipTextActive: { color: GREEN },
});

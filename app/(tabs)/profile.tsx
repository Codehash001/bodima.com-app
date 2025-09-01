import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  const [userId, setUserId] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [role, setRole] = useState<'owner' | 'seeker' | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) return;
      const user = data.user;
      setUserId(user.id);
      setEmail(user.email || '');
      const appMeta = (user.app_metadata || {}) as any;
      const r = (appMeta.role as 'owner' | 'seeker' | undefined) || null;
      setRole(r ?? null);

      // Load non-table fields from user metadata for now
      const meta = (user.user_metadata || {}) as any;
      setLocation(meta.location || '');
      setBio(meta.bio || '');

      // Load profile from the appropriate table
      if (r) {
        const table = r === 'owner' ? 'property_owner' : 'room_seeker';
        const { data: row } = await supabase.from(table).select('*').eq('user_id', user.id).maybeSingle();
        if (row) {
          setFullName(row.full_name || '');
          setPhone(row.phone || '');
          // Add cache-busting to avoid CDN/image cache showing stale avatar
          const url = row.avatar_url ? `${row.avatar_url}?v=${Date.now()}` : '';
          setAvatarUrl(url);
        }
      }
    };
    load();
  }, []);

  const fields = useMemo(() => [
    { key: 'full_name', value: fullName },
    { key: 'phone', value: phone },
    { key: 'location', value: location },
    { key: 'bio', value: bio },
    { key: 'avatar_url', value: avatarUrl },
  ], [fullName, phone, location, bio, avatarUrl]);

  const completion = useMemo(() => {
    const total = fields.length;
    const done = fields.filter(f => String(f.value || '').trim().length > 0).length;
    return Math.round((done / total) * 100);
  }, [fields]);

  const onSave = async () => {
    try {
      setLoading(true);
      // Update profile table fields if role is known
      if (role && userId) {
        const table = role === 'owner' ? 'property_owner' : 'room_seeker';
        const { error: upErr } = await supabase
          .from(table)
          .update({ full_name: fullName, phone, avatar_url: avatarUrl })
          .eq('user_id', userId);
        if (upErr) throw upErr;
      }

      // Keep extra fields in user metadata for now
      const { error: metaErr } = await supabase.auth.updateUser({ data: { location, bio } });
      if (metaErr) throw metaErr;
      Alert.alert('Saved', 'Your profile has been updated.');
    } catch (e: any) {
      Alert.alert('Update failed', e.message || 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  const onLogout = async () => {
    try {
      setSigningOut(true);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      // Also navigate immediately for responsive UX
      router.replace({ pathname: '/auth/login' });
    } catch (e: any) {
      Alert.alert('Sign out failed', e.message || 'Please try again');
    } finally {
      setSigningOut(false);
    }
  };

  const onPickAvatar = async () => {
    try {
      setUploading(true);
      // Ensure authenticated session
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session || !userId) {
        throw new Error('Not authenticated. Please sign in again.');
      }
      // Ask permission
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow photo library access to upload an avatar.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      const uri = asset.uri;

      // Read file bytes reliably in React Native to avoid 0-byte uploads
      const res = await fetch(uri);
      const ab = await res.arrayBuffer();
      const bytes = new Uint8Array(ab);
      if (!bytes || bytes.byteLength === 0) {
        throw new Error('Selected image resulted in 0 bytes. Please choose a different image.');
      }
      const ext = (asset.fileName?.split('.').pop() || 'jpg').toLowerCase();
      const contentType = asset.mimeType ||
        (ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg');
      // Path must be relative to the bucket. Do not prefix with 'avatars/'.
      const filePath = `${userId}/${Date.now()}.${ext}`;

      // If an old avatar exists, try to remove it to keep storage clean
      if (avatarUrl) {
        try {
          // avatarUrl looks like: {SUPABASE_URL}/storage/v1/object/public/avatars/<path>?v=...
          const marker = '/storage/v1/object/public/avatars/';
          const idx = avatarUrl.indexOf(marker);
          if (idx !== -1) {
            const after = avatarUrl.substring(idx + marker.length);
            const oldPath = after.split('?')[0];
            if (oldPath) {
              await supabase.storage.from('avatars').remove([oldPath]);
            }
          }
        } catch (e) {
          // Ignore delete errors (e.g., already deleted or permission)
        }
      }

      // Upload to bucket 'avatars' (must exist and be public or use signed URLs)
      const { error: upErr } = await supabase.storage.from('avatars').upload(filePath, bytes, {
        contentType,
        // Avoid UPDATE path so RLS for UPDATE (owner) won't block if prior file wasn't owned
        upsert: false,
      });
      if (upErr) {
        // Surface detailed error to help diagnose RLS/policy issues
        throw new Error(`Storage upload error: ${upErr.message || upErr.name || 'unknown'} (path=${filePath})`);
      }

      // Get public URL (add cache-busting query to avoid CDN delay)
      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const publicUrl = pub.publicUrl;
      const publicUrlWithTs = `${publicUrl}?v=${Date.now()}`;

      // Save avatar to profile table
      if (role && userId) {
        const table = role === 'owner' ? 'property_owner' : 'room_seeker';
        const { error: updErr } = await supabase.from(table).update({ avatar_url: publicUrl }).eq('user_id', userId);
        if (updErr) throw updErr;
      }

      setAvatarUrl(publicUrlWithTs);
      Alert.alert('Avatar updated', 'Your profile photo has been uploaded.');
    } catch (e: any) {
      Alert.alert('Upload failed', e.message || 'Please try again');
    } finally {
      setUploading(false);
    }
  };

  const initials = useMemo(() => (email?.[0] || '?').toUpperCase(), [email]);
  const bgColor = useMemo(() => colorFromString(email || 'user'), [email]);

  const avatarSource = avatarUrl ? { uri: avatarUrl } : null;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            {avatarSource ? (
              <Image
                source={avatarSource}
                style={styles.avatar}
                contentFit="cover"
                cachePolicy="none"
                onError={() => {
                  Alert.alert('Avatar not visible', 'Image failed to load. Please wait a moment and try again.');
                }}
              />
            ) : (
              <View style={[styles.avatar, styles.initialsAvatar, { backgroundColor: bgColor }]}>
                <Text style={styles.initialsText}>{initials}</Text>
              </View>
            )}
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={styles.email}>{email}</Text>
              <View style={styles.progressRow}>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressBar, { width: `${completion}%` }]} />
                </View>
                <Text style={styles.progressText}>{completion}%</Text>
              </View>
              {completion < 100 && (
                <Text style={styles.hint}>Complete your profile to get better matches</Text>
              )}
            </View>
          </View>

          <Pressable onPress={onPickAvatar} disabled={uploading} style={[styles.photoBtn, uploading && { opacity: 0.7 }]}>
            <Text style={styles.photoBtnText}>{uploading ? 'Uploading…' : (avatarUrl ? 'Change photo' : 'Add photo')}</Text>
          </Pressable>

          {/* Form */}
          <Text style={styles.sectionTitle}>Profile details</Text>

          <Field label="Full name" value={fullName} onChangeText={setFullName} placeholder="e.g. John Doe" />
          <Field label="Phone" value={phone} onChangeText={setPhone} placeholder="e.g. +94 77 123 4567" keyboardType="phone-pad" />
          <Field label="Location" value={location} onChangeText={setLocation} placeholder="City, Country" />
          <Field label="Bio" value={bio} onChangeText={setBio} placeholder="Tell others about you" multiline />

          <Pressable onPress={onSave} disabled={loading} style={[styles.saveBtn, loading && { opacity: 0.7 }]}>
            <Text style={styles.saveText}>{loading ? 'Saving…' : 'Save changes'}</Text>
          </Pressable>

          <Pressable onPress={onLogout} disabled={signingOut} style={[styles.logoutBtn, signingOut && { opacity: 0.7 }]}>
            <Text style={styles.logoutText}>{signingOut ? 'Signing out…' : 'Log out'}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
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

function colorFromString(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 60%, 75%)`;
}

const GREEN = '#16C784';
const RED = '#EF4444';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: { width: 72, height: 72, borderRadius: 36, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' },
  initialsAvatar: { alignItems: 'center', justifyContent: 'center' },
  initialsText: { fontSize: 24, fontWeight: '800', color: '#11181C' },
  email: { fontWeight: '800', color: '#11181C' },
  progressRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  progressTrack: { flex: 1, height: 8, backgroundColor: '#E5E7EB', borderRadius: 6, overflow: 'hidden', marginRight: 8 },
  progressBar: { height: 8, backgroundColor: GREEN },
  progressText: { fontWeight: '700', color: '#11181C' },
  hint: { color: '#6b7280', marginTop: 4 },

  photoBtn: { marginBottom: 16, height: 44, borderRadius: 10, borderWidth: 1, borderColor: GREEN, alignItems: 'center', justifyContent: 'center' },
  photoBtnText: { color: GREEN, fontWeight: '800' },

  sectionTitle: { fontWeight: '800', color: '#11181C', marginBottom: 8 },
  label: { marginBottom: 6, color: '#374151', fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: '#fff',
  },
  saveBtn: { marginTop: 12, height: 48, borderRadius: 10, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: '#fff', fontWeight: '800' },
  logoutBtn: { marginTop: 12, height: 48, borderRadius: 10, borderWidth: 1, borderColor: RED, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  logoutText: { color: RED, fontWeight: '800' },
});

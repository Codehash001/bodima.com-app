import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, SafeAreaView as RNSafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

const GREEN = Colors.light.tint;
const BORDER = '#E5E7EB';
const TEXT = '#11181C';
const MUTED = '#6b7280';

type Msg = {
  message_id: string;
  conversation_id: string;
  sender_type: 'seeker' | 'owner';
  sender_id: string;
  body: string;
  ack_status: 'sent' | 'delivered' | 'seen';
  created_at: string;
};

export default function ThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const listRef = useRef<FlatList<Msg>>(null);
  const [conv, setConv] = useState<{ seeker_id: string; owner_id: string; property_id: string | null } | null>(null);
  const [propInfo, setPropInfo] = useState<{ property_id: string; cover_image_url: string | null; district: string | null; type: string | null } | null>(null);
  const [otherProfile, setOtherProfile] = useState<{ id: string; full_name: string | null; avatar_url: string | null } | null>(null);
  const [meProfile, setMeProfile] = useState<{ id: string; full_name: string | null; avatar_url: string | null } | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      // load conversation basics (for membership + property)
      const { data: convRow } = await supabase
        .from('conversations')
        .select('seeker_id, owner_id, property_id')
        .eq('conversation_id', id)
        .maybeSingle();
      setConv(convRow ?? null);
      if (convRow?.property_id) {
        const { data: prop } = await supabase
          .from('property')
          .select('property_id, cover_image_url, district, type')
          .eq('property_id', convRow.property_id)
          .maybeSingle();
        if (prop) setPropInfo(prop as any);
      }
      // Load participant profiles (other + me)
      if (user?.id && convRow) {
        const otherId = convRow.owner_id === user.id ? convRow.seeker_id : convRow.owner_id;
        const [{ data: other }, { data: me }] = await Promise.all([
          supabase.from('profiles').select('id, full_name, avatar_url').eq('id', otherId).maybeSingle(),
          supabase.from('profiles').select('id, full_name, avatar_url').eq('id', user.id).maybeSingle(),
        ]);
        if (other) setOtherProfile(other as any);
        if (me) setMeProfile(me as any);
      }
      const { data, error } = await supabase
        .from('messages')
        .select('message_id, conversation_id, sender_type, sender_id, body, ack_status, created_at')
        .eq('conversation_id', id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setMsgs(data ?? []);
      // mark other's messages as seen and reset unread counters
      if (user?.id) {
        await supabase
          .from('messages')
          .update({ ack_status: 'seen', seen_at: new Date().toISOString() })
          .eq('conversation_id', id)
          .neq('sender_id', user.id)
          .neq('ack_status', 'seen');

        // reset unread counts on conversation for current viewer
        const { data: conv } = await supabase
          .from('conversations')
          .select('seeker_id, owner_id')
          .eq('conversation_id', id)
          .maybeSingle();
        if (conv) {
          if (conv.owner_id === user.id) {
            await supabase.from('conversations').update({ owner_unread_count: 0 }).eq('conversation_id', id);
          } else if (conv.seeker_id === user.id) {
            await supabase.from('conversations').update({ seeker_unread_count: 0 }).eq('conversation_id', id);
          }
        }
      }
    } catch (e) {
      // noop basic
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  // Fallback: ensure native header is hidden even if group options don't apply
  useEffect(() => { (navigation as any)?.setOptions?.({ headerShown: false }); }, [navigation]);

  const onSend = useCallback(async () => {
    if (!text.trim() || !userId) return;
    try {
      setSending(true);
      // Determine sender_type: requires checking conversation membership
      const { data: conv2 } = await supabase
        .from('conversations')
        .select('seeker_id, owner_id')
        .eq('conversation_id', id)
        .maybeSingle();
      const sender_type: 'seeker' | 'owner' = conv2?.owner_id === userId ? 'owner' : 'seeker';

      const { data, error } = await supabase
        .from('messages')
        .insert({ conversation_id: id, sender_type, sender_id: userId, body: text.trim() })
        .select('message_id, conversation_id, sender_type, sender_id, body, ack_status, created_at')
        .single();
      if (error) throw error;
      setMsgs((prev) => [...prev, data!]);
      setText('');
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 0);
    } finally {
      setSending(false);
    }
  }, [id, text, userId]);

  const renderItem = ({ item, index }: { item: Msg; index: number }) => {
    const isMine = item.sender_id === userId;
    const prev = index > 0 ? msgs[index - 1] : undefined;
    const next = index < msgs.length - 1 ? msgs[index + 1] : undefined;
    const prevSameSender = !!prev && prev.sender_id === item.sender_id;
    const nextSameSender = !!next && next.sender_id === item.sender_id;
    const showLeftAvatar = !isMine && !prevSameSender; // only on first of group
    const showRightAvatar = isMine && !prevSameSender;
    const leftAvatar = otherProfile?.avatar_url;
    const leftInitial = (otherProfile?.full_name || 'U').trim().charAt(0).toUpperCase();
    const rightAvatar = meProfile?.avatar_url;
    const rightInitial = (meProfile?.full_name || 'Y').trim().charAt(0).toUpperCase();
    return (
      <View style={[styles.msgRow, isMine ? styles.mine : styles.theirs]}>
        {!isMine && showLeftAvatar && (
          leftAvatar ? (
            <Image source={{ uri: leftAvatar }} style={styles.avatarImg} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, { backgroundColor: '#E2E8F0' }]}>
              <Text style={styles.avatarText}>{leftInitial}</Text>
            </View>
          )
        )}
        <View style={[
          styles.bubble,
          isMine ? styles.bubbleMine : styles.bubbleTheirs,
          // tweak corners when grouped
          isMine && nextSameSender ? { borderBottomRightRadius: 6 } : null,
          !isMine && nextSameSender ? { borderBottomLeftRadius: 6 } : null,
        ]}>
          <Text style={[styles.body, isMine ? { color: '#fff' } : { color: TEXT }]}>{item.body}</Text>
          <View style={styles.metaRow}>
            <Text style={[styles.time, isMine ? { color: 'rgba(255,255,255,0.8)' } : {}]}>{formatTime(item.created_at)}</Text>
            {isMine && (
              <View style={styles.ack}>
                {item.ack_status === 'sent' && <Ionicons name="checkmark" size={14} color={'rgba(255,255,255,0.9)'} />}
                {item.ack_status === 'delivered' && <Ionicons name="checkmark" size={14} color={'rgba(255,255,255,0.9)'} />}
                {item.ack_status === 'seen' && <Ionicons name="checkmark-done" size={16} color={'#22d3ee'} />}
              </View>
            )}
          </View>
        </View>
        {isMine && showRightAvatar && (
          rightAvatar ? (
            <Image source={{ uri: rightAvatar }} style={styles.avatarImg} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, { backgroundColor: '#DCFCE7' }]}>
              <Text style={styles.avatarText}>{rightInitial}</Text>
            </View>
          )
        )}
      </View>
    );
  };

  const propLabel = useMemo(() => {
    if (!propInfo) return '';
    const type = mapType(propInfo.type);
    const loc = propInfo.district || '';
    return `${type}${loc ? ' • ' + loc : ''}`;
  }, [propInfo]);
  const otherName = useMemo(() => otherProfile?.full_name || 'User', [otherProfile]);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.container}>
      {/* Custom header: participant avatar + name, with property label as subtext */}
      <View style={[styles.headerBar, { paddingTop: insets.top }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={GREEN} />
        </Pressable>
        <View style={styles.headerIdentity}>
          {otherProfile?.avatar_url ? (
            <Image source={{ uri: otherProfile.avatar_url }} style={styles.userAvatar} contentFit="cover" />
          ) : (
            <View style={[styles.userAvatar, { backgroundColor: '#E2E8F0' }]}>
              <Text style={styles.avatarText}>{(otherProfile?.full_name || 'U').trim().charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={styles.userName}>{otherName}</Text>
            {!!propLabel && <Text numberOfLines={1} style={styles.propSub}>{propLabel}</Text>}
          </View>
        </View>
        <View style={{ width: 40 }} />
      </View>
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={GREEN} />
        </View>
      ) : (
        <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={{ flex: 1 }} keyboardVerticalOffset={insets.bottom + 96}>
          <FlatList
            ref={listRef}
            data={msgs}
            keyExtractor={(m) => m.message_id}
            renderItem={renderItem}
            contentContainerStyle={{ padding: 12, gap: 12 }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          />
          <View style={[styles.composerBar, { paddingBottom: 8 + insets.bottom }]}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Type a message"
              placeholderTextColor={MUTED}
              style={styles.input}
              multiline
            />
            <Pressable style={[styles.sendBtn, sending || !text.trim() ? { opacity: 0.5 } : null]} disabled={sending || !text.trim()} onPress={onSend}>
              <Ionicons name="send" size={18} color="#fff" />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

function formatTime(ts: string) {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  headerBar: { borderBottomWidth: 1, borderBottomColor: BORDER, paddingHorizontal: 12, paddingBottom: 8, backgroundColor: '#fff' },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  propCardMini: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: -4, paddingBottom: 6 },
  headerIdentity: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: -4, paddingBottom: 6, flex: 1 },
  userAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  userName: { fontWeight: '800', color: TEXT },
  propThumb: { width: 44, height: 44, borderRadius: 8, backgroundColor: '#eee' },
  propTitle: { fontWeight: '800', color: TEXT },
  propSub: { fontSize: 12, color: MUTED },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  mine: { justifyContent: 'flex-end' },
  theirs: { justifyContent: 'flex-start' },
  avatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: 28, height: 28, borderRadius: 14 },
  bubble: { maxWidth: '78%', borderRadius: 16, paddingVertical: 10, paddingHorizontal: 14 },
  bubbleMine: { backgroundColor: GREEN, borderTopRightRadius: 6, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  bubbleTheirs: { backgroundColor: '#F3F4F6', borderTopLeftRadius: 6 },
  body: { fontSize: 15 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  time: { fontSize: 11, color: MUTED },
  ack: { marginLeft: 2 },
  composerBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: BORDER, backgroundColor: '#fff' },
  input: { flex: 1, minHeight: 44, maxHeight: 120, borderWidth: 1, borderColor: BORDER, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#fff' },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '700', color: TEXT },
});

function mapType(t?: string | null) {
  switch (t) {
    case 'single_room': return 'Single room';
    case 'multiple_rooms': return 'Multiple rooms';
    case 'hostel': return 'Hostel';
    default: return 'Property';
  }
}

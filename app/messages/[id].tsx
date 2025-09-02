import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

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

type ViewingRequest = {
  request_id: string;
  seeker_id: string;
  owner_id: string;
  property_id: string;
  requested_at: string;
  status: 'pending' | 'accepted' | 'declined';
  decline_reason: string | null;
  created_at: string;
};

export default function ThreadScreen() {
  const { id, pid } = useLocalSearchParams<{ id: string; pid?: string }>();
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
  const [requests, setRequests] = useState<ViewingRequest[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerDate, setPickerDate] = useState<Date>(new Date(Date.now() + 60 * 60 * 1000));

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
      const propIdToLoad = convRow?.property_id || pid;
      if (propIdToLoad) {
        const { data: prop } = await supabase
          .from('property')
          .select('property_id, cover_image_url, district, type')
          .eq('property_id', propIdToLoad as string)
          .maybeSingle();
        if (prop) setPropInfo(prop as any);
      }
      // Load participant profiles (other + me) from role-specific tables so we get actual avatars
      if (user?.id && convRow) {
        const iAmOwner = convRow.owner_id === user.id;
        const otherIsSeeker = iAmOwner;
        const otherId = iAmOwner ? convRow.seeker_id : convRow.owner_id;

        const otherQuery = otherIsSeeker
          ? supabase.from('room_seeker').select('user_id, full_name, avatar_url').eq('user_id', otherId).maybeSingle()
          : supabase.from('property_owner').select('user_id, full_name, avatar_url').eq('user_id', otherId).maybeSingle();

        const meQuery = iAmOwner
          ? supabase.from('property_owner').select('user_id, full_name, avatar_url').eq('user_id', user.id).maybeSingle()
          : supabase.from('room_seeker').select('user_id, full_name, avatar_url').eq('user_id', user.id).maybeSingle();

        const [{ data: other }, { data: me }] = await Promise.all([otherQuery, meQuery]);
        if (other) setOtherProfile({ id: other.user_id, full_name: other.full_name, avatar_url: other.avatar_url });
        if (me) setMeProfile({ id: me.user_id, full_name: me.full_name, avatar_url: me.avatar_url });
      }
      const { data, error } = await supabase
        .from('messages')
        .select('message_id, conversation_id, sender_type, sender_id, body, ack_status, created_at')
        .eq('conversation_id', id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setMsgs(data ?? []);
      // Load viewing requests for this conversation participants
      if (convRow?.seeker_id && convRow?.owner_id) {
        const { data: reqs } = await supabase
          .from('viewing_requests')
          .select('request_id, seeker_id, owner_id, property_id, requested_at, status, decline_reason, created_at')
          .eq('seeker_id', convRow.seeker_id)
          .eq('owner_id', convRow.owner_id)
          .order('created_at', { ascending: true });
        setRequests(reqs ?? []);
      }
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

  const isOwner = useMemo(() => {
    return !!(userId && conv && conv.owner_id === userId);
  }, [userId, conv]);
  const isSeeker = useMemo(() => {
    return !!(userId && conv && conv.seeker_id === userId);
  }, [userId, conv]);

  const createViewingRequest = useCallback(async (date: Date) => {
    if (!userId || !conv || !propInfo) return;
    const payload = {
      seeker_id: conv.seeker_id,
      owner_id: conv.owner_id,
      property_id: propInfo.property_id,
      requested_at: date.toISOString(),
      status: 'pending' as const,
    };
    const { data, error } = await supabase
      .from('viewing_requests')
      .insert(payload)
      .select('request_id, seeker_id, owner_id, property_id, requested_at, status, decline_reason, created_at')
      .single();
    if (!error && data) setRequests((prev) => [...prev, data]);
  }, [userId, conv, propInfo]);

  const onPickDate = useCallback(() => {
    if (!isSeeker) return;
    setPickerVisible(true);
  }, [isSeeker]);

  const onAccept = useCallback(async (req: ViewingRequest) => {
    const { data, error } = await supabase
      .from('viewing_requests')
      .update({ status: 'accepted', decline_reason: null })
      .eq('request_id', req.request_id)
      .select('request_id, seeker_id, owner_id, property_id, requested_at, status, decline_reason, created_at')
      .single();
    if (!error && data) setRequests((prev) => prev.map(r => r.request_id === req.request_id ? data : r));
  }, []);

  const onDecline = useCallback(async (req: ViewingRequest, reason?: string) => {
    const { data, error } = await supabase
      .from('viewing_requests')
      .update({ status: 'declined', decline_reason: reason ?? null })
      .eq('request_id', req.request_id)
      .select('request_id, seeker_id, owner_id, property_id, requested_at, status, decline_reason, created_at')
      .single();
    if (!error && data) setRequests((prev) => prev.map(r => r.request_id === req.request_id ? data : r));
  }, []);

  const renderItem = ({ item, index }: { item: Msg; index: number }) => {
    const isMine = item.sender_id === userId;
    const prev = index > 0 ? msgs[index - 1] : undefined;
    const next = index < msgs.length - 1 ? msgs[index + 1] : undefined;
    const prevSameSender = !!prev && prev.sender_id === item.sender_id;
    const nextSameSender = !!next && next.sender_id === item.sender_id;
    const showLeftAvatar = !isMine && !prevSameSender; // only on first of group
    const leftAvatar = otherProfile?.avatar_url;
    const leftInitial = (otherProfile?.full_name || 'U').trim().charAt(0).toUpperCase();
    return (
      <View style={[styles.msgRow, isMine ? styles.mine : styles.theirs]}>
        {!isMine && !prevSameSender && (
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
          isMine && nextSameSender ? { borderBottomRightRadius: 8 } : null,
          !isMine && nextSameSender ? { borderBottomLeftRadius: 8 } : null,
        ]}>
          <Text style={[styles.body, isMine ? { color: '#fff' } : { color: TEXT }]}>{item.body}</Text>
          <View style={styles.metaInline}>
            <Text style={[styles.time, isMine ? { color: 'rgba(255,255,255,0.85)' } : { color: '#6b7280' }]}>{formatTime(item.created_at)}</Text>
            {isMine && (
              <View style={styles.ack}>
                {item.ack_status === 'sent' && <Ionicons name="checkmark" size={14} color={'rgba(255,255,255,0.9)'} />}
                {item.ack_status === 'delivered' && <Ionicons name="checkmark" size={14} color={'rgba(255,255,255,0.9)'} />}
                {item.ack_status === 'seen' && <Ionicons name="checkmark-done" size={16} color={'#22d3ee'} />}
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  // (removed) duplicate onPickDate moved below with seeker guard

  const propLabel = useMemo(() => {
    if (!propInfo) return '';
    const type = mapType(propInfo.type);
    const loc = propInfo.district || '';
    return `${type}${loc ? ' • ' + loc : ''}`;
  }, [propInfo]);
  const otherName = useMemo(() => {
    const fallback = conv && userId ? (conv.owner_id === userId ? 'Seeker' : 'Owner') : 'User';
    const n = (otherProfile?.full_name || '').trim();
    return n || fallback;
  }, [otherProfile, conv, userId]);

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
              <Pressable onPress={() => router.back()} style={[styles.backBtnAbsolute, { top: insets.top + 4 }] }>
          <Ionicons name="chevron-back" size={24} color={GREEN} />
        </Pressable>
      {/* Custom header: participant + property chip */}
      <View style={[styles.headerBar, { paddingTop: insets.top, height: 84 }]}> 
        <View style={[styles.headerCenter, { justifyContent: 'center', alignItems: 'center' }]}>
          {otherProfile?.avatar_url ? (
            <Image source={{ uri: otherProfile.avatar_url }} style={[styles.userAvatar, { width: 28, height: 28, marginRight: 8 }]} contentFit="cover" />
          ) : (
            <View style={[styles.userAvatar, { width: 28, height: 28, marginRight: 8, backgroundColor: '#E2E8F0' }]}> 
              <Text style={styles.avatarText}>{(otherName || 'U').trim().charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <Text numberOfLines={1} style={styles.userName}>{otherName}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>
      {propInfo?.property_id && (
        <Pressable
          onPress={() => router.push({ pathname: '/property/[id]', params: { id: propInfo.property_id } })}
          style={[styles.propHeaderCard, { marginTop: 16 }]}
        >
          {propInfo.cover_image_url ? (
            <Image source={{ uri: propInfo.cover_image_url }} style={styles.propHeaderImg} contentFit="cover" />
          ) : (
            <View style={[styles.propHeaderImg, { backgroundColor: '#F3F4F6' }]} />
          )}
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={styles.propHeaderTitle}>{mapType(propInfo.type)}</Text>
            <Text numberOfLines={1} style={styles.propHeaderSub}>{propInfo.district || ''}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={MUTED} />
        </Pressable>
      )}
      {/* Viewing request cards */}
      {requests?.length > 0 && (
        <View style={{ paddingHorizontal: 12, marginTop: 8, gap: 8 }}>
          {requests.map((req) => (
            <View key={req.request_id} style={styles.requestCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.requestTitle}>Viewing request</Text>
                <Text style={styles.requestSub}>{new Date(req.requested_at).toLocaleString()}</Text>
                <View style={styles.statusRow}>
                  <View style={[styles.statusPill, req.status === 'pending' ? styles.stPending : req.status === 'accepted' ? styles.stAccepted : styles.stDeclined]}>
                    <Text style={styles.statusText}>{req.status.toUpperCase()}</Text>
                  </View>
                  {req.status === 'declined' && !!req.decline_reason && (
                    <Text style={styles.declineText}>Reason: {req.decline_reason}</Text>
                  )}
                </View>
              </View>
              {isOwner && req.status === 'pending' && (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable style={[styles.smallBtn, { backgroundColor: '#10b981' }]} onPress={() => onAccept(req)}>
                    <Text style={styles.smallBtnText}>Accept</Text>
                  </Pressable>
                  <Pressable style={[styles.smallBtn, { backgroundColor: '#ef4444' }]} onPress={() => onDecline(req)}>
                    <Text style={styles.smallBtnText}>Decline</Text>
                  </Pressable>
                </View>
              )}
            </View>
          ))}
        </View>
      )}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={GREEN} />
        </View>
      ) : (
        <>
          <FlatList
            ref={listRef}
            data={msgs}
            keyExtractor={(m) => m.message_id}
            renderItem={renderItem}
            style={{ flex: 1 }}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 6, paddingBottom: 88 + insets.bottom, gap: 8 }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          />
          <KeyboardAvoidingView
            behavior={Platform.select({ ios: 'padding', android: undefined })}
            keyboardVerticalOffset={Platform.select({ ios: insets.bottom, android: 0 }) as number}
          >
            <View style={[styles.composerBar, { paddingBottom: 8 + insets.bottom }]}> 
              {isSeeker && (
              <Pressable onPress={onPickDate} style={styles.calendarBtn}>
                <Ionicons name="calendar" size={18} color={GREEN} />
              </Pressable>
              )}
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Type a message"
                placeholderTextColor={MUTED}
                style={styles.input}
                multiline
              />
              <Pressable
                style={[styles.sendBtn, sending || !text.trim() ? { opacity: 0.5 } : null]}
                disabled={sending || !text.trim()}
                onPress={onSend}
              >
                <Ionicons name="send" size={18} color="#fff" />
              </Pressable>
            </View>
          </KeyboardAvoidingView>

          {/* Date/Time Picker Modal */}
          <Modal visible={pickerVisible} transparent animationType="fade" onRequestClose={() => setPickerVisible(false)}>
            <View style={styles.modalBackdrop}>
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>Select date & time</Text>
                <DateTimePicker
                  value={pickerDate}
                  mode="datetime"
                  minimumDate={new Date()}
                  onChange={(event: any, d?: Date) => { if (d) setPickerDate(d); }}
                />
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                  <Pressable style={[styles.actionBtn, { backgroundColor: '#e5e7eb' }]} onPress={() => setPickerVisible(false)}>
                    <Text style={[styles.actionText, { color: '#111827' }]}>Cancel</Text>
                  </Pressable>
                  <Pressable style={[styles.actionBtn, { backgroundColor: GREEN }]} onPress={async () => { await createViewingRequest(pickerDate); setPickerVisible(false); }}>
                    <Text style={styles.actionText}>Send Request</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>
        </>
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
  headerBar: { borderBottomWidth: 1, borderBottomColor: BORDER, paddingHorizontal: 12, paddingBottom: 8, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', position: 'relative', minHeight: 72 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backBtnAbsolute: { position: 'absolute', left: 6, top: 0, width: 40, height: 40, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  headerCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, paddingLeft: 40, paddingRight: 40 },
  propCardMini: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: -4, paddingBottom: 6 },
  headerIdentity: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: -4, paddingBottom: 6, flex: 1 },
  userAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  userName: { fontWeight: '800', color: TEXT, fontSize: 18, lineHeight: 22 },
  propChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingVertical: 6, borderWidth: 1, borderColor: BORDER, borderRadius: 999, backgroundColor: '#fff', maxWidth: 180  },
  propChipThumb: { width: 24, height: 24, borderRadius: 6, backgroundColor: '#eee' },
  propChipText: { maxWidth: 120, color: MUTED, fontSize: 12, fontWeight: '600' },
  propThumb: { width: 44, height: 44, borderRadius: 8, backgroundColor: '#eee' },
  propTitle: { fontWeight: '800', color: TEXT },
  propSub: { fontSize: 12, color: MUTED },
  // Full-width property header card
  propHeaderCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 12, marginTop: 6, marginBottom: 6, padding: 10, borderWidth: 1, borderColor: BORDER, borderRadius: 14, backgroundColor: '#fff' },
  propHeaderImg: { width: 56, height: 56, borderRadius: 10, backgroundColor: '#eee' },
  propHeaderTitle: { fontWeight: '700', color: TEXT },
  propHeaderSub: { fontSize: 12, color: MUTED, marginTop: 2 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  mine: { justifyContent: 'flex-end' },
  theirs: { justifyContent: 'flex-start' },
  avatar: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: 26, height: 26, borderRadius: 13 },
  bubble: { maxWidth: '84%', borderRadius: 16, paddingVertical: 8, paddingHorizontal: 12 },
  bubbleMine: { backgroundColor: GREEN, borderTopRightRadius: 8, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  bubbleTheirs: { backgroundColor: '#F1F5F9', borderTopLeftRadius: 8 },
  body: { fontSize: 15 },
  metaInline: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, alignSelf: 'flex-end' },
  time: { fontSize: 11 },
  ack: { marginLeft: 2 },
  composerBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: BORDER, backgroundColor: '#fff' },
  calendarBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: BORDER, backgroundColor: '#fff' },
  input: { flex: 1, minHeight: 44, maxHeight: 120, borderWidth: 1, borderColor: BORDER, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#fff' },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '700', color: TEXT },
  // Viewing request styles
  requestCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 12, borderWidth: 1, borderColor: BORDER, borderRadius: 12, backgroundColor: '#fff' },
  requestTitle: { fontWeight: '700', color: TEXT },
  requestSub: { fontSize: 12, color: MUTED, marginTop: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  stPending: { backgroundColor: '#FEF3C7' },
  stAccepted: { backgroundColor: '#D1FAE5' },
  stDeclined: { backgroundColor: '#FEE2E2' },
  statusText: { fontSize: 11, fontWeight: '700', color: '#111827' },
  declineText: { fontSize: 12, color: MUTED },
  smallBtn: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8 },
  smallBtnText: { color: '#fff', fontWeight: '700' },
  // Modal styles
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { width: '100%', maxWidth: 420, borderRadius: 14, backgroundColor: '#fff', padding: 16 },
  modalTitle: { fontWeight: '800', color: TEXT, marginBottom: 8, fontSize: 16 },
  actionBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10 },
  actionText: { color: '#fff', fontWeight: '700' },
});

function mapType(t?: string | null) {
  switch (t) {
    case 'single_room': return 'Single room';
    case 'multiple_rooms': return 'Multiple rooms';
    case 'hostel': return 'Hostel';
    default: return 'Property';
  }
}

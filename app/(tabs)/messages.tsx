import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

const GREEN = Colors.light.tint; // #16C784

export default function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    try {
      setError(null);
      if (!refreshing) setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');

      const { data, error } = await supabase
        .from('conversations')
        .select('conversation_id, seeker_id, owner_id, property_id, last_message, last_message_at, seeker_unread_count, owner_unread_count, created_at')
        .or(`seeker_id.eq.${user.id},owner_id.eq.${user.id}`)
        .order('last_message_at', { ascending: false, nullsFirst: false });
      if (error) throw error;

      const rows = (data ?? []) as any[];
      const roleAndOtherIds = rows.map((c) => ({
        convId: c.conversation_id,
        role: c.owner_id === user.id ? 'owner' as const : 'seeker' as const,
        otherId: c.owner_id === user.id ? c.seeker_id : c.owner_id,
        last_message: c.last_message,
        last_message_at: c.last_message_at,
        created_at: c.created_at,
        seeker_unread_count: c.seeker_unread_count,
        owner_unread_count: c.owner_unread_count,
      }));
      const uniqueOtherIds = Array.from(new Set(roleAndOtherIds.map(r => r.otherId))).filter(Boolean);

      // Try selecting email along with profile fields; if it errors, fall back without email.
      let profiles: Record<string, any> = {};
      try {
        if (uniqueOtherIds.length > 0) {
          const { data: profs, error: pErr } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url, email')
            .in('id', uniqueOtherIds);
          if (pErr) throw pErr;
          (profs || []).forEach((p: any) => { profiles[p.id] = p; });
        }
      } catch {
        if (uniqueOtherIds.length > 0) {
          const { data: profs } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url')
            .in('id', uniqueOtherIds);
          (profs || []).forEach((p: any) => { profiles[p.id] = p; });
        }
      }

      const mapped: Conversation[] = roleAndOtherIds.map((r) => {
        const prof = profiles[r.otherId] || {};
        const displayName = (prof.full_name && String(prof.full_name).trim()) || prof.email || 'User';
        const unread = r.role === 'owner' ? (r.owner_unread_count ?? 0) : (r.seeker_unread_count ?? 0);
        const avatar_url = prof.avatar_url || '';
        return {
          id: r.convId,
          title: displayName,
          snippet: r.last_message ?? 'Say hello 👋',
          time: r.last_message_at ?? r.created_at,
          unread,
          role: r.role,
          avatar_url,
        };
      });
      setConversations(mapped);
    } catch (e: any) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshing]);

  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.container, { paddingBottom: insets.bottom }] }>
      <Text style={styles.header}>Messages</Text>
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={GREEN} />
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => <ConversationRow item={item} />}
          contentContainerStyle={{ paddingVertical: 8 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => setRefreshing(true)} />}
          ListEmptyComponent={() => (
            <View style={{ paddingVertical: 48, alignItems: 'center' }}>
              <Text style={{ color: '#6b7280' }}>No conversations yet</Text>
            </View>
          )}
          ListHeaderComponent={() => (
            <View style={styles.searchWrap}>
              <TextInput
                placeholder="Search"
                placeholderTextColor="#9CA3AF"
                value={query}
                onChangeText={setQuery}
                style={styles.search}
              />
            </View>
          )}
          data={conversations.filter(c => c.title.toLowerCase().includes(query.toLowerCase()) || c.snippet.toLowerCase().includes(query.toLowerCase()))}
        />
      )}
    </SafeAreaView>
  );
}

function ConversationRow({ item }: { item: Conversation }) {
  return (
    <Pressable onPress={() => router.push({ pathname: '/messages/[id]', params: { id: item.id } })}>
      <View style={styles.row}>
        {item.avatar_url ? (
          <Image source={{ uri: item.avatar_url }} style={styles.avatarImg} contentFit="cover" />
        ) : (
          <View style={[styles.avatar, { backgroundColor: colorFromString(item.title) }]}>
            <Text style={styles.avatarText}>{initials(item.title)}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <View style={styles.rowTop}>
            <Text numberOfLines={1} style={styles.title}>{item.title}</Text>
            <Text style={styles.time}>{timeAgo(item.time)}</Text>
          </View>
          <View style={styles.rowBottom}>
            <Text numberOfLines={1} style={styles.snippet}>{item.snippet}</Text>
            {item.unread > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{item.unread}</Text>
              </View>
            )}
          </View>
          <View style={styles.badgesRow}>
            <RoleBadge role={item.role} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function RoleBadge({ role }: { role: 'owner' | 'seeker' }) {
  const label = role === 'owner' ? 'Owner' : 'Seeker';
  return (
    <View style={[styles.roleBadge, role === 'owner' ? styles.ownerBadge : styles.seekerBadge]}>
      <Text style={[styles.roleText, role === 'owner' ? styles.ownerText : styles.seekerText]}>{label}</Text>
    </View>
  );
}

function initials(text: string) {
  const parts = text.split(/[\s•]+/).filter(Boolean);
  const chars = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('');
  return chars || '?';
}

function colorFromString(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 60%, 80%)`;
}

type Conversation = {
  id: string;
  title: string; // name + role context
  snippet: string;
  time: string | null;
  unread: number;
  role: 'owner' | 'seeker';
  avatar_url?: string;
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 16 },
  header: { fontSize: 22, fontWeight: '800', color: GREEN, marginTop: 8, marginBottom: 8 },
  separator: { height: 1, backgroundColor: '#F3F4F6' },
  row: { flexDirection: 'row', paddingVertical: 12, columnGap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#E5E7EB' },
  avatarText: { fontWeight: '800', color: '#11181C' },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontWeight: '700', color: '#11181C', flex: 1, marginRight: 8 },
  time: { color: '#6b7280', fontSize: 12 },
  rowBottom: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  snippet: { color: '#6b7280', flex: 1, marginRight: 8 },
  unreadBadge: { minWidth: 22, paddingHorizontal: 6, height: 22, borderRadius: 11, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center' },
  unreadText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  badgesRow: { flexDirection: 'row', columnGap: 8, marginTop: 6 },
  roleBadge: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999 },
  ownerBadge: { backgroundColor: '#eefcf6' },
  seekerBadge: { backgroundColor: '#eef5fc' },
  roleText: { fontWeight: '700', fontSize: 12 },
  ownerText: { color: '#059669' },
  seekerText: { color: '#2563eb' },
});

function formatTime(ts: string | null) {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    return d.toLocaleString();
  } catch { return ''; }
}

function timeAgo(ts: string | null) {
  if (!ts) return '';
  const d = new Date(ts).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - d);
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
}

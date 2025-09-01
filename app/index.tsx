import { Colors } from '@/constants/Colors';
import { Feather, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Welcome() {
  const theme = Colors.light; // initial screen uses light variant

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Title */}
        <Text style={[styles.title, { color: '#16C784' } /* vibrant green */]}>bodima.com</Text>
        <Text style={styles.subtitle}>Find your perfect boarding room</Text>

        {/* Hero image */}
        <View style={styles.heroWrap}>
          <Image
            source={require('../assets/images/Logo.png')}
            style={styles.hero}
            contentFit="cover"
            transition={200}
          />
        </View>

        {/* Feature rows */}
        <View style={styles.features}>
          <FeatureRow
            icon={<Feather name="search" size={22} color="#16C784" />}
            title="Easy Search"
            subtitle="Find rooms that match your preferences"
          />
          <FeatureRow
            icon={<FontAwesome5 name="hand-holding-usd" size={20} color="#16C784" />}
            title="Affordable Options"
            subtitle="Find rooms within your budget"
          />
          <FeatureRow
            icon={<MaterialCommunityIcons name="home-plus" size={24} color="#16C784" />}
            title="List Your Property"
            subtitle="Easily list your rooms for rent"
          />
        </View>

        {/* Actions */}
        <Pressable style={styles.ctaPrimary} onPress={() => router.push('/auth/signup') }>
          <Text style={styles.ctaPrimaryText}>Get Started</Text>
        </Pressable>

        <Pressable style={styles.ctaSecondary} onPress={() => router.push('/auth/login') }>
          <Text style={styles.ctaSecondaryText}>I already have an account</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function FeatureRow({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <View style={styles.featureRow}>
      <View style={styles.featureIcon}>{icon}</View>
      <View style={styles.featureTextWrap}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 32 },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 6,
  },
  heroWrap: {
    marginTop: 20,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#f3f4f6',
  },
  hero: {
    width: '100%',
    height: 180,
  },
  features: {
    marginTop: 18,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e8f8f1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  featureTextWrap: { flex: 1 },
  featureTitle: { fontSize: 16, fontWeight: '600', color: '#11181C' },
  featureSubtitle: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  ctaPrimary: {
    backgroundColor: '#16C784',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  ctaPrimaryText: { color: 'white', fontWeight: '600', fontSize: 16 },
  ctaSecondary: {
    borderWidth: 1,
    borderColor: '#16C784',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  ctaSecondaryText: { color: '#16C784', fontWeight: '600', fontSize: 16 },
});

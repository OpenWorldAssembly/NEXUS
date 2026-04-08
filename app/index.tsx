import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function HomePage() {
  return (
    <View style={styles.page}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Open World Assembly</Text>

        <Text style={styles.title}>
          A civic coordination layer for humanity.
        </Text>

        <Text style={styles.subtitle}>
          Public explanation, living documentation, and a portal for participation,
          all under one roof.
        </Text>

        <View style={styles.actions}>
          <Link href="/about" asChild>
            <Pressable style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Learn More</Text>
            </Pressable>
          </Link>

          <Link href="/docs" asChild>
            <Pressable style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Read the Docs</Text>
            </Pressable>
          </Link>

          <Link href="/portal" asChild>
            <Pressable style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Enter Portal</Text>
            </Pressable>
          </Link>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>What this site is for</Text>
        <Text style={styles.sectionText}>
          This site is the public front door for OWA. It explains the system,
          hosts the core documents, and will gradually grow into the deeper
          participation portal.
        </Text>
      </View>

      <View style={styles.cardRow}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Public Orientation</Text>
          <Text style={styles.cardText}>
            Clear explanation of what OWA is, what it is not, and how it works.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Core Documents</Text>
          <Text style={styles.cardText}>
            Canon, implementation guidance, and supporting material in one place.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Portal Surface</Text>
          <Text style={styles.cardText}>
            The future participation layer for assemblies, proposals, and action.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 40,
    width: '100%',
    maxWidth: 1200,
    marginHorizontal: 'auto',
  },
  hero: {
    paddingVertical: 48,
  },
  eyebrow: {
    color: '#93c5fd',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  title: {
    color: '#f8fafc',
    fontSize: 48,
    lineHeight: 56,
    fontWeight: '800',
    maxWidth: 800,
    marginBottom: 18,
  },
  subtitle: {
    color: '#cbd5e1',
    fontSize: 18,
    lineHeight: 30,
    maxWidth: 760,
    marginBottom: 28,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#11182b',
  },
  secondaryButtonText: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '600',
  },
  section: {
    marginTop: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#f8fafc',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 10,
  },
  sectionText: {
    color: '#cbd5e1',
    fontSize: 16,
    lineHeight: 28,
    maxWidth: 850,
  },
  cardRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 12,
  },
  card: {
    flexGrow: 1,
    flexBasis: 280,
    backgroundColor: '#11182b',
    borderWidth: 1,
    borderColor: '#1f2a44',
    borderRadius: 14,
    padding: 20,
  },
  cardTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  cardText: {
    color: '#cbd5e1',
    fontSize: 15,
    lineHeight: 24,
  },
});
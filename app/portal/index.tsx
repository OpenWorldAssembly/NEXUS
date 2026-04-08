import { StyleSheet, Text, View } from 'react-native';

export default function PortalPage() {
  return (
    <View style={styles.page}>
      <Text style={styles.title}>Portal</Text>
      <Text style={styles.text}>
        This is the future authenticated surface for assemblies, proposals, and
        participation.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    padding: 24,
    maxWidth: 1000,
    width: '100%',
    marginHorizontal: 'auto',
  },
  title: {
    color: '#f8fafc',
    fontSize: 36,
    fontWeight: '800',
    marginBottom: 16,
  },
  text: {
    color: '#cbd5e1',
    fontSize: 18,
    lineHeight: 30,
  },
});
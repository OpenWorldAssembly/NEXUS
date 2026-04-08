import { StyleSheet, Text, View } from 'react-native';

export default function Footer() {
  return (
    <View style={styles.footer}>
      <View style={styles.inner}>
        <Text style={styles.text}>
          Open World Assembly
        </Text>
        <Text style={styles.subtext}>
          A public-facing theory, documentation, and portal shell.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: '#1f2a44',
    backgroundColor: '#11182b',
  },
  inner: {
    width: '100%',
    maxWidth: 1200,
    marginHorizontal: 'auto',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  text: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  subtext: {
    color: '#94a3b8',
    fontSize: 13,
  },
});
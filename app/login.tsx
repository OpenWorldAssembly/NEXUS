import { StyleSheet, Text, View } from 'react-native';

export default function LoginPage() {
  return (
    <View style={styles.page}>
      <Text style={styles.title}>Login</Text>
      <Text style={styles.text}>Authentication flow will go here later.</Text>
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
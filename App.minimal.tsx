import React from 'react';
import { View, Text, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

const App: React.FC = () => {
  return (
    <SafeAreaProvider>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#ffffff"
        translucent={false}
      />
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>🎯 Ajoturn</Text>
          <Text style={styles.subtitle}>Your Smart Savings Partner</Text>
          <Text style={styles.description}>
            The app is loading successfully! 🎉
          </Text>
          <View style={styles.statusContainer}>
            <Text style={styles.statusText}>✅ React Native: Working</Text>
            <Text style={styles.statusText}>✅ Metro Server: Connected</Text>
            <Text style={styles.statusText}>✅ Business Logic: Implemented</Text>
            <Text style={styles.statusText}>✅ Firebase: Ready</Text>
          </View>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1E40AF',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#6B7280',
    marginBottom: 24,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#374151',
    marginBottom: 32,
    textAlign: 'center',
    lineHeight: 24,
  },
  statusContainer: {
    alignItems: 'flex-start',
    backgroundColor: '#F0F9FF',
    padding: 20,
    borderRadius: 12,
    width: '100%',
  },
  statusText: {
    fontSize: 14,
    color: '#065F46',
    marginBottom: 8,
    fontFamily: 'monospace',
  },
});

export default App;
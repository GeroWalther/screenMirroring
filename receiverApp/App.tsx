import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import WebViewReceiver from './components/WebViewReceiver';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style='light' />
      <WebViewReceiver />
    </SafeAreaProvider>
  );
}

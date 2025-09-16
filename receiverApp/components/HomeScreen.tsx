/**
 * Home Screen - Choose between WebRTC and WebView receivers
 */

import React from 'react';
import { View, StyleSheet, Text, Pressable, StatusBar } from 'react-native';
import { NavigationProp } from '@react-navigation/native';

interface Props {
  navigation: NavigationProp<any>;
}

export default function HomeScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <StatusBar hidden />

      <Text style={styles.title}>📺 Screen Mirror Receiver</Text>
      <Text style={styles.subtitle}>Choose your receiver mode</Text>

      <View style={styles.optionsContainer}>
        <Pressable
          style={styles.optionButton}
          onPress={() => navigation.navigate('WebViewReceiver')}
          hasTVPreferredFocus={true}>
          <Text style={styles.optionEmoji}>🌐</Text>
          <Text style={styles.optionTitle}>WebView Receiver</Text>
          <Text style={styles.optionDescription}>
            Uses your working web receiver{'\n'}
            (Recommended - Simple & Reliable)
          </Text>
        </Pressable>

        <Pressable
          style={styles.optionButton}
          onPress={() => navigation.navigate('WebRTCReceiver')}>
          <Text style={styles.optionEmoji}>📡</Text>
          <Text style={styles.optionTitle}>Native WebRTC</Text>
          <Text style={styles.optionDescription}>
            Direct WebRTC implementation{'\n'}
            (Advanced - More complex setup)
          </Text>
        </Pressable>
      </View>

      <Text style={styles.footerText}>
        Both modes connect to the same signaling server{'\n'}
        and work with your desktop sender app
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  title: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },

  subtitle: {
    color: '#ccc',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 40,
  },

  optionsContainer: {
    width: '100%',
    maxWidth: 400,
    gap: 20,
  },

  optionButton: {
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    borderColor: '#333',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },

  optionEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },

  optionTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },

  optionDescription: {
    color: '#aaa',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },

  footerText: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 40,
    lineHeight: 18,
  },
});

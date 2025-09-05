import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import ScreenReceiver from './components/ScreenReceiver';

const Stack = createStackNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style='light' />
        <Stack.Navigator
          screenOptions={{
            headerShown: false, // Hide header for fullscreen experience
            gestureEnabled: false, // Disable swipe gestures
          }}>
          <Stack.Screen
            name='ScreenReceiver'
            component={ScreenReceiver}
            options={{
              title: 'Screen Mirror Receiver',
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

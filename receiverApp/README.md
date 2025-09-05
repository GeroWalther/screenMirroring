# Screen Mirror Receiver - Simplified React Native App

A clean, simple React Native app for receiving WebRTC screen streams on Android TV/Google TV.

## 🚀 Key Changes

### ✅ **Removed Expo Router & Tab Navigation**

- Eliminated complex routing system
- Removed unnecessary tab navigation
- Simplified to single screen app

### ✅ **Pure React Navigation**

- Using `@react-navigation/stack` for simple navigation
- Single screen with fullscreen experience
- Optimized for Android TV

### ✅ **Cleaned Up Structure**

```
receiverApp/
├── App.tsx                  # Main app with stack navigator
├── index.js                 # Entry point
├── components/
│   └── ScreenReceiver.tsx   # WebRTC receiver component
├── app.json                 # Android TV configuration
└── package.json             # Minimal dependencies
```

### ✅ **Android TV Optimizations**

- Landscape orientation by default
- Dark theme for better TV experience
- Leanback launcher support for Android TV
- Proper permissions for WebRTC

## 📦 Dependencies (Minimal)

Only essential packages:

- `@react-navigation/native` - Navigation
- `@react-navigation/stack` - Stack navigator
- `react-native-webrtc` - WebRTC functionality
- `expo` - Build tooling
- `react-native-safe-area-context` - Safe area handling
- `react-native-screens` - Screen management
- `react-native-gesture-handler` - Touch handling

## 🎯 Features

- **Single Purpose**: Only screen receiving functionality
- **Fullscreen Experience**: No navigation bars or tabs
- **TV Optimized**: Landscape mode, dark theme, large touch targets
- **Simple Navigation**: Stack navigator for potential future screens
- **Clean Architecture**: Minimal, focused codebase

## 🚀 Usage

```bash
# Install dependencies
npm install

# Run on Android TV/Google TV
npx expo run:android

# Or for development
npm start
```

The app launches directly into the screen receiver interface - no navigation needed!

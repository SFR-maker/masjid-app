import { ExpoConfig, ConfigContext } from 'expo/config'

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Masjid',
  slug: 'masjid-app',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'masjid',
  userInterfaceStyle: 'automatic',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#1B4332',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.masjidapp.mobile',
    infoPlist: {
      NSLocationWhenInUseUsageDescription: 'We use your location to find nearby mosques.',
      NSCameraUsageDescription: 'Used to upload your profile photo.',
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#1B4332',
    },
    googleServicesFile: './google-services.json',
    package: 'com.masjidapp.mobile',
    permissions: ['ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION', 'POST_NOTIFICATIONS'],
    intentFilters: [
      {
        action: 'VIEW',
        data: [{ scheme: 'masjid' }],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  updates: {
    url: 'https://u.expo.dev/ba2f52fa-a888-42b6-80a9-d1500a0c5a70',
  },
  runtimeVersion: {
    policy: 'appVersion',
  },
  plugins: [
    'expo-router',
    'expo-updates',
    'expo-notifications',
    ['expo-location', { locationWhenInUsePermission: 'Allow Masjid to find mosques near you.' }],
    // Bug 11 fix: enable Android foreground service so Quran audio continues
    // playing when the app is backgrounded or the screen is locked.
    [
      'expo-av',
      {
        microphonePermission: false,
        androidAudioForegroundServiceType: 'mediaPlayback',
      },
    ],
  ],
  web: {
    bundler: 'metro',
    output: 'single',
  },
  experiments: {
    typedRoutes: true,
  },
  extra: {
    eas: {
      projectId: 'ba2f52fa-a888-42b6-80a9-d1500a0c5a70',
    },
  },
})

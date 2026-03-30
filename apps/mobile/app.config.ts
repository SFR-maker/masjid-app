import { ExpoConfig, ConfigContext } from 'expo/config'

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Masjidly',
  slug: 'masjid-app',
  version: '1.1.0',
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
    buildNumber: '4',
    infoPlist: {
      NSLocationWhenInUseUsageDescription: 'Allow Masjidly to find mosques near you.',
      NSCameraUsageDescription: 'Used to upload your profile photo.',
      UIBackgroundModes: ['audio', 'fetch'],
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#1B4332',
    },
    googleServicesFile: './google-services.json',
    package: 'com.masjidapp.mobile',
    versionCode: 4,
    permissions: [
      'ACCESS_FINE_LOCATION',
      'ACCESS_COARSE_LOCATION',
      'POST_NOTIFICATIONS',
      'FOREGROUND_SERVICE',
      'FOREGROUND_SERVICE_MEDIA_PLAYBACK',
    ],
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
  runtimeVersion: '1.1.0',
  plugins: [
    'expo-router',
    'expo-updates',
    'expo-notifications',
    ['@stripe/stripe-react-native', { merchantIdentifier: 'merchant.com.masjidapp.mobile', enableGooglePay: true }],
    ['expo-location', { locationWhenInUsePermission: 'Allow Masjidly to find mosques near you.' }],
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
  newArchEnabled: false,
  experiments: {
    typedRoutes: true,
  },
  extra: {
    eas: {
      projectId: 'ba2f52fa-a888-42b6-80a9-d1500a0c5a70',
    },
  },
})

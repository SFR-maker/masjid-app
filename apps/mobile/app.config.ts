import { ExpoConfig, ConfigContext } from 'expo/config'

const variant = process.env.APP_VARIANT ?? 'production'

const bundleIdSuffix = variant === 'production' ? '' : `.${variant}`
const nameSuffix = variant === 'production' ? '' : ` (${variant})`

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: `Masjid${nameSuffix}`,
  slug: 'masjid-app',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#14532d',
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: false,
    bundleIdentifier: `com.masjidapp.app${bundleIdSuffix}`,
    buildNumber: '1',
    infoPlist: {
      NSLocationWhenInUseUsageDescription: 'Used to find mosques near you.',
    },
    // App Group allows widget extensions to read AsyncStorage data
    entitlements: {
      'com.apple.security.application-groups': [
        `group.com.masjidapp.app${bundleIdSuffix}`,
      ],
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#14532d',
    },
    package: `com.masjidapp.app${variant === 'production' ? '' : `.${variant}`}`,
    versionCode: 1,
    permissions: ['ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION', 'POST_NOTIFICATIONS'],
    ...(process.env.GOOGLE_SERVICES_JSON ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON } : {}),
  },
  web: {
    bundler: 'metro',
  },
  plugins: [
    'expo-router',
    'expo-font',
    'expo-secure-store',
    [
      'expo-notifications',
      {
        icon: './assets/notification-icon.png',
        color: '#14532d',
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission: 'Used to find mosques near you.',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    tsconfigPaths: true,
  },
  extra: {
    eas: {
      projectId: process.env.EAS_PROJECT_ID,
    },
  },
})

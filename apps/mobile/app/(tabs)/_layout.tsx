import { View, Text } from 'react-native'
import { Tabs } from 'expo-router'
import { useAuth } from '@clerk/clerk-expo'
import { Redirect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useUnreadNotificationCount, usePushNotificationSetup } from '../../hooks/useNotifications'
import { useTheme } from '../../contexts/ThemeContext'

export default function TabsLayout() {
  const { isSignedIn } = useAuth()
  const { colors } = useTheme()
  const { t } = useTranslation()
  usePushNotificationSetup()

  if (!isSignedIn) return <Redirect href="/(auth)/sign-in" />

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: colors.tabBarBorder,
          backgroundColor: colors.tabBar,
          paddingBottom: 4,
          height: 60,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('nav_home'),
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: t('nav_discover'),
          tabBarIcon: ({ color, size }) => <Ionicons name="search" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="prayer"
        options={{
          title: t('nav_prayer'),
          tabBarIcon: ({ color, size }) => <Ionicons name="time" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="videos"
        options={{
          title: t('nav_videos'),
          tabBarIcon: ({ color, size }) => <Ionicons name="play-circle" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: t('nav_updates'),
          tabBarIcon: ({ color, size }) => <NotificationIcon color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('nav_profile'),
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
        }}
      />
    </Tabs>
  )
}

function NotificationIcon({ color, size }: { color: string; size: number }) {
  const { data: count = 0 } = useUnreadNotificationCount()
  return (
    <View>
      <Ionicons name="notifications" size={size} color={color} />
      {count > 0 && (
        <View
          style={{
            position: 'absolute', top: -2, right: -4,
            backgroundColor: '#EF4444', borderRadius: 8,
            width: 16, height: 16, alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Text style={{ color: 'white', fontSize: 9, fontWeight: 'bold' }}>
            {count > 9 ? '9+' : count}
          </Text>
        </View>
      )}
    </View>
  )
}

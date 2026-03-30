import { Platform } from 'react-native'

// registerPlaybackService MUST run before expo-router mounts the React tree.
// Using require (not import) here to guarantee execution order — ES imports are hoisted.
if (Platform.OS !== 'web') {
  const TrackPlayer = require('react-native-track-player').default
  const { PlaybackService } = require('./lib/trackPlayerService')
  TrackPlayer.registerPlaybackService(() => PlaybackService)
}

require('expo-router/entry')

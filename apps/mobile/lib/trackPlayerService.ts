import TrackPlayer, { Event, State } from 'react-native-track-player'
import { useQuranAudioStore } from './quranAudioStore'

export async function PlaybackService() {
  TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play())
  TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause())
  TrackPlayer.addEventListener(Event.RemoteNext, () => TrackPlayer.skipToNext().catch(() => {}))
  TrackPlayer.addEventListener(Event.RemotePrevious, () => TrackPlayer.skipToPrevious().catch(() => {}))
  TrackPlayer.addEventListener(Event.RemoteStop, () => TrackPlayer.reset())

  TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, ({ track }: any) => {
    const store = useQuranAudioStore.getState()
    if (!track) {
      store.setPlayingAyah(null)
      return
    }
    store.setPlayingAyah(track.id === 'bismillah' ? 0 : parseInt(String(track.id)))
  })

  TrackPlayer.addEventListener(Event.PlaybackState, ({ state }: any) => {
    const store = useQuranAudioStore.getState()
    if (state === State.Playing) {
      store.setIsPlaying(true)
      store.setIsPaused(false)
    } else if (state === State.Paused) {
      store.setIsPlaying(false)
      store.setIsPaused(true)
    } else if (state === State.Stopped || state === State.None || state === State.Error || state === State.Ended) {
      store.setIsPlaying(false)
      store.setIsPaused(false)
      store.setPlayingAyah(null)
    }
  })

  TrackPlayer.addEventListener(Event.PlaybackQueueEnded, () => {
    const store = useQuranAudioStore.getState()
    store.setIsPlaying(false)
    store.setIsPaused(false)
    store.setPlayingAyah(null)
  })
}

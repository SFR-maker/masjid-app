import Mux from '@mux/mux-node'

export const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID!,
  tokenSecret: process.env.MUX_TOKEN_SECRET!,
})

export async function createMuxUploadUrl() {
  const upload = await mux.video.uploads.create({
    cors_origin: '*',
    new_asset_settings: {
      playback_policy: ['public'],
      encoding_tier: 'smart',
    },
  })
  return { uploadUrl: upload.url, uploadId: upload.id }
}

export function getMuxThumbnailUrl(playbackId: string, time = 0) {
  return `https://image.mux.com/${playbackId}/thumbnail.jpg?time=${time}`
}

export function getMuxStreamUrl(playbackId: string) {
  return `https://stream.mux.com/${playbackId}.m3u8`
}

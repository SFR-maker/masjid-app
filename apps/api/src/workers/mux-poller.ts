import { prisma } from '@masjid/database'
import { mux, getMuxThumbnailUrl } from '../lib/mux'

async function pollProcessingVideos() {
  const processing = await prisma.video.findMany({
    where: { status: 'PROCESSING' },
    select: { id: true, muxUploadId: true, muxAssetId: true },
  })

  if (!processing.length) return

  for (const video of processing) {
    try {
      // If we don't have an asset ID yet, fetch it from the upload
      let assetId = video.muxAssetId
      if (!assetId && video.muxUploadId) {
        const upload = await mux.video.uploads.retrieve(video.muxUploadId)
        assetId = upload.asset_id ?? null
      }
      if (!assetId) continue

      const asset = await mux.video.assets.retrieve(assetId)

      if (asset.status === 'ready') {
        const playbackId = asset.playback_ids?.[0]?.id
        await prisma.video.update({
          where: { id: video.id },
          data: {
            muxAssetId: assetId,
            muxPlaybackId: playbackId,
            status: 'READY',
            thumbnailUrl: playbackId ? getMuxThumbnailUrl(playbackId) : undefined,
            duration: Math.round(asset.duration ?? 0),
            isPublished: true,
          },
        })
        process.stdout.write(JSON.stringify({ level: 'info', msg: `mux-poller: video ${video.id} is now READY` }) + '\n')
      } else if (asset.status === 'errored') {
        await prisma.video.update({
          where: { id: video.id },
          data: { muxAssetId: assetId, status: 'ERROR' },
        })
        process.stderr.write(JSON.stringify({ level: 'warn', msg: `mux-poller: video ${video.id} errored` }) + '\n')
      }
    } catch (err: any) {
      process.stderr.write(JSON.stringify({ level: 'error', msg: `mux-poller: error checking video ${video.id}`, err: err.message }) + '\n')
    }
  }
}

if (!process.env.MUX_TOKEN_ID || !process.env.MUX_TOKEN_SECRET) {
  process.stdout.write(JSON.stringify({ level: 'warn', msg: 'mux-poller: MUX_TOKEN_ID or MUX_TOKEN_SECRET not configured — poller disabled' }) + '\n')
} else {
  // Poll every 30 seconds
  setInterval(pollProcessingVideos, 30_000)
  // Also run immediately on startup
  pollProcessingVideos()
}

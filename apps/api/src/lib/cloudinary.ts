import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
})

export { cloudinary }

export async function generateSignedUploadParams(folder: string) {
  const timestamp = Math.round(new Date().getTime() / 1000)
  const params = {
    timestamp,
    folder,
    allowed_formats: 'jpg,jpeg,png,webp,gif',
    max_bytes: 10_000_000, // 10 MB
  }
  const signature = cloudinary.utils.api_sign_request(params, process.env.CLOUDINARY_API_SECRET!)
  return {
    signature,
    timestamp,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    folder,
    allowedFormats: params.allowed_formats,
    maxBytes: params.max_bytes,
  }
}

export async function generateSignedVideoUploadParams(folder: string) {
  const timestamp = Math.round(new Date().getTime() / 1000)
  const params = {
    timestamp,
    folder,
    resource_type: 'video',
    allowed_formats: 'mp4,mov,webm,avi',
    max_bytes: 200_000_000, // 200 MB
  }
  const signature = cloudinary.utils.api_sign_request(params, process.env.CLOUDINARY_API_SECRET!)
  return {
    signature,
    timestamp,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    folder,
    resourceType: 'video',
    allowedFormats: params.allowed_formats,
    maxBytes: params.max_bytes,
  }
}

export function generateSignedDownloadUrl(publicId: string, resourceType: 'image' | 'raw' = 'raw'): string {
  const timestamp = Math.round(Date.now() / 1000) + 3600 // 1 hour expiry
  return cloudinary.url(publicId, {
    resource_type: resourceType,
    sign_url: true,
    type: 'upload',
    expires_at: timestamp,
  })
}

export async function deleteCloudinaryResource(publicId: string, resourceType: 'image' | 'raw' | 'video' = 'raw'): Promise<void> {
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType })
}

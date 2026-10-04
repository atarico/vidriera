import { v2 as cloudinary } from 'cloudinary'
import type { ImageRenditions } from '@vidriera/contracts'
import type { ImageStore } from '../ports'

type UrlBuilder = (publicId: string, options: Record<string, unknown>) => string

const SHARED_TRANSFORM = { quality: 'auto', fetch_format: 'auto', secure: true } as const

/**
 * Pure: builds the four derived rendition URLs for a stable Cloudinary
 * public_id. Injected `urlFor` so this can be tested without hitting
 * Cloudinary or importing its SDK.
 */
export function buildRenditionUrls(publicId: string, urlFor: UrlBuilder): ImageRenditions {
  return {
    card: urlFor(publicId, { width: 400, height: 400, crop: 'fill', gravity: 'auto', ...SHARED_TRANSFORM }),
    hero: urlFor(publicId, { width: 1600, height: 900, crop: 'fill', gravity: 'auto', ...SHARED_TRANSFORM }),
    og: urlFor(publicId, { width: 1200, height: 630, crop: 'fill', gravity: 'auto', ...SHARED_TRANSFORM }),
    lqip: urlFor(publicId, { width: 24, crop: 'scale', effect: 'blur:1000', ...SHARED_TRANSFORM, quality: 1 }),
  }
}

export interface CloudinaryConfig {
  cloudName: string
  apiKey: string
  apiSecret: string
}

/**
 * ImageStore adapter over Cloudinary. The only file allowed to import
 * `cloudinary` in this repository.
 *
 * publicIdSeed must be deterministic per source image (documentId + image
 * index) — uploading with `overwrite: true` to the same public_id means a
 * replay of the same message re-uses the already-uploaded asset instead of
 * uploading it again.
 */
export function createCloudinaryImageStore(config: CloudinaryConfig): ImageStore {
  cloudinary.config({
    cloud_name: config.cloudName,
    api_key: config.apiKey,
    api_secret: config.apiSecret,
  })

  return {
    async deriveRenditions(publicIdSeed, sourceUrl) {
      await cloudinary.uploader.upload(sourceUrl, { public_id: publicIdSeed, overwrite: true })
      return buildRenditionUrls(publicIdSeed, (publicId, options) => cloudinary.url(publicId, options))
    },
  }
}

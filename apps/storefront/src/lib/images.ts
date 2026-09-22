import type { ImageRenditions } from '@vidriera/contracts'

/** The first image is the product's primary/cover image, by convention. */
export function primaryImage(images: ImageRenditions[]): ImageRenditions | undefined {
  return images[0]
}

/** Reads a single rendition URL off the primary image, or undefined if there are no images. */
export function pickRendition(
  images: ImageRenditions[],
  rendition: keyof ImageRenditions,
): string | undefined {
  return primaryImage(images)?.[rendition]
}

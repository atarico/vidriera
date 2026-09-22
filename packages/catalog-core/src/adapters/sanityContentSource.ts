import { createClient } from '@sanity/client'
import type { RubroProfile } from '@vidriera/contracts'
import type { ContentSource, SourceDocument } from '../ports'

const PRODUCT_DOC_TYPE = 'product'

/**
 * Pure: builds the GROQ projection for a product document, driven by the
 * rubro profile so every declared attribute is projected flat from the
 * document root (Studio stores attributes as top-level fields — the
 * "attributes" fieldset is a Studio UI grouping only, not a data nesting
 * level) with no other file needing to know the vertical's field names.
 */
export function buildProductProjection(profile: RubroProfile): string {
  const attributeFields = profile.attributes.map((attribute) => `"${attribute.name}": ${attribute.name}`).join(', ')

  return `{
    _id,
    _rev,
    "slug": slug.current,
    name,
    description,
    price,
    currency,
    inStock,
    "category": category->title,
    "imageSourceUrls": images[].asset->url,
    "attributes": {${attributeFields}},
    "updatedAt": _updatedAt
  }`
}

export interface SanityContentSourceConfig {
  projectId: string
  dataset: string
  token?: string
  apiVersion?: string
}

/**
 * ContentSource adapter over @sanity/client. The only file allowed to
 * import @sanity/client in this repository.
 */
export function createSanityContentSource(config: SanityContentSourceConfig, profile: RubroProfile): ContentSource {
  const client = createClient({
    projectId: config.projectId,
    dataset: config.dataset,
    token: config.token,
    apiVersion: config.apiVersion ?? '2026-01-01',
    useCdn: false,
  })
  const projection = buildProductProjection(profile)

  return {
    async getDocument(documentId) {
      const doc = await client.fetch<SourceDocument | null>(
        `*[_type == "${PRODUCT_DOC_TYPE}" && _id == $id][0]${projection}`,
        { id: documentId },
      )
      return doc ?? null
    },
    async listDocuments(cursor, limit) {
      const query = cursor
        ? `*[_type == "${PRODUCT_DOC_TYPE}" && _id > $cursor] | order(_id) [0...${limit}]${projection}`
        : `*[_type == "${PRODUCT_DOC_TYPE}"] | order(_id) [0...${limit}]${projection}`
      const documents = await client.fetch<SourceDocument[]>(query, cursor ? { cursor } : {})
      const lastDocument = documents.at(-1)
      const nextCursor = documents.length === limit && lastDocument ? lastDocument._id : undefined
      return { documents, nextCursor }
    },
  }
}

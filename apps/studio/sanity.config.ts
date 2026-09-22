import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'
import { schemaTypes } from './src/schemas'

/**
 * Sanity Studio v6 configuration.
 *
 * projectId and dataset are read from env vars prefixed with SANITY_STUDIO_
 * — that prefix is required by the Sanity CLI's Vite build to embed them in
 * the Studio bundle. See .env.example (SANITY_STUDIO_PROJECT_ID,
 * SANITY_STUDIO_DATASET) once it is populated with real values.
 */
export default defineConfig({
  name: 'vidriera',
  title: 'Vidriera',
  projectId: process.env.SANITY_STUDIO_PROJECT_ID ?? '',
  dataset: process.env.SANITY_STUDIO_DATASET ?? 'production',
  schema: {
    types: schemaTypes,
  },
  plugins: [structureTool()],
})

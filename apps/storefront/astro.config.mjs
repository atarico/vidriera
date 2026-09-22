import { defineConfig } from 'astro/config'
import react from '@astrojs/react'

// Fully static output: the built site is synced to the S3 bucket provisioned
// by infra/terraform/storefront.tf and served through CloudFront. There is
// no server runtime in production, which is also why every Algolia call in
// this app (including the build-time product-page generation in
// productos/[slug].astro) uses the search-only key: there is never a server
// process around at request time that could hold a more privileged one.
export default defineConfig({
  output: 'static',
  integrations: [react()],
})

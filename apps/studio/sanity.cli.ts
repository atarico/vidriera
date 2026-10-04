import { defineCliConfig } from 'sanity/cli'

export default defineCliConfig({
  api: {
    projectId: process.env.SANITY_STUDIO_PROJECT_ID ?? '',
    dataset: process.env.SANITY_STUDIO_DATASET ?? 'production',
  },
  deployment: {
    // Identifies the hosted Studio at vidriera.sanity.studio so `sanity deploy`
    // does not prompt for it again. Not a secret.
    appId: 'q1jb31spflx2yk4rfc72273w',
  },
})

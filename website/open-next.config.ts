import { defineCloudflareConfig } from '@opennextjs/cloudflare'

// ponytail: no incremental cache — every route is `revalidate = false`, so the
// whole site is prerendered at build time. Add a KV/R2 cache adapter here if a
// page ever needs ISR.
export default defineCloudflareConfig()

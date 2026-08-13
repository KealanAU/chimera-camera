import { renderOpenGraphImage } from '@/lib/docs-og-image'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  return renderOpenGraphImage(req.url)
}

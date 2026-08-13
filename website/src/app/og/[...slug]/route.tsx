import { renderOpenGraphImage } from '@/lib/docs-og-image'

export const dynamic = 'force-dynamic'

export async function GET(
  req: Request,
  { params }: RouteContext<'/og/[...slug]'>,
) {
  const { slug } = await params
  return renderOpenGraphImage(req.url, slug)
}

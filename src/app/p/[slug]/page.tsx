import { notFound, redirect } from 'next/navigation'
import { widgets } from '@/lib/tochat/client'
import { publicReadScope } from '@/lib/tochat/org-config'

const SAFE_SLUG = /^[A-Za-z0-9][A-Za-z0-9_-]{1,120}$/

export const revalidate = 300

export default async function PublicLandSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  if (!SAFE_SLUG.test(slug)) notFound()

  const scope = publicReadScope()
  if (!scope) notFound()

  const widget = await widgets.findBySlug(scope, slug)
  const id = typeof widget?.id === 'string' ? widget.id : null
  if (!id) notFound()

  redirect(`/whatsapp-business-directory/${id}`)
}

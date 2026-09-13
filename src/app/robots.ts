import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: ['/', '/pricing', '/docs'], disallow: ['/api/', '/dashboard', '/inbox', '/contacts', '/pipelines', '/broadcasts', '/automations', '/widgets', '/agents', '/settings', '/login', '/signup'] }],
    sitemap: 'https://app.chatbotistic.com/sitemap.xml',
    host: 'https://app.chatbotistic.com',
  }
}

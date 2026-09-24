import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    // The dashboard host is noindex by default — only the genuinely
    // public surfaces (published chat landing pages and the widget
    // loader) are crawlable. Google resolves conflicts by longest
    // match, so these allows win over the blanket disallow.
    rules: [
      {
        userAgent: '*',
        allow: ['/whatsapp-business-directory/', '/land/'],
        disallow: '/',
      },
    ],
    host: 'https://app.chatbotistic.com',
  }
}

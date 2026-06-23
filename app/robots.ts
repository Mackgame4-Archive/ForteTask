import Config from '@/lib/config'
import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: '*',
                allow: '/',
                disallow: '/api',
            },
        ],
        sitemap: `${Config.BASE_URL}/sitemap.xml`,
    }
}
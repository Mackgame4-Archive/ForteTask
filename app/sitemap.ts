import Config from '@/lib/config'
import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
    return [
        {
            url: Config.BASE_URL,
            lastModified: new Date(),
        },
    ]
}
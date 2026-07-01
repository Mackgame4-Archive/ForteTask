import type { MetadataRoute } from 'next'
import Config from '@/lib/config'

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: Config.APP_NAME,
        short_name: Config.APP_NAME,
        description: Config.APP_DESCRIPTION,
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#000000',
        icons: [
            {
                src: '/intranet_logo.png',
                sizes: '512x512',
                type: 'image/png',
            },
        ],
    }
}

import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '逢甲打卡',
    short_name: '逢甲打卡',
    description: 'FCU 多帳號打卡工具',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f2f2f7',
    theme_color: '#34c759',
    lang: 'zh-Hant',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sunday School | St. Mark Church',
  icons: {
    icon: [
      {
        url: '/sunday-school-favicon-32.png',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        url: '/sunday-school-favicon.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
    shortcut: '/sunday-school-favicon-32.png',
    apple: '/sunday-school-apple-touch-icon.png',
  },
}

export default function SundaySchoolLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children
}

import type { Metadata } from 'next'
import DriveFileBrowser from '@/components/drive-file-browser'

export const metadata: Metadata = {
  title: 'Files | Servants Prep',
  description: 'Program recordings and materials.',
}

export default function FilesPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Files</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Program recordings and materials.
          </p>
        </div>
        <DriveFileBrowser />
      </div>
    </div>
  )
}

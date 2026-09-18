// Browser-side helpers for slip photos (/api/slips).
import useSWR from 'swr'
import { fetcher, defaultSWRConfig } from '@/lib/swr'

export function useSlips<T>(type: 'ATTENDANCE' | 'CONFESSION', studentId?: string) {
  return useSWR<T[]>(`/api/slips?type=${type}${studentId ? `&studentId=${studentId}` : ''}`, fetcher, defaultSWRConfig)
}

// Phone photos often exceed the 4.5 MB server upload limit, so large images are
// scaled down and re-encoded as JPEG first. Anything that can't be decoded
// (PDFs, unsupported formats) is sent as-is.
async function shrinkImage(file: File, maxDimension = 2000): Promise<File> {
  if (!file.type.startsWith('image/') || file.size < 1.5 * 1024 * 1024) return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close() // a decoded 12MP photo holds ~48MB until released
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85))
    return blob ? new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' }) : file
  } catch {
    return file
  }
}

export async function uploadSlip(file: File, fields: Record<string, string>) {
  const form = new FormData()
  form.append('file', await shrinkImage(file))
  for (const [key, value] of Object.entries(fields)) form.append(key, value)

  const res = await fetch('/api/slips', { method: 'POST', body: form })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Upload failed')
  return data
}

export async function deleteSlip(id: string) {
  const res = await fetch(`/api/slips/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Failed to remove slip')
  }
}

export const isPdf = (url: string) => /\.pdf($|\?)/i.test(url)

import useSWR, { SWRConfiguration } from 'swr'

// Default fetcher for SWR
export const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    const error = new Error('An error occurred while fetching the data.')
    const data = await res.json().catch(() => ({}))
    ;(error as Error & { info: unknown; status: number }).info = data
    ;(error as Error & { info: unknown; status: number }).status = res.status
    throw error
  }
  return res.json()
}

// Default SWR options for the app
export const defaultSWRConfig: SWRConfiguration = {
  fetcher,
  revalidateOnFocus: false, // Don't refetch when window regains focus
  revalidateOnReconnect: true, // Refetch when network reconnects
  dedupingInterval: 5000, // Dedupe requests within 5 seconds
  errorRetryCount: 3, // Retry failed requests 3 times
}

// Aggressive caching for static/rarely-changing data
export const staticDataConfig: SWRConfiguration = {
  fetcher,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  revalidateIfStale: false,
  dedupingInterval: 60000, // 1 minute deduplication
  errorRetryCount: 3,
}

// Custom hooks for common data fetching patterns
export function useUsers(role?: string, options?: SWRConfiguration) {
  const url = role ? `/api/users?role=${role}` : '/api/users'
  return useSWR(url, fetcher, { ...defaultSWRConfig, ...options })
}

export function useAcademicYears(options?: SWRConfiguration) {
  return useSWR('/api/academic-years', fetcher, { ...staticDataConfig, ...options })
}

export function useLessons(academicYearId?: string, options?: SWRConfiguration) {
  const url = academicYearId
    ? `/api/lessons?academicYearId=${academicYearId}`
    : '/api/lessons'
  return useSWR(url, fetcher, { ...defaultSWRConfig, ...options })
}

export function useEnrollments(mentorId?: string, options?: SWRConfiguration) {
  const url = mentorId
    ? `/api/enrollments?mentorId=${mentorId}`
    : '/api/enrollments'
  return useSWR(url, fetcher, { ...defaultSWRConfig, ...options })
}

export function useDashboardStats(options?: SWRConfiguration) {
  return useSWR('/api/dashboard/stats', fetcher, {
    ...defaultSWRConfig,
    refreshInterval: 30000, // Refresh every 30 seconds
    ...options
  })
}

export function useStudentAnalytics(academicYearId?: string, options?: SWRConfiguration) {
  const url = academicYearId
    ? `/api/students/analytics/batch?academicYearId=${academicYearId}`
    : null
  return useSWR(url, fetcher, { ...defaultSWRConfig, ...options })
}

export function useExamSections(options?: SWRConfiguration) {
  return useSWR('/api/exam-sections', fetcher, { ...staticDataConfig, ...options })
}

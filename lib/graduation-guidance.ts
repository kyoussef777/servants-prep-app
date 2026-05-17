import type { AttendanceAnalytics, ExamAnalytics } from './types'

export interface AttendanceGuidance {
  status: 'on-track' | 'at-risk' | 'failing' | 'no-data'
  message: string
  detail?: string
}

export interface ExamGuidance {
  status: 'on-track' | 'at-risk' | 'failing' | 'no-data'
  message: string
  detail?: string
}

export function getAttendanceGuidance(a: AttendanceAnalytics): AttendanceGuidance {
  const denom = a.allLessons - a.excusedCount
  if (denom <= 0 || a.percentage === null) {
    return { status: 'no-data', message: 'No attendance recorded yet' }
  }

  const required = a.required / 100
  const effective = a.effectivePresent

  if (a.met) {
    // How many more absences can be added before dropping below threshold?
    // (effective) / (denom + n) >= required  →  n <= effective/required - denom
    const buffer = Math.floor(effective / required - denom)
    if (buffer <= 0) {
      return {
        status: 'on-track',
        message: 'Just above the line',
        detail: 'Any further absence will drop you below 75%',
      }
    }
    return {
      status: 'on-track',
      message: `${buffer} absence${buffer === 1 ? '' : 's'} of buffer remaining`,
      detail: `You can miss up to ${buffer} more lesson${buffer === 1 ? '' : 's'} before dropping below ${a.required}%`,
    }
  }

  // Failing: how many consecutive presents needed?
  // (effective + n) / (denom + n) >= required  →  n >= (required*denom - effective) / (1 - required)
  const needed = Math.ceil((required * denom - effective) / (1 - required))
  if (needed > 0 && Number.isFinite(needed)) {
    return {
      status: 'failing',
      message: `Attend the next ${needed} lesson${needed === 1 ? '' : 's'} in a row to recover`,
      detail: `Currently ${(a.percentage ?? 0).toFixed(1)}%. Target is ${a.required}%.`,
    }
  }

  return {
    status: 'failing',
    message: `Below ${a.required}% threshold`,
    detail: `Currently ${(a.percentage ?? 0).toFixed(1)}%`,
  }
}

export function getExamGuidance(e: ExamAnalytics): ExamGuidance {
  const taken = e.examsTaken
  const missing = e.missingExams?.length ?? 0
  const totalExams = taken + missing
  const target = e.requiredAverage

  if (taken === 0 && missing === 0) {
    return { status: 'no-data', message: 'No exams scheduled yet' }
  }

  if (e.overallAverageMet) {
    if (missing === 0) {
      return {
        status: 'on-track',
        message: 'All exams complete, average met',
      }
    }
    // Minimum needed on remaining exams to stay at target
    const currentSum = (e.overallAverage ?? 0) * taken
    const minAvg = (target * totalExams - currentSum) / missing
    if (minAvg <= 0) {
      return {
        status: 'on-track',
        message: `${missing} exam${missing === 1 ? '' : 's'} remaining — average is locked in`,
      }
    }
    return {
      status: 'on-track',
      message: `Score ≥ ${Math.ceil(minAvg)}% on remaining exam${missing === 1 ? '' : 's'} to stay on track`,
      detail: `${missing} exam${missing === 1 ? '' : 's'} remaining`,
    }
  }

  // Failing overall average
  if (missing === 0) {
    return {
      status: 'failing',
      message: 'Average below target with no exams remaining',
      detail: `Currently ${(e.overallAverage ?? 0).toFixed(1)}%, need ${target}%`,
    }
  }

  const currentSum = (e.overallAverage ?? 0) * taken
  const needed = (target * totalExams - currentSum) / missing
  if (needed > 100) {
    return {
      status: 'failing',
      message: `Mathematically out of reach — need >100% on remaining`,
      detail: `Currently ${(e.overallAverage ?? 0).toFixed(1)}%`,
    }
  }
  return {
    status: 'at-risk',
    message: `Need average ≥ ${Math.ceil(needed)}% on the remaining ${missing} exam${missing === 1 ? '' : 's'}`,
    detail: `Currently ${(e.overallAverage ?? 0).toFixed(1)}%, target ${target}%`,
  }
}

export function getFailingSections(e: ExamAnalytics): string[] {
  return e.sectionAverages.filter(s => !s.passingMet).map(s => s.section)
}

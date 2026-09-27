import { describe, expect, it } from 'vitest'
import {
  createSundaySchoolLessonCsvTemplate,
  parseSundaySchoolLessonCsv,
} from '@/lib/sunday-school-lesson-csv'

describe('Sunday School lesson CSV parsing', () => {
  it('parses multiple links and normalizes common date formats', () => {
    const result = parseSundaySchoolLessonCsv([
      'lesson date,topic,resource_1_title,resource_1_url,resource_2_title,resource_2_url',
      '9/27/2026,The Good Samaritan,Slides,https://example.com/slides,Video,https://example.com/video',
    ].join('\n'))

    expect(result.errors).toEqual([])
    expect(result.hasResourceColumns).toBe(true)
    expect(result.rows).toEqual([{
      rowNumber: 2,
      lessonDate: '2026-09-27',
      title: 'The Good Samaritan',
      resources: [
        { title: 'Slides', url: 'https://example.com/slides' },
        { title: 'Video', url: 'https://example.com/video' },
      ],
      replaceResources: true,
    }])
  })

  it('accepts common spreadsheet link headings', () => {
    const result = parseSundaySchoolLessonCsv([
      'Date,Lesson Title,Slides Link,Video Link',
      '2026-10-04,David and Goliath,https://example.com/slides,https://example.com/video',
    ].join('\n'))

    expect(result.errors).toEqual([])
    expect(result.rows[0].resources).toEqual([
      { title: 'Slides', url: 'https://example.com/slides' },
      { title: 'Video', url: 'https://example.com/video' },
    ])
  })

  it('preserves existing links when the spreadsheet has no link columns', () => {
    const result = parseSundaySchoolLessonCsv('date,title\n2026-10-04,David and Goliath')

    expect(result.errors).toEqual([])
    expect(result.rows[0]).toMatchObject({ resources: [], replaceResources: false })
  })

  it('reports invalid dates, missing titles, and unsafe links', () => {
    const result = parseSundaySchoolLessonCsv([
      'date,title,resource_url',
      '2026-02-31,,javascript:alert(1)',
    ].join('\n'))

    expect(result.errors.map(error => error.message)).toEqual([
      'Date must be YYYY-MM-DD or MM/DD/YYYY',
      'Lesson title is required',
      'Resource links must be valid http:// or https:// URLs',
    ])
  })

  it('provides a template that round-trips through the parser', () => {
    const result = parseSundaySchoolLessonCsv(createSundaySchoolLessonCsvTemplate())
    expect(result.errors).toEqual([])
    expect(result.rows).toHaveLength(1)
  })
})

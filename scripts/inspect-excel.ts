import * as XLSX from 'xlsx'

const workbook = XLSX.readFile('/Users/kyoussef/Documents/servants-prep-app/SP_ Speaker & Topic Schedule (2023-Present).xlsx')
const sheetName = workbook.SheetNames.find(name => name.includes('2025-26') || name.includes('2025-2026'))

if (!sheetName) {
  throw new Error('Could not find 2025-26 sheet')
}

console.log(`Sheet: ${sheetName}`)
const worksheet = workbook.Sheets[sheetName]
const data = XLSX.utils.sheet_to_json(worksheet)

console.log(`Total rows: ${data.length}\n`)

// Show first 10 rows with all columns
for (let i = 0; i < Math.min(10, data.length); i++) {
  const row: any = data[i]
  console.log(`Row ${i + 1}:`)
  console.log(`  Date: ${row['Date']}`)
  console.log(`  Meeting No.: ${row['Meeting No.']}`)
  console.log(`  Theme: ${row['Theme']}`)
  console.log(`  Topic: ${row['Topic']}`)
  console.log(`  Speaker: ${row['Speaker']}`)
  console.log()
}

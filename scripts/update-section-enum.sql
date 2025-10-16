-- Step 1: Add new enum values
ALTER TYPE "ExamSectionType" ADD VALUE IF NOT EXISTS 'BIBLE_STUDIES';
ALTER TYPE "ExamSectionType" ADD VALUE IF NOT EXISTS 'RITUAL_THEOLOGY_SACRAMENTS';
ALTER TYPE "ExamSectionType" ADD VALUE IF NOT EXISTS 'CHURCH_HISTORY_COPTIC_HERITAGE';
ALTER TYPE "ExamSectionType" ADD VALUE IF NOT EXISTS 'SPIRITUALITY_OF_SERVANT';

-- Step 2: Update existing records to use new values
UPDATE "ExamSection" SET name = 'BIBLE_STUDIES' WHERE name = 'BIBLE';
UPDATE "ExamSection" SET name = 'RITUAL_THEOLOGY_SACRAMENTS' WHERE name = 'SACRAMENTS';
UPDATE "ExamSection" SET name = 'CHURCH_HISTORY_COPTIC_HERITAGE' WHERE name = 'CHURCH_HISTORY';

-- Step 3: The old values will be removed when we run db:push with the new schema

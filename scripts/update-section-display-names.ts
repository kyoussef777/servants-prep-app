import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function updateDisplayNames() {
  try {
    console.log('🔄 Updating section display names...\n')

    await prisma.examSection.updateMany({
      where: { name: 'BIBLE_STUDIES' },
      data: { displayName: 'Bible Studies' }
    })
    console.log('✅ Updated BIBLE_STUDIES → Bible Studies')

    await prisma.examSection.updateMany({
      where: { name: 'DOGMA' },
      data: { displayName: 'Dogma' }
    })
    console.log('✅ Updated DOGMA → Dogma')

    await prisma.examSection.updateMany({
      where: { name: 'COMPARATIVE_THEOLOGY' },
      data: { displayName: 'Comparative Theology' }
    })
    console.log('✅ Updated COMPARATIVE_THEOLOGY → Comparative Theology')

    await prisma.examSection.updateMany({
      where: { name: 'RITUAL_THEOLOGY_SACRAMENTS' },
      data: { displayName: 'Ritual Theology & Sacraments' }
    })
    console.log('✅ Updated RITUAL_THEOLOGY_SACRAMENTS → Ritual Theology & Sacraments')

    await prisma.examSection.updateMany({
      where: { name: 'CHURCH_HISTORY_COPTIC_HERITAGE' },
      data: { displayName: 'Church History & Coptic Heritage' }
    })
    console.log('✅ Updated CHURCH_HISTORY_COPTIC_HERITAGE → Church History & Coptic Heritage')

    await prisma.examSection.updateMany({
      where: { name: 'PSYCHOLOGY_METHODOLOGY' },
      data: { displayName: 'Psychology & Methodology' }
    })
    console.log('✅ Updated PSYCHOLOGY_METHODOLOGY → Psychology & Methodology')

    // Create the new section if it doesn't exist
    await prisma.examSection.upsert({
      where: { name: 'SPIRITUALITY_OF_SERVANT' },
      update: { displayName: 'The Spirituality of the Servant' },
      create: {
        name: 'SPIRITUALITY_OF_SERVANT',
        displayName: 'The Spirituality of the Servant',
        passingScore: 60,
        averageRequirement: 75
      }
    })
    console.log('✅ Created/Updated SPIRITUALITY_OF_SERVANT → The Spirituality of the Servant')

    console.log('\n✅ All section display names updated!')

  } catch (error) {
    console.error('❌ Error updating display names:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

updateDisplayNames()

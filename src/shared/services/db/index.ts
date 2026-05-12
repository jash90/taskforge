import Dexie, { type EntityTable } from 'dexie'

import type { Category, ProgramPoint, Task, Test } from '@shared/types'

import { seedCategories } from './seedCategories'
import { seedProgramPoints } from './seedPoints'

const db = new Dexie('TaskForgeDB') as Dexie & {
  tasks: EntityTable<Task, 'id'>
  programPoints: EntityTable<ProgramPoint, 'id'>
  tests: EntityTable<Test, 'id'>
  categories: EntityTable<Category, 'id'>
}

db.version(2).stores({
  tasks: 'id, title, subject, level, class, tags, createdAt',
  programPoints: 'id, code, level, class, subject, zakres',
  tests: 'id, title, generatedAt',
})

// v3: re-seed program points from MEN source files
// (the v2 seed misclassified all liceum data as technikum).
db.version(3)
  .stores({
    tasks: 'id, title, subject, level, class, tags, createdAt',
    programPoints: 'id, code, level, class, subject, zakres',
    tests: 'id, title, generatedAt',
  })
  .upgrade(async (tx) => {
    await tx.table('programPoints').clear()
  })

// v4: add categories table for user-defined nested taxonomy.
db.version(4).stores({
  tasks: 'id, title, subject, level, class, tags, createdAt',
  programPoints: 'id, code, level, class, subject, zakres',
  tests: 'id, title, generatedAt',
  categories: 'id, parentId, name, position, createdAt',
})

// v5: merge SchoolLevel 'liceum' and 'technikum' into 'ponadpodstawowa'.
// Migrate existing tasks and clear programPoints for fresh re-seed.
db.version(5)
  .stores({
    tasks: 'id, title, subject, level, class, tags, createdAt',
    programPoints: 'id, code, level, class, subject, zakres',
    tests: 'id, title, generatedAt',
    categories: 'id, parentId, name, position, createdAt',
  })
  .upgrade(async (tx) => {
    await tx
      .table('tasks')
      .toCollection()
      .modify((t: { level?: string }) => {
        if (t.level === 'liceum' || t.level === 'technikum') {
          t.level = 'ponadpodstawowa'
        }
      })
    await tx.table('programPoints').clear()
  })

export default db

export const runSeed = async (): Promise<void> => {
  const ppCount = await db.programPoints.count()
  if (ppCount === 0) {
    await db.programPoints.bulkAdd(seedProgramPoints)
    console.log(`Seeded ${seedProgramPoints.length} program points`)
  }

  const catCount = await db.categories.count()
  if (catCount === 0 && seedCategories.length > 0) {
    await db.categories.bulkAdd(seedCategories)
    console.log(`Seeded ${seedCategories.length} categories`)
  }
}

export { db }

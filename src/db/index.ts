import Dexie, { type EntityTable } from 'dexie';
import type { Task, ProgramPoint, Test, Category } from '../types';
import { seedProgramPoints } from './seedPoints';

const db = new Dexie('TaskForgeDB') as Dexie & {
  tasks: EntityTable<Task, 'id'>;
  programPoints: EntityTable<ProgramPoint, 'id'>;
  tests: EntityTable<Test, 'id'>;
  categories: EntityTable<Category, 'id'>;
};

db.version(2).stores({
  tasks: 'id, title, subject, level, class, tags, createdAt',
  programPoints: 'id, code, level, class, subject, zakres',
  tests: 'id, title, generatedAt',
});

// v3: re-seed program points from MEN source files
// (the v2 seed misclassified all liceum data as technikum).
db.version(3).stores({
  tasks: 'id, title, subject, level, class, tags, createdAt',
  programPoints: 'id, code, level, class, subject, zakres',
  tests: 'id, title, generatedAt',
}).upgrade(async (tx) => {
  await tx.table('programPoints').clear();
});

// v4: add categories table for user-defined nested taxonomy.
db.version(4).stores({
  tasks: 'id, title, subject, level, class, tags, createdAt',
  programPoints: 'id, code, level, class, subject, zakres',
  tests: 'id, title, generatedAt',
  categories: 'id, parentId, name, position, createdAt',
});

export default db;

export const runSeed = async () => {
  const count = await db.programPoints.count();
  if (count > 0) return;
  await db.programPoints.bulkAdd(seedProgramPoints);
  console.log(`Seeded ${seedProgramPoints.length} program points`);
};

export { db };

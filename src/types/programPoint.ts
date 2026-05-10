import type { SchoolLevel } from './index';

export interface ProgramPoint {
  id: string;
  code: string;            // np. "I.3", "II.7"
  description: string;
  level: SchoolLevel;
  class: string;
  subject: string;
  zakres?: string;         // "podstawowy" | "rozszerzony" (dla liceum)
  dzialNazwa?: string;     // np. "Ruch i siły"
  dzialNumer?: string;     // np. "I", "II"
  lpWDziale?: number;      // numer wewnątrz działu
}

export const EMPTY_PROGRAM_POINT: Omit<ProgramPoint, 'id'> = {
  code: '',
  description: '',
  level: 'podstawowa',
  class: '',
  subject: 'Fizyka',
};

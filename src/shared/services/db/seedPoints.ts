import type { ProgramPoint } from '@shared/types'
import { parseMENCurriculum, isMENCurriculum } from './menParser'

// Vite inlines every JSON in the curriculum directory at build time.
// Files there use the Polish MEN format (etap_edukacyjny / klasa / przedmiot / dzialy[]).
const files = import.meta.glob<unknown>('../../../../podstawa programowa/*.json', {
  eager: true,
  import: 'default',
})

export const seedProgramPoints: ProgramPoint[] = Object.values(files).flatMap((data) =>
  isMENCurriculum(data) ? parseMENCurriculum(data) : [],
)

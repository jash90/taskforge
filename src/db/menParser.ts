import type { ProgramPoint, SchoolLevel } from '../types';

export interface MENDzial {
  numer: string;
  nazwa: string;
  tresci: string[];
}

export interface MENCurriculum {
  etap_edukacyjny?: string;
  klasa: number | string;
  przedmiot: string;
  zakres?: string;
  dzialy: MENDzial[];
}

const slug = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const levelsForEtap = (etap: string | undefined): SchoolLevel[] => {
  if (!etap) return ['podstawowa'];
  const e = etap.toLowerCase();
  if (e.includes('podstawow')) return ['podstawowa'];
  // "Liceum ogólnokształcące i technikum" — same curriculum applies to both
  const out: SchoolLevel[] = [];
  if (e.includes('liceum')) out.push('liceum');
  if (e.includes('technikum')) out.push('technikum');
  return out.length > 0 ? out : ['liceum'];
};

export function isMENCurriculum(data: unknown): data is MENCurriculum {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  if (!Array.isArray(d.dzialy)) return false;
  return d.dzialy.every((dz) =>
    !!dz && typeof dz === 'object' && Array.isArray((dz as Record<string, unknown>).tresci),
  );
}

export function parseMENCurriculum(data: MENCurriculum): ProgramPoint[] {
  const klasa = String(data.klasa ?? '');
  const subject = (data.przedmiot ?? 'Inne').trim();
  const zakres = data.zakres?.trim() || undefined;
  const levels = levelsForEtap(data.etap_edukacyjny);
  const subjectSlug = slug(subject);
  const out: ProgramPoint[] = [];

  for (const lvl of levels) {
    for (const dz of data.dzialy ?? []) {
      let lp = 0;
      for (const tresc of dz.tresci ?? []) {
        lp += 1;
        const code = `${dz.numer}.${lp}`;
        const id = `pp-${subjectSlug}-${lvl}-k${klasa}-${zakres ?? 'x'}-${dz.numer}-${lp}`;
        out.push({
          id,
          code,
          description: tresc,
          level: lvl,
          class: klasa,
          subject,
          zakres,
          dzialNazwa: dz.nazwa,
          dzialNumer: dz.numer,
          lpWDziale: lp,
        });
      }
    }
  }

  return out;
}

import type { Task, Test, ProgramPoint, Category } from '../types';
import { isMENCurriculum, parseMENCurriculum } from '../db/menParser';
import { isNestedCategoryFile, parseNestedCategories } from '../db/categoryParser';

export function exportTasksToJSON(
  tasks: Task[],
  tests: Test[],
  programPoints: ProgramPoint[] = [],
  categories: Category[] = [],
): string {
  const data = {
    version: 3,
    type: 'taskforge-backup',
    exportedAt: Date.now(),
    tasks,
    tests,
    programPoints,
    categories,
  };
  return JSON.stringify(data, null, 2);
}

export function importTasksFromJSON(json: string): {
  tasks: Task[];
  tests: Test[];
  programPoints: ProgramPoint[];
  categories: Category[];
} {
  const data = JSON.parse(json);
  if (!data.tasks || !Array.isArray(data.tasks)) {
    throw new Error('Nieprawidłowy format pliku: brak tablicy zadań');
  }
  return {
    tasks: data.tasks as Task[],
    tests: Array.isArray(data.tests) ? (data.tests as Test[]) : [],
    programPoints: Array.isArray(data.programPoints) ? (data.programPoints as ProgramPoint[]) : [],
    categories: Array.isArray(data.categories) ? (data.categories as Category[]) : [],
  };
}

export function exportCategoriesToJSON(categories: Category[]): string {
  const data = {
    version: 1,
    type: 'taskforge-categories',
    exportedAt: Date.now(),
    categories,
  };
  return JSON.stringify(data, null, 2);
}

export function importCategoriesFromJSON(json: string): Category[] {
  const data = JSON.parse(json);
  // 1) Polish nested format: { kategorie: [{ nazwa, poddzialy: [{ nazwa, podpunkty: [...] }] }] }
  if (isNestedCategoryFile(data)) {
    return parseNestedCategories(data);
  }
  // 2) Native TaskForge format (dedicated file or full backup)
  const cats = data.categories;
  if (!Array.isArray(cats)) {
    throw new Error('Plik nie zawiera kategorii (oczekiwano formatu TaskForge lub zagnieżdżonego MEN).');
  }
  for (const c of cats) {
    if (typeof c?.id !== 'string' || typeof c?.name !== 'string') {
      throw new Error('Niepoprawny format kategorii — brak pola id lub name.');
    }
  }
  return cats as Category[];
}

export function exportProgramPointsToJSON(points: ProgramPoint[]): string {
  const data = {
    version: 1,
    type: 'taskforge-program-points',
    exportedAt: Date.now(),
    programPoints: points,
  };
  return JSON.stringify(data, null, 2);
}

export function importProgramPointsFromJSON(json: string): ProgramPoint[] {
  const data = JSON.parse(json);
  // 1) Polish MEN curriculum format (etap_edukacyjny / klasa / przedmiot / dzialy[])
  if (isMENCurriculum(data)) {
    return parseMENCurriculum(data);
  }
  // 2) Native TaskForge format (dedicated podstawa file or full backup)
  const points = data.programPoints;
  if (!Array.isArray(points)) {
    throw new Error('Plik nie zawiera punktów podstawy programowej (oczekiwano formatu TaskForge lub MEN).');
  }
  for (const p of points) {
    if (typeof p?.code !== 'string' || typeof p?.description !== 'string') {
      throw new Error('Niepoprawny format punktu — brak pola code lub description.');
    }
  }
  return points as ProgramPoint[];
}

export function copyAsWord(task: Task): string {
  const html = `
<html>
<head>
<meta charset="UTF-8">
<style>
body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.5; }
h1 { font-size: 14pt; font-weight: bold; margin-bottom: 6pt; }
h2 { font-size: 12pt; font-weight: bold; margin-top: 12pt; margin-bottom: 4pt; }
p { margin: 4pt 0; }
.meta { font-size: 10pt; color: #555; margin-bottom: 8pt; }
.answer { margin-top: 12pt; padding: 8pt; background: #f5f5f5; border-left: 3pt solid #333; }
table { border-collapse: collapse; width: 100%; margin: 8pt 0; }
td, th { border: 1pt solid #999; padding: 4pt; font-size: 11pt; }
th { background: #eee; font-weight: bold; }
</style>
</head>
<body>
  <h1>${escapeHtml(task.title)}</h1>
  <div class="meta">
    Przedmiot: ${escapeHtml(task.subject)} | Poziom: ${task.level} | Klasa: ${escapeHtml(task.class)}
    ${task.tags.length > 0 ? ' | Tagi: ' + task.tags.map(escapeHtml).join(', ') : ''}
  </div>

  <h2>Treść zadania</h2>
  <p>${formatContent(task.content)}</p>

  ${task.parameters.length > 0 ? `
  <h2>Parametry</h2>
  <table>
    <tr><th>Nazwa</th><th>Wartość</th><th>Zakres losowania</th></tr>
    ${task.parameters.map(p => `
      <tr>
        <td>${escapeHtml(p.name)} ${p.unit ? `(${p.unit})` : ''}</td>
        <td>${typeof p.value === 'number' ? String(p.value).replace('.', ',') : escapeHtml(String(p.value))}</td>
        <td>${p.min !== undefined && p.max !== undefined ? `${String(p.min).replace('.', ',')} – ${String(p.max).replace('.', ',')}` : '—'}</td>
      </tr>
    `).join('')}
  </table>
  ` : ''}

  ${task.answerKey.length > 0 ? `
  <h2>Klucz odpowiedzi</h2>
  <table>
    <tr><th>Lp.</th><th>Odpowiedź</th><th>Punkty</th><th>Wyjaśnienie</th></tr>
    ${task.answerKey.map((a, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(a.answer)}</td>
        <td>${a.points}</td>
        <td>${a.explanation ? escapeHtml(a.explanation) : '—'}</td>
      </tr>
    `).join('')}
  </table>
  ` : ''}

  <h2>Kryteria oceniania</h2>
  <table>
    <tr><td><strong>Metoda rozwiązania</strong></td><td>${escapeHtml(task.specification.answerKeyMethod || '—')}</td></tr>
    <tr><td><strong>Odpowiedź</strong></td><td>${escapeHtml(task.specification.answerKeyAnswer || '—')}</td></tr>
    <tr><td><strong>Wnioski</strong></td><td>${escapeHtml(task.specification.answerKeyConclusions || '—')}</td></tr>
  </table>
</body>
</html>`;
  return html;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatContent(content: string): string {
  return escapeHtml(content).replace(/\n/g, '<br>');
}

export function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function generateTestDoc(testTitle: string, tasks: Task[]): string {
  const totalPoints = tasks.reduce((sum, t) => sum + t.answerKey.reduce((s, a) => s + a.points, 0), 0);

  const html = `
<html>
<head>
<meta charset="UTF-8">
<style>
body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.5; max-width: 800px; margin: 0 auto; padding: 24pt; }
.header { text-align: center; border-bottom: 2pt solid #333; padding-bottom: 12pt; margin-bottom: 20pt; }
h1 { font-size: 16pt; margin: 4pt 0; }
h2 { font-size: 13pt; margin-top: 16pt; }
.meta { font-size: 10pt; color: #444; }
.task { margin-bottom: 16pt; page-break-inside: avoid; }
.task-header { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 0.5pt solid #ccc; padding-bottom: 2pt; margin-bottom: 4pt; }
.task-title { font-weight: bold; font-size: 12pt; }
.task-points { font-size: 10pt; color: #555; }
.task-body { margin-left: 12pt; }
.answer-box { border: 1pt solid #999; min-height: 40pt; margin-top: 6pt; padding: 4pt; }
.footer { margin-top: 24pt; font-size: 10pt; color: #555; border-top: 1pt solid #ccc; padding-top: 8pt; }
</style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(testTitle)}</h1>
    <div class="meta">Liczba zadań: ${tasks.length} | Maksymalna liczba punktów: ${totalPoints}</div>
  </div>

  ${tasks.map((t, idx) => {
    const pts = t.answerKey.reduce((s, a) => s + a.points, 0);
    return `
    <div class="task">
      <div class="task-header">
        <span class="task-title">Zadanie ${idx + 1}</span>
        <span class="task-points">${pts} pkt</span>
      </div>
      <div class="task-body">
        <p>${formatContent(t.content)}</p>
        ${t.answerKey.length > 1 ? t.answerKey.map((_a, i) => `
          <div>${String.fromCharCode(97 + i)}) ______________________________________</div>
        `).join('') : '<div class="answer-box"></div>'}
      </div>
    </div>
    `;
  }).join('')}

  <div class="footer">
    Imię i nazwisko: ________________________________  Data: ________________  Klasa: ________________
  </div>
</body>
</html>`;

  return html;
}

export function generateTestAnswerKey(testTitle: string, tasks: Task[]): string {
  const totalPoints = tasks.reduce((sum, t) => sum + t.answerKey.reduce((s, a) => s + a.points, 0), 0);

  const html = `
<html>
<head>
<meta charset="UTF-8">
<style>
body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.5; max-width: 800px; margin: 0 auto; padding: 24pt; }
h1 { font-size: 16pt; text-align: center; }
table { border-collapse: collapse; width: 100%; margin: 12pt 0; }
td, th { border: 1pt solid #333; padding: 6pt; text-align: left; }
th { background: #eee; font-weight: bold; }
.total { font-weight: bold; text-align: right; margin-top: 12pt; }
</style>
</head>
<body>
  <h1>Klucz odpowiedzi – ${escapeHtml(testTitle)}</h1>
  <table>
    <tr><th>Zadanie</th><th>Odpowiedź / Odpowiedzi</th><th>Punkty</th><th>Wyjaśnienie</th></tr>
    ${tasks.map((t, ti) => t.answerKey.map((a, ai) => `
      <tr>
        <td>${ti + 1}${String.fromCharCode(97 + ai)}</td>
        <td>${escapeHtml(a.answer)}</td>
        <td>${a.points}</td>
        <td>${a.explanation ? escapeHtml(a.explanation) : '—'}</td>
      </tr>
    `).join('')).join('')}
  </table>
  <div class="total">Razem punktów: ${totalPoints}</div>
</body>
</html>`;

  return html;
}
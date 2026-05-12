import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, HeadingLevel, PageOrientation,
} from 'docx';
import type { Task, Test, ProgramPoint, Category } from '../types';
import { isMENCurriculum, parseMENCurriculum } from '../db/menParser';
import { isNestedCategoryFile, parseNestedCategories } from '../db/categoryParser';

/** Computes total points for a task, accounting for closed (ABCD) type. */
export function taskPoints(t: Task): number {
  if (t.taskType === 'closed' && t.choices && t.choices.length > 0) {
    return t.choices.reduce((s, c) => s + (c.isCorrect ? (c.points ?? 1) : (c.points ?? 0)), 0);
  }
  return t.answerKey.reduce((s, a) => s + a.points, 0);
}

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

  ${task.taskType === 'closed' && task.choices && task.choices.length > 0 ? `
  <h2>Warianty odpowiedzi</h2>
  <ol style="list-style:none; padding-left: 0;">
    ${task.choices.map((c, i) => `
      <li style="margin: 4pt 0;">
        <strong>${String.fromCharCode(97 + i)})</strong> ${escapeHtml(c.content)}
        ${c.isCorrect ? ' <span style="background:#dcfce7; padding:1pt 4pt; font-size:10pt;">poprawna</span>' : ''}
      </li>
    `).join('')}
  </ol>
  ${task.shuffleChoices ? '<p style="font-size:10pt; color:#666;">Kolejność wariantów może być losowana podczas generowania.</p>' : ''}
  ` : ''}

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
  downloadBlob(blob, filename);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Generates a real .docx file (OOXML zip) for the test sheet. */
export async function generateTestDocx(testTitle: string, tasks: Task[]): Promise<Blob> {
  const totalPoints = tasks.reduce((sum, t) => sum + taskPoints(t), 0);
  const children: Paragraph[] = [];

  // Identification block FIRST — this is what students need to fill in.
  // Each field on its own line so there's enough room to actually write.
  children.push(new Paragraph({
    children: [new TextRun({ text: 'Imię i nazwisko: ____________________________________________________', size: 22 })],
    spacing: { after: 200 },
  }));
  children.push(new Paragraph({
    children: [new TextRun({ text: 'Data: ____________________      Klasa: ____________________', size: 22 })],
    spacing: { after: 360 },
  }));

  // Title — smaller, plain weight, no border. Just a label, not the focus.
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: testTitle, size: 24 })],
    spacing: { after: 80 },
  }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({
      text: `Liczba zadań: ${tasks.length}   |   Maksymalna liczba punktów: ${totalPoints}`,
      size: 18, color: '888888',
    })],
    spacing: { after: 360 },
  }));

  // Tasks
  tasks.forEach((t, idx) => {
    const pts = taskPoints(t);
    const isClosed = t.taskType === 'closed' && t.choices && t.choices.length > 0;

    children.push(new Paragraph({
      children: [
        new TextRun({ text: `Zadanie ${idx + 1}`, bold: true, size: 24 }),
        new TextRun({ text: `\t${pts} pkt`, size: 20, color: '555555' }),
      ],
      tabStops: [{ type: 'right', position: 9000 }],
      border: { bottom: { color: 'cccccc', size: 4, style: BorderStyle.SINGLE, space: 2 } },
      spacing: { before: 240, after: 120 },
      keepNext: true,
    }));

    children.push(new Paragraph({
      children: [new TextRun({ text: t.content, size: 22 })],
      indent: { left: 240 },
      spacing: { after: 120 },
    }));

    if (isClosed) {
      t.choices!.forEach((c, i) => {
        children.push(new Paragraph({
          children: [
            new TextRun({ text: '○  ', size: 24 }),
            new TextRun({ text: `${String.fromCharCode(97 + i)}) `, bold: true, size: 22 }),
            new TextRun({ text: c.content, size: 22 }),
          ],
          indent: { left: 480 },
          spacing: { after: 80 },
        }));
      });
    } else if (t.answerKey.length > 1) {
      t.answerKey.forEach((_a, i) => {
        children.push(new Paragraph({
          children: [new TextRun({
            text: `${String.fromCharCode(97 + i)}) ______________________________________`,
            size: 22,
          })],
          indent: { left: 240 },
          spacing: { after: 80 },
        }));
      });
    } else {
      // Empty answer box: three blank lines with a bottom border
      children.push(new Paragraph({
        children: [new TextRun({ text: '', size: 22 })],
        indent: { left: 240 },
        spacing: { after: 240 },
      }));
      children.push(new Paragraph({
        children: [new TextRun({ text: '', size: 22 })],
        indent: { left: 240 },
        border: { bottom: { color: '999999', size: 4, style: BorderStyle.SINGLE, space: 2 } },
        spacing: { after: 240 },
      }));
    }
  });

  const doc = new Document({
    sections: [{
      properties: { page: { size: { orientation: PageOrientation.PORTRAIT } } },
      children,
    }],
    styles: {
      default: { document: { run: { font: 'Times New Roman' } } },
    },
  });

  return await Packer.toBlob(doc);
}

/** Generates a real .docx file with the answer key table. */
export async function generateTestAnswerKeyDocx(testTitle: string, tasks: Task[]): Promise<Blob> {
  const totalPoints = tasks.reduce((sum, t) => sum + taskPoints(t), 0);

  const cell = (text: string, opts?: { bold?: boolean; shading?: string }) =>
    new TableCell({
      shading: opts?.shading ? { fill: opts.shading } : undefined,
      children: [new Paragraph({
        children: [new TextRun({ text, bold: !!opts?.bold, size: 20 })],
      })],
    });

  const headerRow = new TableRow({
    tableHeader: true,
    children: ['Zadanie', 'Odpowiedź / Odpowiedzi', 'Punkty', 'Wyjaśnienie'].map((t) =>
      cell(t, { bold: true, shading: 'eeeeee' })
    ),
  });

  const dataRows: TableRow[] = [];
  tasks.forEach((t, ti) => {
    if (t.taskType === 'closed' && t.choices && t.choices.length > 0) {
      const correctLetters = t.choices
        .map((c, ci) => (c.isCorrect ? String.fromCharCode(97 + ci) : null))
        .filter(Boolean)
        .join(', ');
      const explanation = t.choices.find((c) => c.isCorrect)?.explanation || '';
      dataRows.push(new TableRow({
        children: [
          cell(String(ti + 1)),
          cell(correctLetters || '—', { bold: true }),
          cell(String(taskPoints(t))),
          cell(explanation),
        ],
      }));
    } else {
      t.answerKey.forEach((a, ai) => {
        dataRows.push(new TableRow({
          children: [
            cell(`${ti + 1}${String.fromCharCode(97 + ai)}`),
            cell(a.answer),
            cell(String(a.points)),
            cell(a.explanation || '—'),
          ],
        }));
      });
    }
  });

  const table = new Table({
    rows: [headerRow, ...dataRows],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });

  const doc = new Document({
    sections: [{
      properties: { page: { size: { orientation: PageOrientation.PORTRAIT } } },
      children: [
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: `Klucz odpowiedzi – ${testTitle}`, bold: true, size: 32 })],
          spacing: { after: 240 },
        }),
        table,
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: `Razem punktów: ${totalPoints}`, bold: true, size: 22 })],
          spacing: { before: 240 },
        }),
      ],
    }],
    styles: {
      default: { document: { run: { font: 'Times New Roman' } } },
    },
  });

  return await Packer.toBlob(doc);
}
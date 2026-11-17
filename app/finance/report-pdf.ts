import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { formatEntryDate } from "./daily-entry";
import { formatMoney, formatMonth, formatPeriod, missingRecordNotices, reportNames, type FinanceReport, type ReportKind } from "./reporting";

const pageWidth = 595.28;
const pageHeight = 841.89;
const margin = 40;
const width = pageWidth - margin * 2;
const bottom = 53;
const bodyTop = pageHeight - 174;
const navy = rgb(0.06, 0.16, 0.34);
const blue = rgb(0.085, 0.26, 0.63);
const orange = rgb(0.78, 0.28, 0.05);
const muted = rgb(0.30, 0.37, 0.49);
const line = rgb(0.85, 0.89, 0.94);
const stripes = rgb(0.966, 0.978, 0.995);
const warning = rgb(1, 0.95, 0.90);

interface Column {
  title: string;
  width: number;
  amount?: boolean;
}

async function brandMark(document: PDFDocument) {
  try {
    const logo = await fetch("/brand/levelgrid-mark.png");
    if (logo.ok) return await document.embedPng(await logo.arrayBuffer());
  } catch {
    // The branded text header remains available if the logo fetch fails.
  }
}

export async function createReportPdf(report: FinanceReport, kind: ReportKind) {
  const document = await PDFDocument.create();
  const [regular, bold, mark] = await Promise.all([
    document.embedFont(StandardFonts.Helvetica),
    document.embedFont(StandardFonts.HelveticaBold),
    brandMark(document),
  ]);
  const glyphs = new Set(regular.getCharacterSet());
  let replacedCharacters = false;
  let page: PDFPage;
  let y = bodyTop;
  const title = reportNames[kind];
  const period = kind === "monthly" ? formatMonth(report.period.from.slice(0, 7)) : formatPeriod(report.period);
  document.setTitle("Levelgrid Finance - " + title);
  document.setAuthor("Levelgrid Enterprises");
  document.setSubject(period);

  function printable(input: string) {
    return Array.from(input.normalize("NFC").replace(/[\u2010-\u2015\u2212]/g, "-").replace(/\s+/g, " "), (character) => {
      if (glyphs.has(character.codePointAt(0)!)) return character;
      const base = character.normalize("NFKD").replace(/\p{Mark}/gu, "");
      if (base && Array.from(base).every((part) => glyphs.has(part.codePointAt(0)!))) return base;
      replacedCharacters = true;
      return "?";
    }).join("");
  }

  function text(value: string, x: number, baseline: number, available: number, options?: {
    size?: number;
    font?: PDFFont;
    right?: boolean;
    color?: ReturnType<typeof rgb>;
  }) {
    const content = printable(value);
    const font = options?.font ?? regular;
    const size = options?.size ?? 9.5;
    const length = font.widthOfTextAtSize(content, size);
    const fittedSize = length > available ? size * available / length : size;
    page.drawText(content, {
      x: options?.right ? x + available - font.widthOfTextAtSize(content, fittedSize) : x,
      y: baseline, size: fittedSize, font, color: options?.color ?? navy,
    });
  }

  function wrap(value: string, available: number, size: number) {
    const lines: string[] = [];
    let current = "";
    for (const word of printable(value).trim().split(/ +/)) {
      const next = current ? current + " " + word : word;
      if (regular.widthOfTextAtSize(next, size) <= available) {
        current = next;
        continue;
      }
      if (current) lines.push(current);
      current = "";
      for (const character of word) {
        if (regular.widthOfTextAtSize(current + character, size) > available && current) {
          lines.push(current);
          current = "";
        }
        current += character;
      }
    }
    if (current || lines.length === 0) lines.push(current);
    return lines;
  }

  function newPage() {
    page = document.addPage([pageWidth, pageHeight]);
    page.drawRectangle({ x: 0, y: pageHeight - 6, width: pageWidth, height: 6, color: orange });
    if (mark) page.drawImage(mark, { x: margin, y: pageHeight - 79, width: 37, height: 37 });
    const brandX = mark ? margin + 49 : margin;
    text("LEVELGRID ENTERPRISES", brandX, pageHeight - 57, pageWidth - brandX - margin,
      { size: 11, font: bold, color: orange });
    text("Financial Records", brandX, pageHeight - 74, pageWidth - brandX - margin,
      { size: 12, font: bold });
    text(title, margin, pageHeight - 118, width, { size: 22, font: bold, color: blue });
    text(period + "  |  ZMW", margin, pageHeight - 141, width, { size: 11, color: muted });
    page.drawLine({ start: { x: margin, y: pageHeight - 153 }, end: { x: pageWidth - margin, y: pageHeight - 153 }, color: line, thickness: 1 });
    y = bodyTop;
  }

  function ensureSpace(height: number) {
    if (y - height < bottom) newPage();
  }

  function paragraph(value: string, color = muted) {
    for (const row of wrap(value, width, 10)) {
      ensureSpace(15);
      text(row, margin, y - 10, width, { size: 10, color });
      y -= 15;
    }
    y -= 5;
  }

  function notice(value: string) {
    const lines = wrap(value, width - 22, 10);
    const blockHeight = 13 * lines.length + 14;
    ensureSpace(blockHeight);
    page.drawRectangle({ x: margin, y: y - blockHeight, width, height: blockHeight, color: warning });
    page.drawRectangle({ x: margin, y: y - blockHeight, width: 3, height: blockHeight, color: orange });
    lines.forEach((row, index) => text(row, margin + 12, y - 15 - index * 13, width - 22, { size: 10 }));
    y -= blockHeight + 6;
  }

  function table(heading: string, columns: Column[], rows: string[][]) {
    function header() {
      text(heading, margin, y - 13, width, { font: bold, size: 13, color: blue });
      y -= 22;
      page.drawRectangle({ x: margin, y: y - 23, width, height: 23, color: blue });
      let x = margin;
      for (const column of columns) {
        text(column.title, x + 7, y - 15, column.width - 14, { font: bold, size: 9, right: column.amount, color: rgb(1, 1, 1) });
        x += column.width;
      }
      y -= 23;
    }

    ensureSpace(72);
    header();
    for (const [index, values] of rows.entries()) {
      const entries = columns.map((column, col) => column.amount
        ? [values[col]] : wrap(values[col], column.width - 14, 9.5));
      const lineCount = Math.max(...entries.map((entry) => entry.length));
      let offset = 0;
      while (offset < lineCount) {
        if (y - 23 < bottom) {
          newPage();
          header();
        }
        const visible = Math.min(lineCount - offset, Math.floor((y - bottom - 10) / 13));
        const height = visible * 13 + 10;
        if (index % 2 === 0) page.drawRectangle({ x: margin, y: y - height, width, height, color: stripes });
        let x = margin;
        for (const [col, column] of columns.entries()) {
          entries[col].slice(offset, offset + visible).forEach((entry, row) => {
            text(entry, x + 7, y - 15 - row * 13, column.width - 14, { right: column.amount });
          });
          x += column.width;
        }
        page.drawLine({ start: { x: margin, y: y - height }, end: { x: pageWidth - margin, y: y - height }, color: line, thickness: 0.5 });
        y -= height;
        offset += visible;
      }
    }
    y -= 21;
  }

  newPage();
  if (report.department) {
    paragraph(report.department.name + (report.department.deactivatedAt ? " (inactive)" : ""), navy);
  }
  if (report.coveredThrough < report.period.through) {
    paragraph("Coverage through " + formatEntryDate(report.coveredThrough) + ".");
  }
  const coverage = missingRecordNotices(report);
  if (report.days.length === 0 && coverage.length === 0) coverage.push("No confirmed entries in this period.");
  if (coverage.length) notice(coverage.join(" "));
  if (report.pendingChanges > 0) {
    const label = report.pendingChanges === 1 ? "change in this report is" : "changes in this report are";
    notice(`${report.pendingChanges} ${label} awaiting sync. Figures reflect the entries saved on this phone.`);
  }
  if (coverage.length > 0 || report.pendingChanges > 0) y -= 10;

  const amount = (value: bigint) => report.days.length > 0 ? formatMoney(value) : "-";
  const { totals } = report;
  const summaryRows = report.department ? [
    ["Sales", amount(totals.sales)],
    ["Expenses", amount(totals.expenses)],
    ["Balance", amount(totals.balance)],
  ] : [
    ["Business sales", amount(totals.sales)],
    ["Departmental expenses", amount(totals.departmentExpenses)],
    ["Finance Expenses", amount(totals.financeExpenses)],
    ["Total expenses", amount(totals.expenses)],
    ["Overall balance", amount(totals.balance)],
  ];
  table("Summary", [
    { title: "Item", width: width - 172 },
    { title: "Amount (ZMW)", width: 172, amount: true },
  ], summaryRows);

  if (!report.department && report.departments.length > 0) {
    table("Department totals", [
      { title: "Department", width: width - 336 },
      { title: "Sales", width: 112, amount: true },
      { title: "Expenses", width: 112, amount: true },
      { title: "Balance", width: 112, amount: true },
    ], report.departments.map((department) => [
      department.name + (department.inactive ? " (inactive)" : ""),
      formatMoney(department.sales), formatMoney(department.expenses), formatMoney(department.balance),
    ]));
  }

  if (kind !== "daily" && report.days.length > 0) {
    table("Confirmed entries by day", [
      { title: "Date", width: 83 },
      { title: "Sales", width: 101, amount: true },
      { title: "Expenses", width: 101, amount: true },
      { title: "Balance", width: 101, amount: true },
      { title: "Coverage", width: width - 386 },
    ], report.days.map((day) => [
      formatEntryDate(day.date), formatMoney(day.sales), formatMoney(day.expenses), formatMoney(day.balance),
      day.incomplete ? "Incomplete" : "Confirmed",
    ]));
  }

  if (report.notes.length > 0) {
    ensureSpace(51);
    text("Expense notes", margin, y - 13, width, { font: bold, size: 13, color: blue });
    y -= 23;
    for (const note of report.notes) {
      ensureSpace(34);
      text(formatEntryDate(note.date) + " - " + note.department, margin, y - 10, width, { font: bold, size: 10 });
      y -= 15;
      paragraph(note.comment, navy);
    }
  }
  if (replacedCharacters) paragraph("Characters unavailable in the PDF font appear as question marks.");

  const pages = document.getPages();
  pages.forEach((current, index) => {
    page = current;
    page.drawLine({ start: { x: margin, y: 43 }, end: { x: pageWidth - margin, y: 43 }, color: line, thickness: 1 });
    text("Levelgrid Enterprises", margin, 27, width / 2, { size: 9, color: muted });
    text(`Page ${index + 1} of ${pages.length}`, margin + width / 2, 27, width / 2, { size: 9, color: muted, right: true });
  });

  return new Blob([new Uint8Array(await document.save())], { type: "application/pdf" });
}

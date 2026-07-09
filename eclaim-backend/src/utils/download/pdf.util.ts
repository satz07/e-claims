import PDFDocument from 'pdfkit';
import { ExportRow } from './export.util';
import { Response } from 'express';

export function sendPDF(
  rows: ExportRow[],
  columns: string[],
  res: Response,
  title = 'Export',
  filename = 'export.pdf',
) {
  const doc = new PDFDocument({ size: 'A4', margin: 30 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
  doc.pipe(res);

  // ===== Title =====
  doc.fontSize(16).font('Helvetica-Bold').text(title, { align: 'center' });
  doc.moveDown(1);

  // ===== Table Config =====
  const startX = 30;
  let startY = doc.y;
  const padding = 5;
  const pageWidth = doc.page.width - startX * 2;
  const colWidth = pageWidth / columns.length;

  const drawRow = (y: number, row: ExportRow, isHeader = false) => {
    // First, calculate max height needed for this row
    let maxHeight = 0;
    const cellHeights: number[] = [];

    columns.forEach((col) => {
      const text = row[col] ? String(row[col]) : '';
      const options = { width: colWidth - padding * 2, align: 'left' };
      const height = doc.heightOfString(text, options) + padding * 2;
      cellHeights.push(height);
      if (height > maxHeight) maxHeight = height;
    });

    // Page break if needed
    if (y + maxHeight > doc.page.height - 40) {
      doc.addPage();
      startY = 30;
      drawRow(startY, row, true); // header on new page
      startY += maxHeight;
      return;
    }

    // Draw each cell and text
    columns.forEach((col, i) => {
      const x = startX + i * colWidth;
      const cellHeight = maxHeight;

      // Draw border
      doc.rect(x, y, colWidth, cellHeight).stroke();

      // Draw text
      doc
        .font(isHeader ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(10)
        .text(String(row[col] ?? ''), x + padding, y + padding, {
          width: colWidth - padding * 2,
        });
    });

    // Draw horizontal line below row
    doc
      .moveTo(startX, y + maxHeight)
      .lineTo(startX + colWidth * columns.length, y + maxHeight)
      .stroke();

    return maxHeight;
  };

  // ===== Header Row =====
  const headerRow: ExportRow = {};
  columns.forEach((c) => (headerRow[c] = c));
  const headerHeight = drawRow(startY, headerRow, true);
  startY += headerHeight;

  // ===== Data Rows =====
  rows.forEach((row) => {
    const rowHeight = drawRow(startY, row);
    startY += rowHeight;
  });

  doc.end();
}

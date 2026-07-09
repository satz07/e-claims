import { Parser } from 'json2csv';
import { ExportRow } from './export.util';
import { Response } from 'express';

/**
 * Send CSV response
 */
export function sendCSV(
  rows: ExportRow[],
  columns: string[],
  res: Response,
  filename = 'export.csv',
) {
  const parser = new Parser({ fields: columns });
  const csv = parser.parse(rows);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
  res.send(csv);
}

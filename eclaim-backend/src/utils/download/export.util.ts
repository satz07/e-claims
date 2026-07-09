export interface ExportColumn<T> {
  header: string; // Column header
  key: keyof T | 'sn'; // Field key
  formatter?: (row: T) => string | number; // Custom formatting
}

export type ExportRow = Record<string, string | number>;

/**
 * Build rows in export format
 * - any data, any service
 * - handles serial number
 */
export function buildExportRows<T>(
  data: T[],
  columns: ExportColumn<T>[],
): ExportRow[] {
  return data.map((row, index) => {
    const result: ExportRow = {};
    columns.forEach((col) => {
      if (col.key === 'sn') {
        result[col.header] = index + 1;
      } else if (col.formatter) {
        result[col.header] = col.formatter(row);
      } else {
        result[col.header] = (row as any)[col.key];
      }
    });
    return result;
  });
}

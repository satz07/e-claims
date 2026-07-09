import { UserBank } from 'src/database/entities/user-bank.entity';
import { formatDateTime } from 'src/utils/download/date.util';
import { ExportColumn } from 'src/utils/download/export.util';

export const bankExportColumns: ExportColumn<UserBank>[] = [
  { header: 'S.No', key: 'sn' },
  { header: 'Account Name', key: 'accountName' },
  { header: 'IBAN Number', key: 'iban' },
  { header: 'Status', key: 'status' },
  {
    header: 'User Type',
    key: 'kyc',
    formatter: (b) => b.kyc?.accountType ?? '',
  },
  {
    header: 'Created At',
    key: 'createdAt',
    formatter: (b) => formatDateTime(b.createdAt),
  },
];

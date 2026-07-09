import { formatDateTime } from 'src/utils/download/date.util';

export const transactionExportColumns = [
  { header: 'S.No', key: 'sn' },
  {
    header: 'Account Name',
    key: 'bank',
    formatter: (b) => b.bank?.accountName ?? '', // assuming UserBank.bank.name exists
  },
  {
    header: 'Type',
    key: 'kyc',
    formatter: (b) => b.kyc?.accountType ?? '', // Individual / Business
  },
  {
    header: 'Transaction Type',
    key: 'transactionType', // assuming UserBank.transactionType exists
  },
  {
    header: 'Reference ID',
    key: 'referenceId', // assuming UserBank.referenceId exists
  },
  {
    header: 'IBAN Number',
    key: 'iban',
    formatter: (b) => b.bank?.iban ?? '', // Individual / Business
  },
  {
    header: 'Wallet Address',
    key: 'walletAddress', // assuming UserBank.walletAddress exists
  },
  {
    header: 'Submitted Date',
    key: 'createdAt',
    formatter: (b) => formatDateTime(b.createdAt),
  },
  {
    header: 'Status',
    key: 'status',
  },
];

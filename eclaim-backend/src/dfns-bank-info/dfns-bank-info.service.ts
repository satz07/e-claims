// src/modules/bank-info/bank-info.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class BankInfoService {
  getBankInfo() {
    return {
      importantNotice:
        '⚠️ Important Notice\n\nMake sure the IBAN used for the transfer matches the registered and verified IBAN. Otherwise, the funds may be lost.',
      bankDetails: {
        accountName: 'Infinia Technologies LLC',
        bankName: 'FAB Bank',
        iban: 'AE070331234567890123456',
      },
    };
  }
  getBoliasBankInfo() {
    return {
      importantNotice:
        '⚠️ Important Notice\n\nMake sure the IBAN used for the transfer matches the registered and verified IBAN. Otherwise, the funds may be lost.',
      bankDetails: {
        accountName: 'Infinia Technologies LLC',
        bankName: 'Infinia Bank',
        iban: 'AE070331234567890123456',
      },
    };
  }
}

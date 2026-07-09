import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CryptoService {
  private readonly aesKey: Buffer;
  private readonly ivLength = 16;

  constructor(private readonly configService: ConfigService) {
    // Using FAB AES key (can be changed to global later)
    const key = this.configService.get<string>('fab.aesKey', { infer: true });

    // AES-256 requires 32 bytes
    this.aesKey = crypto.createHash('sha256').update(key).digest();
  }

  encrypt(plainText: string): string {
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.aesKey, iv);

    let encrypted = cipher.update(plainText, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    return `${iv.toString('base64')}:${encrypted}`;
  }

  decrypt(encryptedText: string): string {
    const [ivBase64, content] = encryptedText.split(':');

    const iv = Buffer.from(ivBase64, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-cbc', this.aesKey, iv);

    let decrypted = decipher.update(content, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}

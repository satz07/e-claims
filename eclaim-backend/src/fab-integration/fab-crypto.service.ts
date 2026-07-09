import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FabCryptoService {
  private readonly key: Uint8Array;

  constructor(private readonly configService: ConfigService) {
    const hexKey = this.configService.get<string>('fab.aesKey', {
      infer: true,
    });
    if (!hexKey) throw new Error('FAB AES key is not defined');
    this.key = new Uint8Array(Buffer.from(hexKey, 'hex'));
  }

  encrypt(data: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);

    const encryptedText = this.toUint8Array(
      Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]),
    );
    const tag = this.toUint8Array(cipher.getAuthTag());

    const result = new Uint8Array(
      iv.length + tag.length + encryptedText.length,
    );
    result.set(iv, 0);
    result.set(tag, iv.length);
    result.set(encryptedText, iv.length + tag.length);

    return Buffer.from(result).toString('base64');
  }

  decrypt(payload: string): string {
    const buf = Buffer.from(payload, 'base64');
    const iv = this.toUint8Array(buf.subarray(0, 12));
    const tag = this.toUint8Array(buf.subarray(12, 28));
    const encryptedText = this.toUint8Array(buf.subarray(28));

    const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);

    return decipher.update(encryptedText) + decipher.final('utf8');
  }

  private toUint8Array(buf: Buffer): Uint8Array {
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }
}

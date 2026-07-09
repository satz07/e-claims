import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1776967205305 implements MigrationInterface {
  name = 'Migration1776967205305';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "lean_payments" ("id" SERIAL NOT NULL, "reference" character varying NOT NULL, "status" character varying NOT NULL, "kyc_id" integer NOT NULL, "leanCustomer" jsonb, "entity_id" character varying, "payload" json, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_5c25709911973acfaa03b492dda" UNIQUE ("kyc_id"), CONSTRAINT "REL_5c25709911973acfaa03b492dd" UNIQUE ("kyc_id"), CONSTRAINT "PK_d044444750c3a36bd2d09fca10f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_lean_payments_leanCustomer_jsonb" ON "lean_payments" ("leanCustomer") `,
    );
    await queryRunner.query(
      `CREATE TABLE "user_passkeys" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "credentialId" text NOT NULL, "publicKey" text NOT NULL, "counter" integer NOT NULL DEFAULT '0', "transports" json, "deviceType" text, "backedUp" boolean, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_f78c7964dfa3e33810747ce0797" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_7651861703a2f4ed67d910fe28" ON "user_passkeys" ("userId", "credentialId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "user_two_factor" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "enabled" boolean NOT NULL DEFAULT false, "emailOtpCode" text, "emailOtpSentAt" TIMESTAMP, "emailOtpExpiresAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "REL_2cbb5b2d99e69fabcd8a5a0fdb" UNIQUE ("userId"), CONSTRAINT "PK_a0dc97e08540c59d6c744e21c58" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_2cbb5b2d99e69fabcd8a5a0fdb" ON "user_two_factor" ("userId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."user_keycloak_provisionstatus_enum" AS ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_keycloak" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "keycloakUserId" character varying, "provisionStatus" "public"."user_keycloak_provisionstatus_enum" NOT NULL DEFAULT 'PENDING', "errorMessage" text, "retryCount" integer NOT NULL DEFAULT '0', "provisionedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_673190f5fc78e4ac103a42c7076" UNIQUE ("userId"), CONSTRAINT "UQ_684f0a385f32884cc6b6dec31a3" UNIQUE ("keycloakUserId"), CONSTRAINT "REL_673190f5fc78e4ac103a42c707" UNIQUE ("userId"), CONSTRAINT "PK_7dbb864d96a41e12fe53e016f21" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."wallets_status_enum" AS ENUM('ACTIVE', 'INACTIVE', 'BLOCKED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "wallets" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "kycId" integer, "walletId" character varying NOT NULL, "address" character varying, "status" "public"."wallets_status_enum" NOT NULL DEFAULT 'ACTIVE', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_8e246dfcb84930971b5300d8cad" UNIQUE ("walletId"), CONSTRAINT "UQ_f907d5fd09a9d374f1da4e13bd3" UNIQUE ("address"), CONSTRAINT "PK_8402e5df5a30a229380e83e4f7e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2ecdb33f23e9a6fc392025c0b9" ON "wallets" ("userId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_706122bee25242f16a4aab1b8c" ON "wallets" ("kycId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_role_enum" AS ENUM('ADMIN', 'USER')`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" SERIAL NOT NULL, "email" character varying NOT NULL, "password" character varying, "role" "public"."users_role_enum" NOT NULL DEFAULT 'USER', "isActive" boolean NOT NULL DEFAULT true, "isEmailVerified" boolean NOT NULL DEFAULT false, "emailVerifyCode" character varying, "emailVerifyCodeSentAt" TIMESTAMP, "currentChallenge" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_dtps" ("id" SERIAL NOT NULL, "dtpsUserId" character varying NOT NULL, "userId" integer NOT NULL, "kycId" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_0e29fa1469700de53c0f808ce6a" UNIQUE ("dtpsUserId"), CONSTRAINT "UQ_e40cb2430f5f926cfa2ced477e1" UNIQUE ("userId"), CONSTRAINT "UQ_6d218545052e2eba6fdfd7c2d7f" UNIQUE ("kycId"), CONSTRAINT "REL_e40cb2430f5f926cfa2ced477e" UNIQUE ("userId"), CONSTRAINT "REL_6d218545052e2eba6fdfd7c2d7" UNIQUE ("kycId"), CONSTRAINT "PK_944f772a6162151673f4612bf45" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_kyc" ("id" SERIAL NOT NULL, "email" character varying, "phoneNumber" character varying, "accountType" character varying, "applicantId" character varying, "reviewStatus" character varying NOT NULL DEFAULT 'Init', "levelName" character varying, "userIdForSumsub" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_96852e5a0116c49c1507faae57a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_user_kyc_email" ON "user_kyc" ("email") WHERE "email" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_ibans" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "kycId" integer NOT NULL, "accountName" character varying NOT NULL, "walletAddress" character varying NOT NULL, "nickname" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_e1d2889f9385e1d609e5a9e598b" UNIQUE ("userId", "walletAddress"), CONSTRAINT "PK_e8a2fc5403bc9f2bef9f0447d49" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d2f6312d90fa5e3c7d209a5140" ON "user_ibans" ("userId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_665fcfb6f0343988977d979158" ON "user_ibans" ("kycId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."bank_transactions_transactiontype_enum" AS ENUM('DEPOSIT', 'WITHDRAW')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."bank_transactions_status_enum" AS ENUM('Pending', 'Approved', 'OnHold', 'Rejected')`,
    );
    await queryRunner.query(
      `CREATE TABLE "bank_transactions" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "transactionType" "public"."bank_transactions_transactiontype_enum" NOT NULL, "amount" numeric(20,2) NOT NULL, "referenceId" character varying, "status" "public"."bank_transactions_status_enum" NOT NULL DEFAULT 'Pending', "reason" character varying, "kycId" integer NOT NULL, "documents" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_123cc87304eefb2c497b4acdd10" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c0ac61cc03d73eeb83191d0309" ON "bank_transactions" ("userId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "user_banks" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "kycId" integer NOT NULL, "accountName" character varying NOT NULL, "iban" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'Pending', "reason" character varying, "documents" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_ecbe47235ce9249ec6590dc0755" UNIQUE ("userId", "iban"), CONSTRAINT "PK_6c520687002e2a1fefff649a3c2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f2bbd30b94d0978dfd4927eef3" ON "user_banks" ("userId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."transfer_history_provider_enum" AS ENUM('LEAN', 'FAB', 'MANUAL')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."transfer_history_paymentmethod_enum" AS ENUM('LEAN_OPEN_BANKING', 'LEAN_BANK_TRANSFER', 'LEAN_CARD', 'FAB_LOCAL_TRANSFER', 'FAB_INTERNAL_TRANSFER', 'FAB_SWIFT', 'MANUAL_ADJUSTMENT')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."transfer_history_direction_enum" AS ENUM('IN', 'OUT')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."transfer_history_type_enum" AS ENUM('BANK_TOPUP', 'BANK_TRANSFER', 'WITHDRAWAL', 'REFUND', 'ADJUSTMENT')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."transfer_history_status_enum" AS ENUM('INITIATED', 'PENDING', 'SUCCESS', 'FAILED', 'REVERSED', 'CANCELLED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "transfer_history" ("id" SERIAL NOT NULL, "userId" character varying NOT NULL, "kycId" integer NOT NULL, "provider" "public"."transfer_history_provider_enum" NOT NULL, "paymentMethod" "public"."transfer_history_paymentmethod_enum" NOT NULL, "direction" "public"."transfer_history_direction_enum" NOT NULL, "type" "public"."transfer_history_type_enum" NOT NULL, "status" "public"."transfer_history_status_enum" NOT NULL DEFAULT 'INITIATED', "amountMinor" bigint NOT NULL, "currencyDecimals" integer NOT NULL DEFAULT '2', "currency" character varying(8) NOT NULL, "occurredAt" TIMESTAMP WITH TIME ZONE NOT NULL, "providerReference" character varying NOT NULL, "internalReference" character varying, "sourceIban" character varying, "destinationIban" character varying, "counterpartyName" character varying, "counterpartyBank" character varying, "failureReason" text, "providerPayload" jsonb, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_34abd51f724bd9604b046ce3e05" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ef17efcf01817de10f32e549ad" ON "transfer_history" ("userId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c20a534c6b345022758383c15f" ON "transfer_history" ("kycId") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_a0fb1849e7a0797fe93acbc921" ON "transfer_history" ("provider", "providerReference") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_edffdd2f7cb03cf5f47d516c1a" ON "transfer_history" ("userId", "occurredAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0acdc5470c8dcc523e58fcc8d3" ON "transfer_history" ("kycId", "direction", "occurredAt") `,
    );
    await queryRunner.query(
      `ALTER TABLE "lean_payments" ADD CONSTRAINT "FK_5c25709911973acfaa03b492dda" FOREIGN KEY ("kyc_id") REFERENCES "user_kyc"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_passkeys" ADD CONSTRAINT "FK_6629ffb39461ac3fcc050166695" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_two_factor" ADD CONSTRAINT "FK_2cbb5b2d99e69fabcd8a5a0fdb0" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_keycloak" ADD CONSTRAINT "FK_673190f5fc78e4ac103a42c7076" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "wallets" ADD CONSTRAINT "FK_2ecdb33f23e9a6fc392025c0b97" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "wallets" ADD CONSTRAINT "FK_706122bee25242f16a4aab1b8cd" FOREIGN KEY ("kycId") REFERENCES "user_kyc"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_dtps" ADD CONSTRAINT "FK_e40cb2430f5f926cfa2ced477e1" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_dtps" ADD CONSTRAINT "FK_6d218545052e2eba6fdfd7c2d7f" FOREIGN KEY ("kycId") REFERENCES "user_kyc"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_ibans" ADD CONSTRAINT "FK_d2f6312d90fa5e3c7d209a51404" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_ibans" ADD CONSTRAINT "FK_665fcfb6f0343988977d9791585" FOREIGN KEY ("kycId") REFERENCES "user_kyc"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "bank_transactions" ADD CONSTRAINT "FK_c0ac61cc03d73eeb83191d0309d" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "bank_transactions" ADD CONSTRAINT "FK_b2209b65cda61be3089497655ae" FOREIGN KEY ("kycId") REFERENCES "user_kyc"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_banks" ADD CONSTRAINT "FK_f2bbd30b94d0978dfd4927eef35" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_banks" ADD CONSTRAINT "FK_84c885e0cb31319ad04eeae07f5" FOREIGN KEY ("kycId") REFERENCES "user_kyc"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "transfer_history" ADD CONSTRAINT "FK_c20a534c6b345022758383c15f7" FOREIGN KEY ("kycId") REFERENCES "user_kyc"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transfer_history" DROP CONSTRAINT "FK_c20a534c6b345022758383c15f7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_banks" DROP CONSTRAINT "FK_84c885e0cb31319ad04eeae07f5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_banks" DROP CONSTRAINT "FK_f2bbd30b94d0978dfd4927eef35"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bank_transactions" DROP CONSTRAINT "FK_b2209b65cda61be3089497655ae"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bank_transactions" DROP CONSTRAINT "FK_c0ac61cc03d73eeb83191d0309d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_ibans" DROP CONSTRAINT "FK_665fcfb6f0343988977d9791585"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_ibans" DROP CONSTRAINT "FK_d2f6312d90fa5e3c7d209a51404"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_dtps" DROP CONSTRAINT "FK_6d218545052e2eba6fdfd7c2d7f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_dtps" DROP CONSTRAINT "FK_e40cb2430f5f926cfa2ced477e1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "wallets" DROP CONSTRAINT "FK_706122bee25242f16a4aab1b8cd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "wallets" DROP CONSTRAINT "FK_2ecdb33f23e9a6fc392025c0b97"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_keycloak" DROP CONSTRAINT "FK_673190f5fc78e4ac103a42c7076"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_two_factor" DROP CONSTRAINT "FK_2cbb5b2d99e69fabcd8a5a0fdb0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_passkeys" DROP CONSTRAINT "FK_6629ffb39461ac3fcc050166695"`,
    );
    await queryRunner.query(
      `ALTER TABLE "lean_payments" DROP CONSTRAINT "FK_5c25709911973acfaa03b492dda"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0acdc5470c8dcc523e58fcc8d3"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_edffdd2f7cb03cf5f47d516c1a"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a0fb1849e7a0797fe93acbc921"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c20a534c6b345022758383c15f"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ef17efcf01817de10f32e549ad"`,
    );
    await queryRunner.query(`DROP TABLE "transfer_history"`);
    await queryRunner.query(
      `DROP TYPE "public"."transfer_history_status_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."transfer_history_type_enum"`);
    await queryRunner.query(
      `DROP TYPE "public"."transfer_history_direction_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."transfer_history_paymentmethod_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."transfer_history_provider_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f2bbd30b94d0978dfd4927eef3"`,
    );
    await queryRunner.query(`DROP TABLE "user_banks"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c0ac61cc03d73eeb83191d0309"`,
    );
    await queryRunner.query(`DROP TABLE "bank_transactions"`);
    await queryRunner.query(
      `DROP TYPE "public"."bank_transactions_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."bank_transactions_transactiontype_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_665fcfb6f0343988977d979158"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_d2f6312d90fa5e3c7d209a5140"`,
    );
    await queryRunner.query(`DROP TABLE "user_ibans"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_user_kyc_email"`);
    await queryRunner.query(`DROP TABLE "user_kyc"`);
    await queryRunner.query(`DROP TABLE "user_dtps"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_706122bee25242f16a4aab1b8c"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2ecdb33f23e9a6fc392025c0b9"`,
    );
    await queryRunner.query(`DROP TABLE "wallets"`);
    await queryRunner.query(`DROP TYPE "public"."wallets_status_enum"`);
    await queryRunner.query(`DROP TABLE "user_keycloak"`);
    await queryRunner.query(
      `DROP TYPE "public"."user_keycloak_provisionstatus_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2cbb5b2d99e69fabcd8a5a0fdb"`,
    );
    await queryRunner.query(`DROP TABLE "user_two_factor"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_7651861703a2f4ed67d910fe28"`,
    );
    await queryRunner.query(`DROP TABLE "user_passkeys"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_lean_payments_leanCustomer_jsonb"`,
    );
    await queryRunner.query(`DROP TABLE "lean_payments"`);
  }
}

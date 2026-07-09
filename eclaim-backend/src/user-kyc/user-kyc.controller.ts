import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';

import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';

import { InitKycDto } from './dto/init-kyc.dto';
import {
  GetKycStatusQueryDto,
  KycStatusResponseDto,
  SumsubEventType,
  SumsubWebhookDto,
} from './dto/get-kyc-status.dto';
import { KYCService } from './user-kyc.service';
import { CreateUserStep1Dto } from './dto/create-user-step1.dto';
import { CreateUserStep2Dto } from './dto/create-user-step2.dto';

@ApiTags('KYC')
@Controller('kyc')
export class KYCController {
  constructor(private readonly kycService: KYCService) {}

  // STEP 1
  @Post('step-1')
  createStep1(@Body() dto: CreateUserStep1Dto) {
    return this.kycService.createStep1(dto);
  }

  // STEP 2
  @Post('step-2')
  createStep2(@Body() dto: CreateUserStep2Dto) {
    return this.kycService.createStep2(dto);
  }

  @Post('init')
  @ApiOperation({ summary: 'Mint Sumsub SDK token for KYC or KYB' })
  @ApiOkResponse({ description: 'SDK token minted successfully' })
  @ApiBadRequestResponse({ description: 'Validation or Sumsub error' })
  async init(@Body() dto: InitKycDto) {
    return this.kycService.initApplicant(dto);
  }

  @Get('status')
  @ApiOperation({ summary: 'Check KYC status by email' })
  @ApiOkResponse({ type: KycStatusResponseDto })
  async status(
    @Query() q: GetKycStatusQueryDto,
  ): Promise<KycStatusResponseDto> {
    return this.kycService.getStatus(q.email);
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sumsub webhook receiver (review updates/applicant links)',
  })
  async webhook(@Body() body: SumsubWebhookDto) {
    const answer = body.reviewResult?.reviewAnswer; // 'GREEN' | 'RED' | 'YELLOW'
    const phase = body.reviewStatus; // 'pending' | 'completed' | 'onHold' | ...
    console.log('KYC WEBHOOK RECEIVED:', body);
    const mapped:
      | 'Approved'
      | 'Rejected'
      | 'FinallyRejected'
      | 'Pending'
      | 'Incomplete' =
      body.type === SumsubEventType.ApplicantReviewed
        ? answer === 'GREEN'
          ? 'Approved'
          : 'Rejected'
        : body.type === SumsubEventType.ApplicantFinallyRejected
        ? 'FinallyRejected'
        : body.type === SumsubEventType.ApplicantPending
        ? 'Pending'
        : phase === 'onHold' ||
          body.type === SumsubEventType.ApplicantOnHold ||
          body.type === SumsubEventType.ApplicantActionRequired
        ? 'Incomplete'
        : 'Pending';

    console.log('Mapped KYC status:', mapped);
    const ok = await this.kycService.applyWebhook(
      body.type,
      body.applicantId ?? '',
      mapped,
      body.externalUserId ?? '', // <-- pass externalUserId (critical)
      body.applicantType,
    );
    console.log('KYC WEBHOOK processed, ok=', ok);

    return { ok: !!ok };
  }
}

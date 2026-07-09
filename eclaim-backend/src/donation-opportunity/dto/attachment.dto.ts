import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsNumber, IsEnum } from 'class-validator';
import {
  AttachmentOwnerType,
  AttachmentType,
} from '../../database/entities/attachment.entity';

export class UploadAttachmentDto {
  @ApiProperty({ example: 1 })
  @IsNotEmpty()
  @IsNumber()
  ownerId: number;

  @ApiProperty({ enum: AttachmentOwnerType })
  @IsNotEmpty()
  @IsEnum(AttachmentOwnerType)
  ownerType: AttachmentOwnerType;

  @ApiProperty({ enum: AttachmentType })
  @IsNotEmpty()
  @IsEnum(AttachmentType)
  type: AttachmentType;

  @ApiProperty({ example: 'https://s3.amazonaws.com/bucket/doc.pdf' })
  @IsNotEmpty()
  @IsString()
  fileUrl: string;

  @ApiProperty({ example: 'budget-plan.pdf' })
  @IsNotEmpty()
  @IsString()
  fileName: string;
}

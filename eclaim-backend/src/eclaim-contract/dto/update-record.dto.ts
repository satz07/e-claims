import { ApiProperty } from '@nestjs/swagger';

export class UpdateRecordDto {
  @ApiProperty({ description: 'Updated record data' })
  record: any;
}

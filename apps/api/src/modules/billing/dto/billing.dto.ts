import { IsString, IsEnum, IsInt, Min, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BillingEvent, PricingModel } from '@prisma/client';

export class RecordUsageDto {
  @ApiProperty()
  @IsString()
  projectAgentId: string;

  @ApiProperty({ enum: BillingEvent })
  @IsEnum(BillingEvent)
  event: BillingEvent;

  @ApiProperty({ enum: PricingModel })
  @IsEnum(PricingModel)
  pricingModel: PricingModel;

  @ApiProperty({ description: 'Amount in cents' })
  @IsInt()
  @Min(0)
  amountCents: number;

  @ApiPropertyOptional({ description: 'Token count — required for PER_TOKEN events' })
  @IsOptional()
  @IsInt()
  @Min(0)
  tokenCount?: number;

  @ApiProperty()
  @IsString()
  description: string;
}

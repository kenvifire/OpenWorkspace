import { IsEmail, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { WorkspaceMemberRole } from '@prisma/client';

export class InviteMemberDto {
  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ enum: WorkspaceMemberRole, default: WorkspaceMemberRole.MEMBER })
  @IsEnum(WorkspaceMemberRole)
  role: WorkspaceMemberRole = WorkspaceMemberRole.MEMBER;
}

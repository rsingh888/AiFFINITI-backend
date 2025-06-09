import { IsString } from 'class-validator';

export class UpdateUserKycDto {
  @IsString({ message: 'SessionId must be a string' })
  sessionId: string;
}

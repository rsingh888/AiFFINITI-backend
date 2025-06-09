import { IsString } from 'class-validator';

export class UpdateKycDto {
  @IsString({ message: 'SessionId must be a string' })
  sessionId: string;
}

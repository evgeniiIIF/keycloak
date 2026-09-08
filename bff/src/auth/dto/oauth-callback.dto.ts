import { IsOptional,IsString } from 'class-validator';

export class OAuthCallbackDto {
  @IsString()
  @IsOptional()
  error?: string;

  @IsString()
  code!: string;

  @IsString()
  state!: string;

  @IsString()
  @IsOptional()
  session_state?: string;

  @IsString()
  @IsOptional()
  iss?: string;
}

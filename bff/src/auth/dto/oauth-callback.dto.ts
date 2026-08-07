import { IsString, IsOptional } from 'class-validator';

export class OAuthCallbackDto {
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

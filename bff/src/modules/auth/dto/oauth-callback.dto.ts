import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class OAuthCallbackDto {
  @ApiPropertyOptional({ description: 'Ошибка от OAuth провайдера' })
  @IsString()
  @IsOptional()
  error?: string;

  @ApiProperty({ description: 'Authorization code от Keycloak' })
  @IsString()
  code!: string;

  @ApiProperty({ description: 'CSRF state для проверки' })
  @IsString()
  state!: string;

  @ApiPropertyOptional({ description: 'Session state от Keycloak' })
  @IsString()
  @IsOptional()
  session_state?: string;

  @ApiPropertyOptional({ description: 'Issuer' })
  @IsString()
  @IsOptional()
  iss?: string;
}

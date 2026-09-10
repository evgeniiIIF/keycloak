import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class BackchannelLogoutDto {
  @ApiProperty({ description: 'Logout token от Keycloak (JWT)' })
  @IsString()
  @IsNotEmpty()
  logout_token!: string;
}

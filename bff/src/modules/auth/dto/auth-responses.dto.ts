import { ApiProperty } from '@nestjs/swagger';

export class SessionUserDto {
  @ApiProperty({ example: '6a1e0d1a-2461-403f-bd11-d79c7efb3ebd' })
  id!: string;

  @ApiProperty({ example: 'testuser' })
  username!: string;

  @ApiProperty({ example: 'test@example.com' })
  email!: string;

  @ApiProperty({ example: ['user', 'admin'] })
  roles!: string[];
}

export class MeResponseDto {
  @ApiProperty({ type: SessionUserDto })
  user!: SessionUserDto;
}

export class LogoutResponseDto {
  @ApiProperty({
    example: 'http://localhost:8080/realms/TestRealm/protocol/openid-connect/logout?id_token_hint=...',
  })
  logoutUrl!: string;
}

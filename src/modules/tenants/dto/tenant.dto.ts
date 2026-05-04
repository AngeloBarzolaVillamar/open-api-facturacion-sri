import { IsString, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTenantDto {
  @ApiProperty({ description: 'Nombre del tenant/empresa' })
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @ApiPropertyOptional({
    description: 'Plan del tenant: BASICO, PRO, ENTERPRISE',
  })
  @IsOptional()
  @IsString()
  plan?: string;
}

export class UpdateTenantDto {
  @ApiPropertyOptional({ description: 'Nombre del tenant' })
  @IsOptional()
  @IsString()
  nombre?: string;

  @ApiPropertyOptional({ description: 'Plan del tenant' })
  @IsOptional()
  @IsString()
  plan?: string;

  @ApiPropertyOptional({ description: 'Estado: ACTIVO o INACTIVO' })
  @IsOptional()
  @IsString()
  estado?: string;
}

export class TenantResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  nombre: string;

  @ApiProperty()
  plan: string;

  @ApiProperty()
  estado: string;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;

  @ApiPropertyOptional()
  emisoresCount?: number;
}

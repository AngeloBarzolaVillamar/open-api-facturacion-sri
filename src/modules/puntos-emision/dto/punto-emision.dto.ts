import {
  IsString,
  IsOptional,
  IsNotEmpty,
  Length,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePuntoEmisionDto {
  @ApiProperty({
    description: 'Código del establecimiento (3 dígitos)',
    example: '001',
  })
  @IsString()
  @IsNotEmpty()
  @Length(3, 3, {
    message: 'El código del establecimiento debe tener 3 dígitos',
  })
  @Matches(/^\d{3}$/, {
    message: 'El código del establecimiento debe contener solo números',
  })
  establecimiento: string;

  @ApiProperty({
    description: 'Código del punto de emisión (3 dígitos)',
    example: '001',
  })
  @IsString()
  @IsNotEmpty()
  @Length(3, 3, {
    message: 'El código del punto de emisión debe tener 3 dígitos',
  })
  @Matches(/^\d{3}$/, {
    message: 'El código del punto de emisión debe contener solo números',
  })
  puntoEmision: string;

  @ApiPropertyOptional({
    description: 'Dirección del establecimiento',
    example: 'Av. Principal 123',
  })
  @IsOptional()
  @IsString()
  direccionEstablecimiento?: string;

  @ApiPropertyOptional({
    description: 'Descripción del punto de emisión',
    example: 'Caja Principal',
  })
  @IsOptional()
  @IsString()
  descripcion?: string;
}

export class UpdatePuntoEmisionDto {
  @ApiPropertyOptional({ description: 'Dirección del establecimiento' })
  @IsOptional()
  @IsString()
  direccionEstablecimiento?: string;

  @ApiPropertyOptional({ description: 'Descripción del punto de emisión' })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiPropertyOptional({ description: 'Estado: ACTIVO o INACTIVO' })
  @IsOptional()
  @IsString()
  estado?: string;
}

export class PuntoEmisionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  emisorId: string;

  @ApiProperty()
  establecimientoId: string;

  @ApiProperty()
  establecimiento: string;

  @ApiProperty()
  puntoEmision: string;

  @ApiProperty()
  direccion: string;

  @ApiPropertyOptional()
  descripcion?: string;

  @ApiProperty()
  estado: string;

  @ApiProperty()
  createdAt: string;

  @ApiProperty({
    description: 'Secuenciales disponibles para este punto de emisión',
    example: { '01': 5, '04': 2, '07': 1 },
  })
  secuenciales?: Record<string, number>;
}

export class SecuencialResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  puntoEmisionId: string;

  @ApiProperty({ description: 'Código del tipo de comprobante', example: '01' })
  tipoComprobante: string;

  @ApiProperty({ description: 'Descripción del tipo', example: 'Factura' })
  tipoDescripcion: string;

  @ApiProperty({ description: 'Último secuencial usado', example: 123 })
  ultimoSecuencial: number;

  @ApiProperty({ description: 'Próximo secuencial a usar', example: 124 })
  proximoSecuencial: number;

  @ApiProperty()
  updatedAt: string;
}

export class UpdateSecuencialDto {
  @ApiProperty({
    description: 'Nuevo valor para el último secuencial',
    example: 100,
    minimum: 0,
  })
  @IsNotEmpty()
  ultimoSecuencial: number;
}

import {
  IsString,
  IsOptional,
  IsBoolean,
  Length,
  Matches,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEmisorDto {
  @ApiProperty({ description: 'RUC del emisor (13 dígitos)' })
  @IsString()
  @Length(13, 13)
  @Matches(/^\d{13}$/, { message: 'El RUC debe tener 13 dígitos' })
  ruc: string;

  @ApiProperty({ description: 'Razón social' })
  @IsString()
  @IsNotEmpty()
  razonSocial: string;

  @ApiPropertyOptional({ description: 'Nombre comercial' })
  @IsOptional()
  @IsString()
  nombreComercial?: string;

  @ApiProperty({ description: 'Dirección matriz' })
  @IsString()
  @IsNotEmpty()
  direccionMatriz: string;

  @ApiPropertyOptional({ description: 'Obligado a llevar contabilidad' })
  @IsOptional()
  @IsBoolean()
  obligadoContabilidad?: boolean;

  @ApiPropertyOptional({ description: 'Número de contribuyente especial' })
  @IsOptional()
  @IsString()
  contribuyenteEspecial?: string;

  @ApiPropertyOptional({ description: 'Código de agente de retención' })
  @IsOptional()
  @IsString()
  agenteRetencion?: string;

  @ApiPropertyOptional({ description: 'Es contribuyente RIMPE' })
  @IsOptional()
  @IsBoolean()
  contribuyenteRimpe?: boolean;

  @ApiPropertyOptional({
    description: 'Ambiente SRI: 1/pruebas o 2/produccion',
  })
  @IsOptional()
  @IsString()
  ambiente?: string;

  @ApiPropertyOptional({
    description: 'ID del tenant al que pertenece el emisor',
  })
  @IsOptional()
  @IsString()
  tenantId?: string;
}

export class UpdateEmisorDto {
  @ApiPropertyOptional({ description: 'Razón social' })
  @IsOptional()
  @IsString()
  razonSocial?: string;

  @ApiPropertyOptional({ description: 'Nombre comercial' })
  @IsOptional()
  @IsString()
  nombreComercial?: string;

  @ApiPropertyOptional({ description: 'Dirección matriz' })
  @IsOptional()
  @IsString()
  direccionMatriz?: string;

  @ApiPropertyOptional({ description: 'Obligado a llevar contabilidad' })
  @IsOptional()
  @IsBoolean()
  obligadoContabilidad?: boolean;

  @ApiPropertyOptional({ description: 'Número de contribuyente especial' })
  @IsOptional()
  @IsString()
  contribuyenteEspecial?: string;

  @ApiPropertyOptional({ description: 'Código de agente de retención' })
  @IsOptional()
  @IsString()
  agenteRetencion?: string;

  @ApiPropertyOptional({ description: 'Es contribuyente RIMPE' })
  @IsOptional()
  @IsBoolean()
  contribuyenteRimpe?: boolean;

  @ApiPropertyOptional({
    description: 'Ambiente SRI: 1/pruebas o 2/produccion',
  })
  @IsOptional()
  @IsString()
  ambiente?: string;

  @ApiPropertyOptional({ description: 'Estado: ACTIVO o INACTIVO' })
  @IsOptional()
  @IsString()
  estado?: string;
}

export class EmisorResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  ruc: string;

  @ApiProperty()
  razonSocial: string;

  @ApiPropertyOptional()
  nombreComercial?: string;

  @ApiProperty()
  direccionMatriz: string;

  @ApiProperty()
  obligadoContabilidad: boolean;

  @ApiPropertyOptional()
  contribuyenteEspecial?: string;

  @ApiPropertyOptional()
  agenteRetencion?: string;

  @ApiProperty()
  contribuyenteRimpe: boolean;

  @ApiProperty()
  ambiente: string;

  @ApiProperty()
  estado: string;

  @ApiPropertyOptional()
  tenantId?: string;

  @ApiProperty()
  tieneCertificado: boolean;

  @ApiPropertyOptional()
  certificadoValidoHasta?: string;

  @ApiPropertyOptional()
  certificadoSujeto?: string;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}

export class UploadCertificadoDto {
  @ApiProperty({ description: 'Contraseña del certificado P12' })
  @IsString()
  @IsNotEmpty()
  password: string;
}

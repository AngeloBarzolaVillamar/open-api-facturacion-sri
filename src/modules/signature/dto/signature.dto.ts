import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsObject,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SignaturePositionDto {
  @ApiPropertyOptional({
    description: 'Página donde colocar la firma (0 = primera, -1 = última)',
  })
  @IsOptional()
  @IsNumber()
  page?: number;

  @ApiPropertyOptional({ description: 'Posición X en puntos' })
  @IsOptional()
  @IsNumber()
  x?: number;

  @ApiPropertyOptional({ description: 'Posición Y en puntos' })
  @IsOptional()
  @IsNumber()
  y?: number;
}

export class SignPdfDto {
  @ApiProperty({ description: 'Nombre del archivo de certificado P12' })
  @IsString()
  @IsNotEmpty()
  certFile: string;

  @ApiProperty({ description: 'Contraseña del certificado' })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiPropertyOptional({
    description: 'Posición de la firma',
    type: SignaturePositionDto,
  })
  @IsOptional()
  @IsObject()
  @Type(() => SignaturePositionDto)
  position?: SignaturePositionDto;
}

export class GenerateAndSignPdfDto {
  @ApiProperty({ description: 'Datos JSON para el template' })
  @IsObject()
  jsonData: Record<string, unknown>;

  @ApiProperty({ description: 'Nombre del archivo de certificado P12' })
  @IsString()
  @IsNotEmpty()
  certFile: string;

  @ApiProperty({ description: 'Contraseña del certificado' })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiPropertyOptional({
    description: 'Posición de la firma',
    type: SignaturePositionDto,
  })
  @IsOptional()
  @IsObject()
  @Type(() => SignaturePositionDto)
  position?: SignaturePositionDto;
}

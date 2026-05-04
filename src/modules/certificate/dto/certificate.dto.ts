import {
  IsString,
  IsNotEmpty,
  IsOptional,
  Length,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UploadCertificateDto {
  @ApiProperty({ description: 'Contraseña del certificado P12' })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiPropertyOptional({
    description:
      'RUC del emisor para vincular el certificado (opcional). Si se proporciona, el certificado se asociará al emisor en la base de datos.',
    example: '0924383631001',
  })
  @IsOptional()
  @IsString()
  @Length(13, 13, { message: 'El RUC debe tener exactamente 13 dígitos' })
  @Matches(/^\d{13}$/, { message: 'El RUC debe contener solo números' })
  ruc?: string;
}

export class ValidateCertificateDto {
  @ApiProperty({ description: 'Contraseña del certificado P12' })
  @IsString()
  @IsNotEmpty()
  password: string;
}

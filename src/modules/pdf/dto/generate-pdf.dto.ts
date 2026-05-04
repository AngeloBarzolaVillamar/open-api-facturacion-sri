import {
  IsOptional,
  IsObject,
  IsArray,
  ValidateNested,
  IsString,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ImageDto {
  @ApiProperty({
    description: 'URL de la imagen (http/https o ruta local)',
    example: 'https://example.com/imagen.png',
  })
  @IsString()
  url: string;

  @ApiPropertyOptional({
    description: 'Página donde insertar (0 = primera)',
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  page?: number;

  @ApiPropertyOptional({ description: 'Posición X en puntos', example: 100 })
  @IsOptional()
  @IsNumber()
  x?: number;

  @ApiPropertyOptional({ description: 'Posición Y en puntos', example: 200 })
  @IsOptional()
  @IsNumber()
  y?: number;

  @ApiPropertyOptional({ description: 'Ancho de la imagen', default: 100 })
  @IsOptional()
  @IsNumber()
  width?: number;

  @ApiPropertyOptional({ description: 'Alto de la imagen', default: 100 })
  @IsOptional()
  @IsNumber()
  height?: number;

  @ApiPropertyOptional({ description: 'Opacidad (0-1)', default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  opacity?: number;
}

export class GeneratePdfDto {
  @ApiProperty({ description: 'Datos JSON para el template' })
  @IsObject()
  jsonData?: Record<string, unknown>;
}

export class GeneratePdfWithImagesDto {
  @ApiProperty({ description: 'Datos JSON para el template' })
  @IsObject()
  jsonData: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Array de imágenes a insertar',
    type: [ImageDto],
    example: [
      {
        url: 'https://example.com/imagen.png',
        page: 0,
        x: 100,
        y: 200,
        width: 150,
        height: 100,
        opacity: 1,
      },
    ],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImageDto)
  images?: ImageDto[];
}

import { ApiProperty } from '@nestjs/swagger';

export class EmisionEncoladaResponseDto {
  @ApiProperty({ example: 'Comprobante encolado para emisión asíncrona' })
  mensaje: string;

  @ApiProperty({ example: '12345' })
  jobId: string;

  @ApiProperty({ example: 'EN_COLA' })
  estado: string;
}

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PuntosEmisionService } from './puntos-emision.service';
import { EmisoresService } from '../emisores/emisores.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/dto/auth.dto';
import {
  CreatePuntoEmisionDto,
  UpdatePuntoEmisionDto,
  PuntoEmisionResponseDto,
} from './dto';

@ApiTags('Emisores - Puntos de Emisión')
@ApiBearerAuth('JWT')
@Controller('emisores/puntos-emision')
export class PuntosEmisionController {
  private readonly logger = new Logger(PuntosEmisionController.name);

  constructor(
    private readonly service: PuntosEmisionService,
    private readonly emisoresService: EmisoresService,
  ) {}

  // ========== PUNTOS DE EMISIÓN ==========

  @Get(':emisorId')
  @ApiOperation({ summary: 'Listar puntos de emisión de un emisor' })
  @ApiParam({ name: 'emisorId', description: 'UUID del emisor' })
  @ApiResponse({
    status: 200,
    description: 'Lista de puntos de emisión',
    type: [PuntoEmisionResponseDto],
  })
  async findAll(
    @Param('emisorId') emisorId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<PuntoEmisionResponseDto[]> {
    // Validar acceso tenant antes de listar
    await this.emisoresService.validateEmisorAccess(emisorId, user);
    return this.service.findAll(emisorId);
  }

  @Get(':emisorId/:puntoEmisionId')
  @ApiOperation({ summary: 'Obtener un punto de emisión específico' })
  @ApiParam({ name: 'emisorId', description: 'UUID del emisor' })
  @ApiParam({
    name: 'puntoEmisionId',
    description: 'UUID del punto de emisión',
  })
  @ApiResponse({
    status: 200,
    description: 'Punto de emisión encontrado',
    type: PuntoEmisionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Punto de emisión no encontrado' })
  async findOne(
    @Param('emisorId') emisorId: string,
    @Param('puntoEmisionId') puntoEmisionId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<PuntoEmisionResponseDto> {
    await this.emisoresService.validateEmisorAccess(emisorId, user);
    return this.service.findOne(emisorId, puntoEmisionId);
  }

  @Post(':emisorId')
  @ApiOperation({
    summary: 'Crear un nuevo punto de emisión',
    description:
      'Crea un punto de emisión y su establecimiento (si no existe). Inicializa automáticamente los secuenciales para todos los tipos de comprobante.',
  })
  @ApiParam({ name: 'emisorId', description: 'UUID del emisor' })
  @ApiResponse({
    status: 201,
    description: 'Punto de emisión creado',
    type: PuntoEmisionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 409, description: 'El punto de emisión ya existe' })
  async create(
    @Param('emisorId') emisorId: string,
    @Body() dto: CreatePuntoEmisionDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<PuntoEmisionResponseDto> {
    await this.emisoresService.validateEmisorAccess(emisorId, user);
    return this.service.create(emisorId, dto);
  }

  @Put(':emisorId/:puntoEmisionId')
  @ApiOperation({ summary: 'Actualizar un punto de emisión' })
  @ApiParam({ name: 'emisorId', description: 'UUID del emisor' })
  @ApiParam({
    name: 'puntoEmisionId',
    description: 'UUID del punto de emisión',
  })
  @ApiResponse({
    status: 200,
    description: 'Punto de emisión actualizado',
    type: PuntoEmisionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Punto de emisión no encontrado' })
  async update(
    @Param('emisorId') emisorId: string,
    @Param('puntoEmisionId') puntoEmisionId: string,
    @Body() dto: UpdatePuntoEmisionDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<PuntoEmisionResponseDto> {
    await this.emisoresService.validateEmisorAccess(emisorId, user);
    return this.service.update(emisorId, puntoEmisionId, dto);
  }

  @Delete(':emisorId/:puntoEmisionId')
  @ApiOperation({
    summary: 'Inactivar un punto de emisión (eliminación lógica)',
  })
  @ApiParam({ name: 'emisorId', description: 'UUID del emisor' })
  @ApiParam({
    name: 'puntoEmisionId',
    description: 'UUID del punto de emisión',
  })
  @ApiResponse({
    status: 200,
    description: 'Punto de emisión inactivado',
    type: PuntoEmisionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'El punto ya está inactivo' })
  @ApiResponse({ status: 404, description: 'Punto de emisión no encontrado' })
  async delete(
    @Param('emisorId') emisorId: string,
    @Param('puntoEmisionId') puntoEmisionId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<PuntoEmisionResponseDto> {
    await this.emisoresService.validateEmisorAccess(emisorId, user);
    return this.service.delete(emisorId, puntoEmisionId);
  }
}

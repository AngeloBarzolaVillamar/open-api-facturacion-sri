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
  ApiBearerAuth,
} from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { CreateTenantDto, UpdateTenantDto, TenantResponseDto } from './dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/dto/auth.dto';

@ApiTags('Tenants')
@ApiBearerAuth('JWT')
@Roles(UserRole.SUPERADMIN)
@Controller('tenants')
export class TenantsController {
  private readonly logger = new Logger(TenantsController.name);

  constructor(private readonly tenantsService: TenantsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar todos los tenants (solo SUPERADMIN)' })
  @ApiResponse({
    status: 200,
    description: 'Lista de tenants',
    type: [TenantResponseDto],
  })
  @ApiResponse({ status: 403, description: 'Se requiere rol SUPERADMIN' })
  async findAll(): Promise<TenantResponseDto[]> {
    return this.tenantsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un tenant por ID (solo SUPERADMIN)' })
  @ApiResponse({
    status: 200,
    description: 'Tenant encontrado',
    type: TenantResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Tenant no encontrado' })
  async findOne(@Param('id') id: string): Promise<TenantResponseDto> {
    return this.tenantsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear un nuevo tenant (solo SUPERADMIN)' })
  @ApiResponse({
    status: 201,
    description: 'Tenant creado',
    type: TenantResponseDto,
  })
  async create(@Body() dto: CreateTenantDto): Promise<TenantResponseDto> {
    return this.tenantsService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar un tenant (solo SUPERADMIN)' })
  @ApiResponse({
    status: 200,
    description: 'Tenant actualizado',
    type: TenantResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Tenant no encontrado' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTenantDto,
  ): Promise<TenantResponseDto> {
    return this.tenantsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Inactivar un tenant (solo SUPERADMIN)' })
  @ApiResponse({
    status: 200,
    description: 'Tenant inactivado',
    type: TenantResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Tenant ya está inactivo' })
  @ApiResponse({ status: 404, description: 'Tenant no encontrado' })
  async delete(@Param('id') id: string): Promise<TenantResponseDto> {
    return this.tenantsService.delete(id);
  }
}

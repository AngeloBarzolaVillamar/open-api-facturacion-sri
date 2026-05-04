import {
  Controller,
  Post,
  Body,
  Get,
  Patch,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import {
  LoginDto,
  RegisterUserDto,
  ChangePasswordDto,
  AuthResponseDto,
  RefreshTokenDto,
} from './dto/auth.dto';
import { Public } from './decorators/public.decorator';
import { Roles } from './decorators/roles.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { UserRole, JwtPayload } from './dto/auth.dto';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Auth - Autenticación')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  /**
   * POST /auth/login
   * Público — no requiere token
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 intentos por minuto por IP
  @ApiOperation({ summary: 'Iniciar sesión y obtener token JWT' })
  @ApiResponse({
    status: 200,
    description: 'Login exitoso',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  async login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(dto);
  }

  /**
   * POST /auth/refresh
   * Público — valida el refresh token del body, no del header
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refrescar sesión usando Refresh Token' })
  @ApiResponse({
    status: 200,
    description: 'Sesión renovada exitosamente',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Refresh token inválido o expirado' })
  async refresh(@Body() dto: RefreshTokenDto): Promise<AuthResponseDto> {
    return this.authService.refreshToken(dto);
  }

  /**
   * POST /auth/register
   * Solo SUPERADMIN puede crear usuarios
   */
  @Post('register')
  @Roles(UserRole.SUPERADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Registrar nuevo usuario (solo SUPERADMIN)' })
  @ApiResponse({ status: 201, description: 'Usuario creado exitosamente' })
  @ApiResponse({
    status: 403,
    description: 'Acceso denegado - se requiere rol SUPERADMIN',
  })
  @ApiResponse({ status: 409, description: 'El email ya está registrado' })
  async register(@Body() dto: RegisterUserDto) {
    return this.authService.register(dto);
  }

  /**
   * GET /auth/me
   * Retorna información del usuario autenticado
   */
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener datos del usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Datos del usuario actual' })
  @ApiResponse({ status: 401, description: 'Token inválido o expirado' })
  getProfile(@CurrentUser() user: JwtPayload) {
    return {
      id: user.sub,
      email: user.email,
      rol: user.rol,
      tenantId: user.tenantId,
    };
  }

  /**
   * PATCH /auth/change-password
   * Cambia la contraseña del usuario autenticado
   */
  @Patch('change-password')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cambiar contraseña del usuario actual' })
  @ApiResponse({
    status: 200,
    description: 'Contraseña actualizada exitosamente',
  })
  @ApiResponse({ status: 401, description: 'Contraseña actual incorrecta' })
  async changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.authService.changePassword(
      user.sub,
      dto.currentPassword,
      dto.newPassword,
    );
    return { message: 'Contraseña actualizada exitosamente' };
  }
}

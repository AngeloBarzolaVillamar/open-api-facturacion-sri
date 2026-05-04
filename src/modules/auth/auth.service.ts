import {
  Injectable,
  Logger,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { DatabaseService } from '../../database/database.service';
import {
  LoginDto,
  RegisterUserDto,
  AuthResponseDto,
  JwtPayload,
  UserRole,
  RefreshTokenDto,
} from './dto/auth.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly BCRYPT_ROUNDS = 12;

  constructor(
    private readonly db: DatabaseService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Autentica un usuario y devuelve un JWT
   */
  async login(dto: LoginDto): Promise<AuthResponseDto> {
    this.logger.log(`Intento de login para: ${dto.email}`);

    const user = await this.db.queryOne<any>(
      `SELECT id, email, password_hash, rol, tenant_id, activo
       FROM usuarios WHERE email = $1`,
      [dto.email],
    );

    if (!user) {
      this.logger.warn(`Login fallido - usuario no encontrado: ${dto.email}`);
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!user.activo) {
      throw new UnauthorizedException('El usuario está inactivo');
    }

    const passwordValid = await bcrypt.compare(
      dto.password,
      user.password_hash,
    );
    if (!passwordValid) {
      this.logger.warn(`Login fallido - contraseña incorrecta: ${dto.email}`);
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Actualizar última conexión
    await this.db.query(
      `UPDATE usuarios SET last_login = NOW() WHERE id = $1`,
      [user.id],
    );

    this.logger.log(`Login exitoso: ${dto.email} (${user.rol})`);

    return this.generateTokens(user);
  }

  /**
   * Refresca la sesión usando un Refresh Token
   */
  async refreshToken(dto: RefreshTokenDto): Promise<AuthResponseDto> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(dto.refreshToken);

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Token inválido para refrescar sesión');
      }

      // Validar que el usuario sigue activo en la BD
      await this.validatePayload(payload);

      return this.generateTokens(payload);
    } catch (error: any) {
      this.logger.warn(`Refresh token fallido: ${error.message}`);
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }
  }

  private generateTokens(user: any): AuthResponseDto {
    const payload: JwtPayload = {
      sub: user.id || user.sub,
      email: user.email,
      rol: user.rol,
      tenantId: user.tenant_id || user.tenantId,
      type: 'access',
    };

    const expiresInConfig = this.configService.get<string>('jwt.expiresIn', '8h');
    const accessToken = this.jwtService.sign(payload, { expiresIn: expiresInConfig as any });
    
    // Decodificar para obtener el exp exacto en segundos
    const decodedAccess = this.jwtService.decode(accessToken) as any;
    const expiresInSeconds = Math.max(0, decodedAccess.exp - Math.floor(Date.now() / 1000));
    const expiresAtIso = new Date(decodedAccess.exp * 1000).toISOString();

    const refreshPayload: JwtPayload = {
      ...payload,
      type: 'refresh',
    };
    // El refresh token suele tener mayor vida, ej. 7 días
    const refreshToken = this.jwtService.sign(refreshPayload, { expiresIn: '7d' });

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: expiresInSeconds,
      expiresAt: expiresAtIso,
      user: {
        id: payload.sub,
        email: payload.email,
        rol: payload.rol,
        tenantId: payload.tenantId,
      },
    };
  }

  /**
   * Registra un nuevo usuario (solo SUPERADMIN puede crear usuarios)
   */
  async register(dto: RegisterUserDto): Promise<{
    id: string;
    email: string;
    rol: string;
    tenantId: string | null;
  }> {
    this.logger.log(`Registrando nuevo usuario: ${dto.email}`);

    // Verificar que el email no exista
    const existing = await this.db.queryOne<{ id: string }>(
      'SELECT id FROM usuarios WHERE email = $1',
      [dto.email],
    );

    if (existing) {
      throw new ConflictException(
        `Ya existe un usuario con el email ${dto.email}`,
      );
    }

    // Verificar que el tenantId existe si se proporciona
    if (dto.tenantId) {
      const tenant = await this.db.queryOne<{ id: string }>(
        `SELECT id FROM tenants WHERE id = $1 AND estado = 'ACTIVO'`,
        [dto.tenantId],
      );
      if (!tenant) {
        throw new NotFoundException(
          `Tenant con ID ${dto.tenantId} no encontrado o inactivo`,
        );
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, this.BCRYPT_ROUNDS);

    const user = await this.db.queryOne<any>(
      `INSERT INTO usuarios (email, password_hash, rol, tenant_id, activo)
       VALUES ($1, $2, $3, $4, true)
       RETURNING id, email, rol, tenant_id`,
      [dto.email, passwordHash, dto.rol || UserRole.USER, dto.tenantId || null],
    );

    this.logger.log(
      `Usuario creado: ${dto.email} (${dto.rol || UserRole.USER})`,
    );
    return {
      id: user!.id,
      email: user!.email,
      rol: user!.rol,
      tenantId: user!.tenant_id,
    };
  }

  /**
   * Cambia la contraseña del usuario actual
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.db.queryOne<any>(
      'SELECT id, password_hash FROM usuarios WHERE id = $1',
      [userId],
    );

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) {
      throw new UnauthorizedException('La contraseña actual es incorrecta');
    }

    const newHash = await bcrypt.hash(newPassword, this.BCRYPT_ROUNDS);
    await this.db.query(
      'UPDATE usuarios SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newHash, userId],
    );

    this.logger.log(`Contraseña cambiada para usuario: ${userId}`);
  }

  /**
   * Valida un payload JWT y retorna el usuario (usado por JwtStrategy)
   */
  async validatePayload(payload: JwtPayload): Promise<JwtPayload> {
    const user = await this.db.queryOne<{ id: string; activo: boolean }>(
      'SELECT id, activo FROM usuarios WHERE id = $1',
      [payload.sub],
    );

    if (!user || !user.activo) {
      throw new UnauthorizedException('Token inválido o usuario inactivo');
    }

    if (payload.type === 'refresh') {
      // Las estrategias de autenticación normales (JWT Guard) no deberían aceptar refresh tokens
      throw new UnauthorizedException('Token de refresco no permitido para acceder a recursos');
    }

    return payload;
  }
}

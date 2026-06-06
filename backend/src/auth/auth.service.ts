import {
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { StringValue } from 'ms';

import { CartService } from '../cart/cart.service';
import { NotificationService } from '../queue/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  RefreshToken,
  Role,
  User,
} from '@prisma/client';
import { UsersService } from '../users/users.service';
import { AUTH_MESSAGES, PASSWORD_RESET_TOKEN_TTL_MS } from './constants';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtPayload } from './types/jwt-payload.type';

type AuthUser = {
  id: string;
  email: string;
  role: Role;
};

type PublicAuthUser = Omit<User, 'passwordHash'>;
type RegisterResponse = Awaited<ReturnType<UsersService['createCustomer']>>;
type MeResponse = NonNullable<Awaited<ReturnType<UsersService['findPublicById']>>>;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => CartService))
    private readonly cartService: CartService,
    private readonly notificationService: NotificationService,
  ) {}

  async register(registerDto: RegisterDto): Promise<RegisterResponse> {
    const normalizedEmail = registerDto.email.trim().toLowerCase();
    const existingUser = await this.usersService.findByEmail(normalizedEmail);

    if (existingUser) {
      throw new ConflictException(AUTH_MESSAGES.EMAIL_ALREADY_IN_USE);
    }

    const passwordHash = await this.hashPassword(registerDto.password);
    const customerCode = this.generateCustomerCode();

    return this.usersService.createCustomer({
      name: registerDto.name,
      email: normalizedEmail,
      phone: registerDto.phone,
      passwordHash,
      customerCode,
    });
  }

  async login(
    loginDto: LoginDto,
    sessionId?: string | null,
  ): Promise<{ accessToken: string; refreshToken: string; user: PublicAuthUser }> {
    const user = await this.validateUser(loginDto.email, loginDto.password);

    if (!user) {
      throw new UnauthorizedException(AUTH_MESSAGES.INVALID_CREDENTIALS);
    }

    const tokens = await this.issueTokens(user);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    if (sessionId && sessionId.trim()) {
      try {
        await this.cartService.mergeGuestCart(user.id, sessionId.trim());
      } catch (error) {
        this.logger.warn(`Cart merge on login failed for user ${user.id}: ${error}`);
      }
    }

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: this.toPublicUser(user),
    };
  }

  async refresh(refreshTokenDto: RefreshTokenDto) {
    const { payload } = await this.validateRefreshToken(refreshTokenDto.refreshToken);

    return {
      accessToken: await this.issueAccessToken({
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      }),
    };
  }

  async logout(refreshTokenDto: RefreshTokenDto) {
    const { tokenRecord } = await this.validateRefreshToken(refreshTokenDto.refreshToken);

    await this.prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: {
        revokedAt: new Date(),
      },
    });

    return {
      message: 'Logged out successfully.',
    };
  }

  async me(userId: string): Promise<MeResponse> {
    const user = await this.usersService.findPublicById(userId);

    if (!user) {
      throw new UnauthorizedException(AUTH_MESSAGES.USER_NOT_FOUND);
    }

    return user;
  }

  /**
   * Always returns the same generic response regardless of whether the email
   * exists, to avoid account enumeration. The reset link is generated and
   * delivered out-of-band via the configured mailer.
   */
  async requestPasswordReset(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.usersService.findByEmail(email);

    if (user && user.status === 'ACTIVE') {
      // Invalidate any existing tokens for this user.
      await this.prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });

      const rawToken = randomBytes(32).toString('hex');
      const tokenHash = await bcrypt.hash(rawToken, this.getSaltRounds());
      const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS);

      await this.prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt },
      });

      const baseUrl =
        this.configService.get<string>('PASSWORD_RESET_BASE_URL') ??
        this.configService.get<string>('PUBLIC_APP_URL') ??
        'http://localhost:3000';
      const resetUrl = `${baseUrl.replace(/\/$/, '')}/reset-password/confirm?token=${rawToken}`;

      await this.notificationService.notifyPasswordReset({
        userId: user.id,
        email: user.email,
        resetUrl,
      });
    } else {
      this.logger.debug(`Password reset requested for unknown/disabled email: ${email}`);
    }

    return {
      message: 'If an account exists for that email, a reset link has been sent.',
    };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const candidates = await this.prisma.passwordResetToken.findMany({
      where: {
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      take: 25,
    });

    let match: (typeof candidates)[number] | null = null;
    for (const candidate of candidates) {
      if (await bcrypt.compare(dto.token, candidate.tokenHash)) {
        match = candidate;
        break;
      }
    }

    if (!match) {
      throw new UnauthorizedException(AUTH_MESSAGES.RESET_TOKEN_INVALID);
    }

    const newHash = await this.hashPassword(dto.newPassword);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: match.userId },
        data: { passwordHash: newHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: match.id },
        data: { usedAt: new Date() },
      }),
      // Force re-login on all devices.
      this.prisma.refreshToken.updateMany({
        where: { userId: match.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { message: 'Password updated successfully. Please sign in again.' };
  }

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email.trim().toLowerCase());

    if (!user) {
      return null;
    }

    // Check lockout before verifying password to avoid bcrypt timing leaks.
    if (user.loginLockedUntil && user.loginLockedUntil > new Date()) {
      return null;
    }

    const passwordMatches = await this.comparePassword(password, user.passwordHash);

    if (!passwordMatches) {
      const MAX_ATTEMPTS = 5;
      const LOCKOUT_MINUTES = 15;
      const newFailCount = (user.loginFailCount ?? 0) + 1;
      const shouldLock = newFailCount >= MAX_ATTEMPTS;

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          loginFailCount: newFailCount,
          loginLockedUntil: shouldLock
            ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
            : null,
        },
      });

      return null;
    }

    // Successful login — reset lockout counters.
    if ((user.loginFailCount ?? 0) > 0 || user.loginLockedUntil) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { loginFailCount: 0, loginLockedUntil: null },
      });
    }

    return user;
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.getSaltRounds());
  }

  async comparePassword(password: string, passwordHash: string): Promise<boolean> {
    return bcrypt.compare(password, passwordHash);
  }

  async issueTokens(user: AuthUser) {
    const accessToken = await this.issueAccessToken(user);
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.getOrThrow<StringValue>('JWT_REFRESH_EXPIRES_IN'),
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  async hashRefreshToken(token: string): Promise<string> {
    return bcrypt.hash(token, this.getSaltRounds());
  }

  private async issueAccessToken(user: AuthUser) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return this.jwtService.signAsync(payload);
  }

  private async storeRefreshToken(userId: string, refreshToken: string) {
    const refreshTokenHash = await this.hashRefreshToken(refreshToken);
    const expiresAt = this.getRefreshTokenExpiry(refreshToken);

    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: refreshTokenHash,
        expiresAt,
      },
    });
  }

  private async validateRefreshToken(refreshToken: string) {
    let payload: JwtPayload;

    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException(AUTH_MESSAGES.REFRESH_TOKEN_INVALID);
    }

    const tokenRecords = await this.prisma.refreshToken.findMany({
      where: {
        userId: payload.sub,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const tokenRecord = await this.findMatchingRefreshToken(tokenRecords, refreshToken);

    if (!tokenRecord) {
      throw new UnauthorizedException(AUTH_MESSAGES.REFRESH_TOKEN_INVALID);
    }

    return {
      payload,
      tokenRecord,
    };
  }

  private async findMatchingRefreshToken(
    tokenRecords: RefreshToken[],
    refreshToken: string,
  ) {
    for (const tokenRecord of tokenRecords) {
      const matches = await this.comparePassword(refreshToken, tokenRecord.tokenHash);

      if (matches) {
        return tokenRecord;
      }
    }

    return null;
  }

  private getRefreshTokenExpiry(refreshToken: string) {
    const decodedToken = this.jwtService.decode(refreshToken);

    if (!decodedToken || typeof decodedToken === 'string' || typeof decodedToken.exp !== 'number') {
      throw new UnauthorizedException(AUTH_MESSAGES.REFRESH_TOKEN_INVALID);
    }

    return new Date(decodedToken.exp * 1000);
  }

  private toPublicUser(user: User): PublicAuthUser {
    const { passwordHash, ...publicUser } = user;

    return publicUser;
  }

  private getSaltRounds(): number {
    return Number(this.configService.get<number>('BCRYPT_SALT_ROUNDS', 10));
  }

  private generateCustomerCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }
}
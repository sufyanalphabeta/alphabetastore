import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { StringValue } from 'ms';

import { PrismaService } from '../prisma/prisma.service';
import {
  RefreshToken,
  Role,
  User,
} from '@prisma/client';
import { UsersService } from '../users/users.service';
import { AUTH_MESSAGES } from './constants';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
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
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
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
  ): Promise<{ accessToken: string; refreshToken: string; user: PublicAuthUser }> {
    const user = await this.validateUser(loginDto.email, loginDto.password);

    if (!user) {
      throw new UnauthorizedException(AUTH_MESSAGES.INVALID_CREDENTIALS);
    }

    const tokens = await this.issueTokens(user);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

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

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email.trim().toLowerCase());

    if (!user) {
      return null;
    }

    const passwordMatches = await this.comparePassword(password, user.passwordHash);

    return passwordMatches ? user : null;
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
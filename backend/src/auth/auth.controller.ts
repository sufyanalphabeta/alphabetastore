import {
	Body,
	Controller,
	Get,
	Headers,
	HttpCode,
	HttpStatus,
	Post,
	Req,
	UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { Public } from '../common/decorators/public.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtPayload } from './types/jwt-payload.type';

type AuthenticatedRequest = {
	user: JwtPayload;
};

@Controller('auth')
export class AuthController {
	constructor(private readonly authService: AuthService) {}

	@Public()
	@Throttle({ default: { ttl: 60_000, limit: 10 } })
	@Post('register')
	register(@Body() registerDto: RegisterDto) {
		return this.authService.register(registerDto);
	}

	@Public()
	@Throttle({ default: { ttl: 60_000, limit: 10 } })
	@Post('login')
	login(
		@Body() loginDto: LoginDto,
		@Headers('x-session-id') sessionId: string | undefined,
	) {
		return this.authService.login(loginDto, sessionId ?? null);
	}

	@Public()
	@Throttle({ default: { ttl: 60_000, limit: 20 } })
	@Post('refresh')
	refresh(@Body() refreshTokenDto: RefreshTokenDto) {
		return this.authService.refresh(refreshTokenDto);
	}

	@Public()
	@Post('logout')
	logout(@Body() refreshTokenDto: RefreshTokenDto) {
		return this.authService.logout(refreshTokenDto);
	}

	@Public()
	@Throttle({ default: { ttl: 60_000, limit: 5 } })
	@HttpCode(HttpStatus.OK)
	@Post('forgot-password')
	forgotPassword(@Body() dto: ForgotPasswordDto) {
		return this.authService.requestPasswordReset(dto);
	}

	@Public()
	@Throttle({ default: { ttl: 60_000, limit: 10 } })
	@HttpCode(HttpStatus.OK)
	@Post('reset-password')
	resetPassword(@Body() dto: ResetPasswordDto) {
		return this.authService.resetPassword(dto);
	}

	@UseGuards(JwtAuthGuard)
	@Get('me')
	me(@Req() request: AuthenticatedRequest) {
		return this.authService.me(request.user.sub);
	}
}
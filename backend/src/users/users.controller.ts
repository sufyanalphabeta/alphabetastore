import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	Patch,
	Post,
	Query,
	Req,
	UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../prisma/prisma-client';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { UsersService } from './users.service';

type UsersRequest = {
	user: JwtPayload;
};

@Controller('users')
export class UsersController {
	constructor(private readonly usersService: UsersService) {}

	@Get('me')
	@UseGuards(JwtAuthGuard)
	findMe(@Req() request: UsersRequest) {
		return this.usersService.findPublicProfileById(request.user.sub);
	}

	@Patch('me')
	@UseGuards(JwtAuthGuard)
	updateMe(@Req() request: UsersRequest, @Body() updateProfileDto: UpdateProfileDto) {
		return this.usersService.updateProfile(request.user.sub, updateProfileDto);
	}

	@Get('me/addresses')
	@UseGuards(JwtAuthGuard)
	findMyAddresses(@Req() request: UsersRequest) {
		return this.usersService.findAddresses(request.user.sub);
	}

	@Get('me/addresses/:id')
	@UseGuards(JwtAuthGuard)
	findMyAddress(@Req() request: UsersRequest, @Param('id') id: string) {
		return this.usersService.findAddressById(request.user.sub, id);
	}

	@Post('me/addresses')
	@UseGuards(JwtAuthGuard)
	createMyAddress(@Req() request: UsersRequest, @Body() createAddressDto: CreateAddressDto) {
		return this.usersService.createAddress(request.user.sub, createAddressDto);
	}

	@Patch('me/addresses/:id')
	@UseGuards(JwtAuthGuard)
	updateMyAddress(
		@Req() request: UsersRequest,
		@Param('id') id: string,
		@Body() updateAddressDto: UpdateAddressDto,
	) {
		return this.usersService.updateAddress(request.user.sub, id, updateAddressDto);
	}

	@Delete('me/addresses/:id')
	@UseGuards(JwtAuthGuard)
	deleteMyAddress(@Req() request: UsersRequest, @Param('id') id: string) {
		return this.usersService.deleteAddress(request.user.sub, id);
	}

	@Get('admin/users')
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(Role.ADMIN)
	findAllCustomers(
		@Query('page') page?: string,
		@Query('limit') limit?: string,
	) {
		return this.usersService.findAllCustomers(
			page ? Number(page) : 1,
			limit ? Number(limit) : 50,
		);
	}
}
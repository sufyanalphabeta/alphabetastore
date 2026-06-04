import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { JwtPayload } from '../auth/types/jwt-payload.type';
import { Role } from '../prisma/prisma-client';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateOrderDto } from './dto/create-order.dto';
import { FindOrdersQueryDto } from './dto/find-orders-query.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrdersService } from './orders.service';

type OrderRequest = {
  user?: JwtPayload | null;
};

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @UseGuards(OptionalJwtAuthGuard)
  create(
    @Req() request: OrderRequest,
    @Headers('x-session-id') sessionId: string | undefined,
    @Body() createOrderDto: CreateOrderDto,
  ) {
    return this.ordersService.createOrder(
      {
        userId: request.user?.sub ?? null,
        sessionId: sessionId ?? null,
      },
      createOrderDto,
    );
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  findAll(@Query() query: FindOrdersQueryDto) {
    return this.ordersService.findAll(query);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  findMine(@Req() request: OrderRequest, @Query() query: FindOrdersQueryDto) {
    return this.ordersService.findMine(request.user!.sub, query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Req() request: OrderRequest, @Param('id') id: string) {
    const user = request.user!;

    return this.ordersService.findOneForUser(id, user.sub, user.role === Role.ADMIN);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  updateStatus(
    @Req() request: OrderRequest,
    @Param('id') id: string,
    @Body() updateOrderStatusDto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(id, request.user!.sub, updateOrderStatusDto);
  }

  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard)
  cancel(
    @Req() request: OrderRequest,
    @Param('id') id: string,
    @Body() body: { note?: string } = {},
  ) {
    const user = request.user!;
    return this.ordersService.cancelOrder(id, user.sub, user.role === Role.ADMIN, body?.note);
  }
}
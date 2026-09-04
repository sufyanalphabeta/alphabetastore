import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { PaymentMethodCode, Role, UserStatus } from '../prisma/prisma-client';
import { CreateAddressDto } from './dto/create-address.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  customerCode: true,
  preferredPaymentMethod: true,
  role: true,
  status: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

const addressSelect = {
  id: true,
  label: true,
  fullName: true,
  phone: true,
  city: true,
  addressLine: true,
  notes: true,
  isDefault: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AddressSelect;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  findPublicById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: publicUserSelect,
    });
  }

  async findPublicProfileById(id: string) {
    const user = await this.findPublicById(id);

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return user;
  }

  async createCustomer(data: CreateUserDto & { passwordHash: string; customerCode?: string }) {
    const payload: Prisma.UserCreateInput = {
      name: data.name,
      email: data.email,
      phone: data.phone,
      customerCode: data.customerCode?.trim() || null,
      preferredPaymentMethod: PaymentMethodCode.COD,
      passwordHash: data.passwordHash,
      role: Role.CUSTOMER,
      status: UserStatus.ACTIVE,
    };

    if (payload.customerCode) {
      return this.prisma.user.create({ data: payload, select: publicUserSelect });
    }

    // A legacy/manual numeric code may already occupy a sequence value.
    // Retrying only the unique customer-code collision keeps allocation safe
    // without replacing the database-backed sequence with a count-based guess.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        return await this.prisma.user.create({
          data: { ...payload, customerCode: await this.nextCustomerCode() },
          select: publicUserSelect,
        });
      } catch (error) {
        const isCustomerCodeConflict =
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          error.code === 'P2002' &&
          'meta' in error &&
          String((error.meta as { target?: unknown })?.target ?? '').includes('customer_code');
        if (!isCustomerCodeConflict || attempt === 4) throw error;
      }
    }

    throw new Error('Unable to allocate a customer code.');
  }

  private async nextCustomerCode() {
    const rows = await this.prisma.$queryRaw<Array<{ value: bigint }>>`
      SELECT nextval('customer_code_seq') AS value
    `;
    const value = rows[0]?.value;
    if (value === undefined) throw new Error('Customer code sequence did not return a value.');
    return String(value).padStart(3, '0');
  }

  findAllCustomers(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    return Promise.all([
      this.prisma.user.findMany({
        where: { role: Role.CUSTOMER },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          customerCode: true,
          status: true,
          createdAt: true,
          _count: {
            select: { orders: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where: { role: Role.CUSTOMER } }),
    ]).then(([items, total]) => ({ items, total, page, limit }));
  }

  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto) {
    await this.findPublicProfileById(userId);

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        name: updateProfileDto.name?.trim(),
        phone:
          typeof updateProfileDto.phone === 'string'
            ? updateProfileDto.phone.trim() || null
            : undefined,
        preferredPaymentMethod: updateProfileDto.preferredPaymentMethod,
      },
      select: publicUserSelect,
    });
  }

  findAddresses(userId: string) {
    return this.prisma.address.findMany({
      where: { userId },
      select: addressSelect,
      orderBy: [
        {
          isDefault: 'desc',
        },
        {
          createdAt: 'desc',
        },
      ],
    });
  }

  async findAddressById(userId: string, id: string) {
    const address = await this.prisma.address.findFirst({
      where: {
        id,
        userId,
      },
      select: addressSelect,
    });

    if (!address) {
      throw new NotFoundException('Address not found.');
    }

    return address;
  }

  async createAddress(userId: string, createAddressDto: CreateAddressDto) {
    const existingAddressCount = await this.prisma.address.count({
      where: { userId },
    });
    const shouldBeDefault =
      createAddressDto.isDefault === true || existingAddressCount === 0;

    const operations = [];

    if (shouldBeDefault) {
      operations.push(
        this.prisma.address.updateMany({
          where: { userId },
          data: { isDefault: false },
        }),
      );
    }

    operations.push(
      this.prisma.address.create({
        data: {
          userId,
          label: createAddressDto.label.trim(),
          fullName: createAddressDto.fullName.trim(),
          phone: createAddressDto.phone.trim(),
          city: createAddressDto.city.trim(),
          addressLine: createAddressDto.addressLine.trim(),
          notes: createAddressDto.notes?.trim() || null,
          isDefault: shouldBeDefault,
        },
        select: addressSelect,
      }),
    );

    const results = await this.prisma.$transaction(operations);
    return results[results.length - 1];
  }

  async updateAddress(userId: string, id: string, updateAddressDto: UpdateAddressDto) {
    const existingAddress = await this.findAddressById(userId, id);
    const shouldBeDefault =
      updateAddressDto.isDefault === true || existingAddress.isDefault;

    const operations = [];

    if (shouldBeDefault) {
      operations.push(
        this.prisma.address.updateMany({
          where: {
            userId,
            id: {
              not: id,
            },
          },
          data: { isDefault: false },
        }),
      );
    }

    operations.push(
      this.prisma.address.update({
        where: { id },
        data: {
          label: updateAddressDto.label?.trim(),
          fullName: updateAddressDto.fullName?.trim(),
          phone: updateAddressDto.phone?.trim(),
          city: updateAddressDto.city?.trim(),
          addressLine: updateAddressDto.addressLine?.trim(),
          notes:
            typeof updateAddressDto.notes === 'string'
              ? updateAddressDto.notes.trim() || null
              : undefined,
          isDefault: shouldBeDefault,
        },
        select: addressSelect,
      }),
    );

    const results = await this.prisma.$transaction(operations);
    return results[results.length - 1];
  }

  async deleteAddress(userId: string, id: string) {
    const existingAddress = await this.findAddressById(userId, id);
    const nextDefaultAddress = existingAddress.isDefault
      ? await this.prisma.address.findFirst({
          where: {
            userId,
            id: {
              not: id,
            },
          },
          select: { id: true },
          orderBy: {
            createdAt: 'desc',
          },
        })
      : null;

    const operations = [
      this.prisma.address.delete({
        where: { id },
      }),
    ];

    if (nextDefaultAddress) {
      operations.push(
        this.prisma.address.update({
          where: { id: nextDefaultAddress.id },
          data: { isDefault: true },
        }),
      );
    }

    await this.prisma.$transaction(operations);

    return {
      message: 'Address deleted successfully.',
    };
  }
}

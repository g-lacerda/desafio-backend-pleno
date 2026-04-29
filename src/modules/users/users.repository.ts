import { Injectable } from '@nestjs/common';
import { Language, User } from '@prisma/client';
import { PrismaService } from '@/shared/database/prisma.service';

export interface CreateUserData {
  email: string;
  name: string;
  preferredLanguage: Language;
  apiKeyHash: string;
  passwordHash: string;
}

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreateUserData): Promise<User> {
    return this.prisma.user.create({ data });
  }

  findByApiKeyHash(apiKeyHash: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { apiKeyHash } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  updateApiKeyHash(userId: string, apiKeyHash: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { apiKeyHash },
    });
  }
}

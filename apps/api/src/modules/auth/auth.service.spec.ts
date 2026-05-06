import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuthService.updateTheme', () => {
  let service: AuthService;
  let prisma: { user: { update: jest.Mock } };

  beforeEach(async () => {
    prisma = { user: { update: jest.fn() } };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get<AuthService>(AuthService);
  });

  it('updates the theme field for the given user id', async () => {
    prisma.user.update.mockResolvedValue({ id: 'u1', theme: 'dark-ocean' });

    const result = await service.updateTheme('u1', 'dark-ocean');

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { theme: 'dark-ocean' },
    });
    expect(result.theme).toBe('dark-ocean');
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { WorkspaceKeysService } from './workspace-keys.service';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../keys/encryption.service';
import type { User } from '@prisma/client';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPrisma = {
  workspace: {
    findUnique: jest.fn(),
  },
  workspaceMember: {
    findUnique: jest.fn(),
  },
  workspaceProviderKey: {
    upsert: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
  },
};

const mockEncryption = {
  encrypt: jest.fn(),
  decrypt: jest.fn(),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-1',
  email: 'owner@test.com',
  name: 'Owner',
  firebaseUid: 'firebase-1',
  avatarUrl: null,
  planningAgentDefaultPrompt: null,
  planningAgentProvider: null,
  planningAgentModel: null,
  planningAgentEncryptedApiKey: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const makeWorkspace = (overrides: Record<string, unknown> = {}) => ({
  id: 'ws-1',
  ownerId: 'user-1',
  name: 'Test Workspace',
  slug: 'test-ws',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const makeProviderKey = (overrides: Record<string, unknown> = {}) => ({
  id: 'key-1',
  workspaceId: 'ws-1',
  provider: 'openai',
  label: 'My OpenAI Key',
  encryptedKey: 'iv:tag:ciphertext',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// ── Test suite ────────────────────────────────────────────────────────────────

describe('WorkspaceKeysService', () => {
  let service: WorkspaceKeysService;
  const owner = makeUser();
  const workspaceId = 'ws-1';

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspaceKeysService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EncryptionService, useValue: mockEncryption },
      ],
    }).compile();

    service = module.get<WorkspaceKeysService>(WorkspaceKeysService);

    // Default: workspace exists and user is owner
    mockPrisma.workspace.findUnique.mockResolvedValue(makeWorkspace());
    mockPrisma.workspaceMember.findUnique.mockResolvedValue({ id: 'member-1' });
    mockEncryption.encrypt.mockReturnValue('iv:tag:ciphertext');
  });

  // ── upsert ─────────────────────────────────────────────────────────────────

  describe('upsert()', () => {
    it('should encrypt key before storing', async () => {
      const saved = makeProviderKey();
      mockPrisma.workspaceProviderKey.upsert.mockResolvedValue({
        id: saved.id,
        provider: saved.provider,
        label: saved.label,
        createdAt: saved.createdAt,
        updatedAt: saved.updatedAt,
      });

      await service.upsert(workspaceId, { provider: 'openai', apiKey: 'sk-123', label: 'My Key' }, owner);

      expect(mockEncryption.encrypt).toHaveBeenCalledWith('sk-123');
      expect(mockPrisma.workspaceProviderKey.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ encryptedKey: 'iv:tag:ciphertext' }),
          update: expect.objectContaining({ encryptedKey: 'iv:tag:ciphertext' }),
        }),
      );
    });

    it('should throw NotFoundException for unknown provider', async () => {
      await expect(
        service.upsert(workspaceId, { provider: 'unknown-provider', apiKey: 'key', label: 'Bad' }, owner),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrisma.workspaceProviderKey.upsert).not.toHaveBeenCalled();
    });

    it('should allow e2b_sandbox as a valid provider', async () => {
      const saved = makeProviderKey({ provider: 'e2b_sandbox' });
      mockPrisma.workspaceProviderKey.upsert.mockResolvedValue({
        id: saved.id,
        provider: 'e2b_sandbox',
        label: saved.label,
        createdAt: saved.createdAt,
        updatedAt: saved.updatedAt,
      });

      await expect(
        service.upsert(workspaceId, { provider: 'e2b_sandbox', apiKey: 'e2b-key', label: 'E2B' }, owner),
      ).resolves.not.toThrow();

      expect(mockPrisma.workspaceProviderKey.upsert).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if user is not the workspace owner', async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(makeWorkspace({ ownerId: 'other-user' }));

      await expect(
        service.upsert(workspaceId, { provider: 'openai', apiKey: 'sk', label: 'Key' }, owner),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── list ───────────────────────────────────────────────────────────────────

  describe('list()', () => {
    it('should return keys without encrypted values', async () => {
      const keys = [
        { id: 'key-1', provider: 'openai', label: 'OpenAI', createdAt: new Date(), updatedAt: new Date() },
        { id: 'key-2', provider: 'anthropic', label: 'Anthropic', createdAt: new Date(), updatedAt: new Date() },
      ];
      mockPrisma.workspaceProviderKey.findMany.mockResolvedValue(keys);

      const result = await service.list(workspaceId, owner);

      expect(result).toEqual(keys);
      // Verify encryptedKey is not returned (not in select)
      result.forEach((key: Record<string, unknown>) => {
        expect(key).not.toHaveProperty('encryptedKey');
      });
    });

    it('should throw ForbiddenException if not workspace member', async () => {
      mockPrisma.workspaceMember.findUnique.mockResolvedValue(null);

      await expect(service.list(workspaceId, owner)).rejects.toThrow(ForbiddenException);
    });
  });

  // ── delete ─────────────────────────────────────────────────────────────────

  describe('delete()', () => {
    it('should delete key record', async () => {
      const key = makeProviderKey();
      mockPrisma.workspaceProviderKey.findUnique.mockResolvedValue(key);
      mockPrisma.workspaceProviderKey.delete.mockResolvedValue(key);

      await service.delete(workspaceId, 'openai', owner);

      expect(mockPrisma.workspaceProviderKey.delete).toHaveBeenCalledWith({
        where: { workspaceId_provider: { workspaceId, provider: 'openai' } },
      });
    });

    it('should throw NotFoundException if key not found', async () => {
      mockPrisma.workspaceProviderKey.findUnique.mockResolvedValue(null);

      await expect(service.delete(workspaceId, 'openai', owner)).rejects.toThrow(NotFoundException);
    });
  });
});

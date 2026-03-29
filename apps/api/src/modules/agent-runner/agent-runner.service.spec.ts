import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgentRunnerService, AGENT_RUN_STREAM } from './agent-runner.service';
import { PrismaService } from '../prisma/prisma.service';

// ── Mock ioredis ─────────────────────────────────────────────────────────────

const mockXadd = jest.fn();
const mockQuit = jest.fn();

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    xadd: mockXadd,
    quit: mockQuit,
  }));
});

// ── Prisma mock ───────────────────────────────────────────────────────────────

const mockPrisma = {
  projectAgent: {
    findUnique: jest.fn(),
  },
  agentRunLog: {
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeProjectAgent = (overrides: Record<string, unknown> = {}) => ({
  id: 'pa-1',
  agentId: 'agent-1',
  projectId: 'proj-1',
  project: { workspaceId: 'ws-1' },
  ...overrides,
});

const makeRunLog = (overrides: Record<string, unknown> = {}) => ({
  id: 'run-1',
  taskId: 'task-1',
  agentId: 'agent-1',
  projectAgentId: 'pa-1',
  status: 'RUNNING',
  startedAt: new Date(),
  finishedAt: null,
  ...overrides,
});

// ── Test suite ────────────────────────────────────────────────────────────────

describe('AgentRunnerService', () => {
  let service: AgentRunnerService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentRunnerService,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: unknown) => defaultValue),
          },
        },
      ],
    }).compile();

    service = module.get<AgentRunnerService>(AgentRunnerService);

    // Trigger Redis client creation (normally called on module init)
    service.onModuleInit();

    mockXadd.mockResolvedValue('stream-id-123');
  });

  // ── enqueue ────────────────────────────────────────────────────────────────

  describe('enqueue()', () => {
    it('should create AgentRunLog with RUNNING status', async () => {
      const pa = makeProjectAgent();
      const runLog = makeRunLog();

      mockPrisma.projectAgent.findUnique.mockResolvedValue(pa);
      mockPrisma.agentRunLog.create.mockResolvedValue(runLog);

      await service.enqueue('task-1', 'pa-1');

      expect(mockPrisma.agentRunLog.create).toHaveBeenCalledWith({
        data: {
          taskId: 'task-1',
          agentId: 'agent-1',
          projectAgentId: 'pa-1',
          status: 'RUNNING',
        },
      });
    });

    it('should push job to Redis stream with correct fields', async () => {
      const pa = makeProjectAgent();
      const runLog = makeRunLog();

      mockPrisma.projectAgent.findUnique.mockResolvedValue(pa);
      mockPrisma.agentRunLog.create.mockResolvedValue(runLog);

      await service.enqueue('task-1', 'pa-1');

      expect(mockXadd).toHaveBeenCalledWith(
        AGENT_RUN_STREAM,
        '*',
        'taskId', 'task-1',
        'agentId', 'agent-1',
        'projectAgentId', 'pa-1',
        'projectId', 'proj-1',
        'workspaceId', 'ws-1',
        'runLogId', 'run-1',
      );
    });

    it('should throw NotFoundException when projectAgent not found', async () => {
      mockPrisma.projectAgent.findUnique.mockResolvedValue(null);

      await expect(service.enqueue('task-1', 'nonexistent-pa')).rejects.toThrow(NotFoundException);
    });
  });

  // ── stop ───────────────────────────────────────────────────────────────────

  describe('stop()', () => {
    it('should update RUNNING log to STOPPED with finishedAt', async () => {
      const runLog = makeRunLog();
      mockPrisma.agentRunLog.findFirst.mockResolvedValue(runLog);
      mockPrisma.agentRunLog.update.mockResolvedValue({ ...runLog, status: 'STOPPED', finishedAt: new Date() });

      await service.stop('task-1');

      expect(mockPrisma.agentRunLog.update).toHaveBeenCalledWith({
        where: { id: 'run-1' },
        data: { status: 'STOPPED', finishedAt: expect.any(Date) },
      });
    });

    it('should be a no-op if no running log exists', async () => {
      mockPrisma.agentRunLog.findFirst.mockResolvedValue(null);

      await service.stop('task-1');

      expect(mockPrisma.agentRunLog.update).not.toHaveBeenCalled();
    });
  });

  // ── getRunLogs ─────────────────────────────────────────────────────────────

  describe('getRunLogs()', () => {
    it('should return run logs ordered by startedAt desc', async () => {
      const logs = [
        makeRunLog({ id: 'run-2', startedAt: new Date('2024-02-01') }),
        makeRunLog({ id: 'run-1', startedAt: new Date('2024-01-01') }),
      ];
      mockPrisma.agentRunLog.findMany.mockResolvedValue(logs);

      const result = await service.getRunLogs('task-1');

      expect(result).toEqual(logs);
      expect(mockPrisma.agentRunLog.findMany).toHaveBeenCalledWith({
        where: { taskId: 'task-1' },
        orderBy: { startedAt: 'desc' },
      });
    });
  });
});

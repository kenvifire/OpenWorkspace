import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../keys/encryption.service';
import { AgentRunnerService } from '../agent-runner/agent-runner.service';
import { PlanningAgentService } from '../planning-agent/planning-agent.service';
import { SetPlannerDto, AcceptPlanDto } from './dto/planner.dto';
import type { User } from '@prisma/client';

@Injectable()
export class PlannerService {
  private readonly logger = new Logger(PlannerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly agentRunner: AgentRunnerService,
    private readonly planningAgentService: PlanningAgentService,
  ) {}

  // ─── Set / unset planner ─────────────────────────────────────────────────

  async setPlanner(projectId: string, dto: SetPlannerDto, user: User) {
    await this.assertProjectLeader(projectId, user.id);

    // Verify the projectAgent belongs to this project
    const pa = await this.prisma.projectAgent.findUnique({
      where: { id: dto.projectAgentId },
      include: { agent: { select: { type: true } } },
    });
    if (!pa || pa.projectId !== projectId) throw new NotFoundException('ProjectAgent not found in this project');
    if (pa.agent.type !== 'AI') throw new BadRequestException('Only AI agents can be used as planners');

    return this.prisma.project.update({
      where: { id: projectId },
      data: { plannerProjectAgentId: dto.projectAgentId },
      select: { id: true, plannerProjectAgentId: true },
    });
  }

  async unsetPlanner(projectId: string, user: User) {
    await this.assertProjectLeader(projectId, user.id);
    return this.prisma.project.update({
      where: { id: projectId },
      data: { plannerProjectAgentId: null },
      select: { id: true, plannerProjectAgentId: true },
    });
  }

  // ─── Run planner ─────────────────────────────────────────────────────────

  /**
   * Trigger the planner agent to generate roles and tasks.
   * Returns a draft plan (JSON) for user review — does NOT commit anything yet.
   */
  async runPlanner(projectId: string, user: User) {
    await this.assertProjectLeader(projectId, user.id);

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        plannerAgent: {
          include: {
            agent: true,
            project: { select: { workspaceId: true } },
          },
        },
      },
    });
    if (!project) throw new NotFoundException('Project not found');

    let provider: string;
    let model: string;
    let apiKey: string | null;
    let systemPrompt: string;
    let temperature: number | null | undefined;
    let maxTokens: number | null | undefined;

    if (project.plannerAgent) {
      // Use hired planner agent config
      const { agent } = project.plannerAgent;
      if (!agent.llmProvider || !agent.modelName) {
        throw new BadRequestException('Planner agent must have llmProvider and modelName configured');
      }
      provider = agent.llmProvider;
      model = agent.modelName;
      apiKey = await this.resolveApiKey(agent, project.workspaceId);
      systemPrompt = agent.systemPrompt ?? 'You are a project planner. Output only valid JSON.';
      temperature = agent.temperature;
      maxTokens = agent.maxTokens;
    } else {
      // Fall back to user-level planning agent config
      if (!user.planningAgentProvider || !user.planningAgentModel) {
        throw new BadRequestException(
          'No planner configured. Either assign a planner agent to this project or configure the Planning Agent provider in your Agents settings.',
        );
      }
      provider = user.planningAgentProvider;
      model = user.planningAgentModel;
      apiKey = await this.planningAgentService.resolveApiKey(user, project.workspaceId);
      systemPrompt = 'You are a project planner. Output only valid JSON. Always include a "dependencies" array on every task.';
      temperature = 0.1;
      maxTokens = undefined;
    }

    if (!apiKey) {
      throw new BadRequestException(`No API key found for provider "${provider}"`);
    }
    const userPrompt = [
      `You are planning a software project. Based on the project description below, output a JSON object with exactly these two keys:`,
      `- "roles": array of { "name": string, "description": string }`,
      `- "tasks": array of { "title": string, "role": string, "priority": "LOW"|"MEDIUM"|"HIGH"|"URGENT", "description": string, "dependencies": string[] }`,
      ``,
      `IMPORTANT — the "dependencies" field:`,
      `  • It is REQUIRED on every task. Never omit it.`,
      `  • It is an array of EXACT titles of other tasks in this plan that must be DONE before this task can start.`,
      `  • Use [] for tasks that have no prerequisites.`,
      `  • Think carefully about the natural execution order: design before implementation, implementation before testing, infrastructure before deployment, etc.`,
      ``,
      `Example of correct output structure:`,
      `{`,
      `  "roles": [{"name": "Backend Developer", "description": "Builds APIs"}],`,
      `  "tasks": [`,
      `    {"title": "Set up database schema", "role": "Backend Developer", "priority": "HIGH", "description": "...", "dependencies": []},`,
      `    {"title": "Build user auth API", "role": "Backend Developer", "priority": "HIGH", "description": "...", "dependencies": ["Set up database schema"]},`,
      `    {"title": "Write auth tests", "role": "Backend Developer", "priority": "MEDIUM", "description": "...", "dependencies": ["Build user auth API"]}`,
      `  ]`,
      `}`,
      ``,
      `Project name: ${project.name}`,
      `Project description: ${project.description}`,
      ``,
      `Output ONLY the JSON object, no markdown, no explanation.`,
    ].join('\n');

    const startedAt = new Date();
    let inputTokens = 0;
    let outputTokens = 0;
    let response: string;
    try {
      const result = await this.callLLMForJSON(provider, model, apiKey, systemPrompt, userPrompt, temperature, maxTokens);
      response = result.content;
      inputTokens = result.inputTokens;
      outputTokens = result.outputTokens;
    } catch (err) {
      await this.prisma.plannerRunLog.create({
        data: {
          projectId,
          status: 'FAILED',
          descriptionSnapshot: project.description,
          error: err instanceof Error ? err.message : String(err),
          startedAt,
          finishedAt: new Date(),
        },
      });
      throw err;
    }

    // Parse and validate
    let plan: { roles: Array<{ name: string; description?: string }>; tasks: Array<{ title: string; role: string; priority?: string; description?: string; dependencies?: string[] }> };
    try {
      plan = JSON.parse(response);
    } catch {
      const errMsg = 'Planner agent returned invalid JSON: ' + response.slice(0, 200);
      await this.prisma.plannerRunLog.create({
        data: {
          projectId,
          status: 'FAILED',
          descriptionSnapshot: project.description,
          error: errMsg,
          totalInputTokens: inputTokens,
          totalOutputTokens: outputTokens,
          startedAt,
          finishedAt: new Date(),
        },
      });
      throw new BadRequestException(errMsg);
    }

    if (!Array.isArray(plan.roles) || !Array.isArray(plan.tasks)) {
      const errMsg = 'Planner output must have "roles" and "tasks" arrays';
      await this.prisma.plannerRunLog.create({
        data: {
          projectId,
          status: 'FAILED',
          descriptionSnapshot: project.description,
          error: errMsg,
          totalInputTokens: inputTokens,
          totalOutputTokens: outputTokens,
          startedAt,
          finishedAt: new Date(),
        },
      });
      throw new BadRequestException(errMsg);
    }

    await this.prisma.plannerRunLog.create({
      data: {
        projectId,
        status: 'COMPLETED',
        descriptionSnapshot: project.description,
        planOutput: plan as any,
        totalInputTokens: inputTokens,
        totalOutputTokens: outputTokens,
        startedAt,
        finishedAt: new Date(),
      },
    });

    return { roles: plan.roles, tasks: plan.tasks };
  }

  // ─── Accept plan ─────────────────────────────────────────────────────────

  /**
   * User accepts (possibly edited) plan — creates tasks on the Kanban board.
   * Roles are informational (stored as customRole on future hires; tasks use role string).
   */
  async acceptPlan(projectId: string, dto: AcceptPlanDto, user: User) {
    await this.assertProjectLeader(projectId, user.id);

    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');

    // Load all active AI agents in the project for role-matching
    const projectAgents = await this.prisma.projectAgent.findMany({
      where: { projectId, revokedAt: null },
      include: { agent: { select: { type: true } } },
    });

    // Build role → projectAgent map (case-insensitive; prefer AI agents)
    const roleMap = new Map<string, string>(); // role string → projectAgentId
    for (const pa of projectAgents) {
      if (pa.agent.type !== 'AI') continue;
      const key = (pa.customRole ?? pa.role).toLowerCase();
      if (!roleMap.has(key)) roleMap.set(key, pa.id);
    }

    // Validate all tasks have an assignee (from DTO or role-map)
    const unassigned = dto.tasks.filter(
      (t) => !t.assigneeId && !roleMap.get(t.role?.toLowerCase() ?? ''),
    );
    if (unassigned.length > 0) {
      throw new BadRequestException(
        `All tasks must have an assignee. Unassigned: ${unassigned.map((t) => `"${t.title}"`).join(', ')}`,
      );
    }

    const { tasks, titleToId } = await this.prisma.$transaction(async (tx) => {
      if (dto.replaceExisting) {
        await tx.task.deleteMany({ where: { projectId, status: 'BACKLOG' } });
      }
      const created = await Promise.all(
        dto.tasks.map((t) => {
          const assigneeId = t.assigneeId ?? roleMap.get(t.role?.toLowerCase() ?? '') ?? null;
          const hasDeps = (t.dependencies ?? []).length > 0;
          return tx.task.create({
            data: {
              projectId,
              title: t.title,
              description: t.description,
              priority: (t.priority as any) ?? 'MEDIUM',
              // Tasks with dependencies start BLOCKED; otherwise TODO if assigned, else BACKLOG
              status: hasDeps ? 'BLOCKED' : assigneeId ? 'TODO' : 'BACKLOG',
              assigneeId,
              reporterId: user.id,
              reporterType: 'user',
            },
          });
        }),
      );

      // Build title → id map for dependency linking
      const map = new Map<string, string>();
      created.forEach((task, i) => map.set(dto.tasks[i].title, task.id));

      // Create TaskDependency records
      const depRecords: { blockingTaskId: string; blockedTaskId: string }[] = [];
      for (const t of dto.tasks) {
        const blockedId = map.get(t.title);
        if (!blockedId) continue;
        for (const depTitle of t.dependencies ?? []) {
          const blockingId = map.get(depTitle);
          if (blockingId && blockingId !== blockedId) {
            depRecords.push({ blockingTaskId: blockingId, blockedTaskId: blockedId });
          }
        }
      }
      if (depRecords.length > 0) {
        await tx.taskDependency.createMany({ data: depRecords, skipDuplicates: true });
      }

      return { tasks: created, titleToId: map };
    });

    // Enqueue runner only for TODO tasks (not BLOCKED, not BACKLOG)
    const toEnqueue = tasks.filter((t) => t.status === 'TODO' && t.assigneeId);
    await Promise.all(toEnqueue.map((t) => this.agentRunner.enqueue(t.id, t.assigneeId!)));

    return { created: tasks.length, autoStarted: toEnqueue.length, roles: dto.roles, tasks };
  }

  // ─── Planner run logs ────────────────────────────────────────────────────

  async getPlannerRunLogs(projectId: string) {
    return this.prisma.plannerRunLog.findMany({
      where: { projectId },
      orderBy: { startedAt: 'desc' },
    });
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private async resolveApiKey(agent: { encryptedApiKey: string | null; llmProvider: string | null }, workspaceId: string): Promise<string | null> {
    if (agent.encryptedApiKey) return this.encryption.decrypt(agent.encryptedApiKey);
    if (!agent.llmProvider) return null;
    const wsk = await this.prisma.workspaceProviderKey.findUnique({
      where: { workspaceId_provider: { workspaceId, provider: agent.llmProvider } },
    });
    if (!wsk) return null;
    return this.encryption.decrypt(wsk.encryptedKey);
  }

  private async callLLMForJSON(
    provider: string,
    model: string,
    apiKey: string,
    systemPrompt: string,
    userPrompt: string,
    temperature?: number | null,
    maxTokens?: number | null,
  ): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
    if (provider === 'anthropic') {
      return this.callAnthropic(model, apiKey, systemPrompt, userPrompt, temperature, maxTokens);
    }
    return this.callOpenAICompat(provider, model, apiKey, systemPrompt, userPrompt, temperature, maxTokens);
  }

  private async callOpenAICompat(
    provider: string,
    model: string,
    apiKey: string,
    systemPrompt: string,
    userPrompt: string,
    temperature?: number | null,
    maxTokens?: number | null,
  ): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
    const baseUrl = provider === 'gemini'
      ? 'https://generativelanguage.googleapis.com/v1beta/openai'
      : 'https://api.openai.com/v1';

    const body: any = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: temperature ?? 0.3,
      ...(maxTokens ? { max_tokens: maxTokens } : {}),
      response_format: { type: 'json_object' },
    };

    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => resp.statusText);
      throw new BadRequestException(`LLM API error ${resp.status}: ${text}`);
    }

    const data = await resp.json() as any;
    return {
      content: data.choices?.[0]?.message?.content ?? '{}',
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
    };
  }

  private async callAnthropic(
    model: string,
    apiKey: string,
    systemPrompt: string,
    userPrompt: string,
    temperature?: number | null,
    maxTokens?: number | null,
  ): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
    const body: any = {
      model,
      system: systemPrompt + '\n\nIMPORTANT: Output ONLY a valid JSON object — no markdown, no code fences. Every task MUST include a "dependencies" array (use [] if none).',
      messages: [{ role: 'user', content: userPrompt }],
      max_tokens: maxTokens ?? 4096,
      temperature: temperature ?? 0.3,
    };

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => resp.statusText);
      throw new BadRequestException(`LLM API error ${resp.status}: ${text}`);
    }

    const data = await resp.json() as any;
    const raw: string = data.content?.[0]?.text ?? '{}';
    // Strip any accidental markdown fences
    const content = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    return {
      content,
      inputTokens: data.usage?.input_tokens ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
    };
  }

  /**
   * Called when an agent creates a new task with no assignee.
   * Uses the project's planner agent to pick the best assignee via a single LLM call.
   * Fire-and-forget safe — all errors are swallowed.
   */
  async autoAssignNewTask(taskId: string, projectId: string): Promise<void> {
    try {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        include: {
          plannerAgent: {
            include: {
              agent: true,
              project: { select: { workspaceId: true } },
            },
          },
        },
      });
      if (!project?.plannerAgent) return;

      const { agent } = project.plannerAgent;
      if (!agent.llmProvider || !agent.modelName) return;

      const apiKey = await this.resolveApiKey(agent, project.workspaceId);
      if (!apiKey) return;

      const task = await this.prisma.task.findUnique({
        where: { id: taskId },
        select: { title: true, description: true },
      });
      if (!task) return;

      const projectAgents = await this.prisma.projectAgent.findMany({
        where: { projectId, revokedAt: null },
        include: { agent: { select: { name: true, type: true } } },
      });

      const agentList = projectAgents.map((pa) => ({
        id: pa.id,
        name: pa.agent.name,
        type: pa.agent.type,
        role: pa.customRole ?? pa.role,
      }));

      const userPrompt = [
        `A new task needs to be assigned. Pick the most suitable agent from the list below.`,
        `If no AI agent is suitable, respond with null so a human can handle it.`,
        ``,
        `Task title: ${task.title}`,
        `Task description: ${task.description ?? 'No description provided'}`,
        ``,
        `Available agents:`,
        ...agentList.map((a) => `- id: "${a.id}", name: "${a.name}", type: "${a.type}", role: "${a.role}"`),
        ``,
        `Respond with JSON only: { "projectAgentId": "<id or null>" }`,
      ].join('\n');

      const result = await this.callLLMForJSON(
        agent.llmProvider,
        agent.modelName,
        apiKey,
        'You are a project coordinator. Assign tasks to the most suitable agent. Output only valid JSON.',
        userPrompt,
        0.1,
        256,
      );

      const parsed = JSON.parse(result.content);
      const rawId: string | null = parsed.projectAgentId ?? null;
      const validAssignee = rawId && agentList.some((a) => a.id === rawId) ? rawId : null;

      await this.prisma.task.update({
        where: { id: taskId },
        data: { assigneeId: validAssignee, status: validAssignee ? 'TODO' : 'BACKLOG' },
      });

      if (validAssignee) {
        const pa = projectAgents.find((a) => a.id === validAssignee)!;
        if (pa.agent.type === 'AI') {
          await this.agentRunner.enqueue(taskId, validAssignee);
        }
        this.logger.log(`Auto-assigned task ${taskId} to agent ${validAssignee}`);
      } else {
        this.logger.log(`Auto-assign: no suitable AI agent for task ${taskId}, left unassigned`);
      }
    } catch (err) {
      this.logger.warn(`autoAssignNewTask failed for task ${taskId}: ${err instanceof Error ? err.message : err}`);
    }
  }

  private async assertProjectLeader(projectId: string, userId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');
    if (project.leaderId !== userId) throw new ForbiddenException('Only the project leader can manage the planner');
    return project;
  }
}

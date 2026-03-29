import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  RawBodyRequest,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RecordUsageDto } from './dto/billing.dto';
import { BillingEvent } from '@prisma/client';
import Stripe from 'stripe';
import type { Request } from 'express';

@Injectable()
export class BillingService {
  private readonly stripe: Stripe | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const stripeKey = this.config.get<string>('STRIPE_SECRET_KEY', '');
    this.stripe = stripeKey
      ? new Stripe(stripeKey, { apiVersion: '2026-02-25.clover' })
      : null;
  }

  // ─── Internal: record a billing event ─────────────────────────────────────
  // Called internally (e.g. from tasks service on job completion or token tracking).

  async recordUsage(workspaceId: string, projectId: string, dto: RecordUsageDto) {
    if (dto.event === BillingEvent.TOKEN_USAGE && !dto.tokenCount) {
      throw new BadRequestException('tokenCount is required for TOKEN_USAGE events');
    }

    const projectAgent = await this.prisma.projectAgent.findUnique({
      where: { id: dto.projectAgentId },
    });
    if (!projectAgent || projectAgent.projectId !== projectId) {
      throw new NotFoundException('ProjectAgent not found in this project');
    }

    return this.prisma.billingRecord.create({
      data: {
        workspaceId,
        projectId,
        projectAgentId: dto.projectAgentId,
        event: dto.event,
        pricingModel: dto.pricingModel,
        amountCents: dto.amountCents,
        tokenCount: dto.tokenCount,
        description: dto.description,
      },
    });
  }

  // ─── Billing cycle summary ─────────────────────────────────────────────────

  async getCycleSummary(workspaceId: string, userId: string) {
    await this.assertWorkspaceMember(workspaceId, userId);

    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const records = await this.prisma.billingRecord.findMany({
      where: { workspaceId, createdAt: { gte: periodStart, lte: periodEnd } },
      include: {
        project: { select: { id: true, name: true } },
        projectAgent: {
          include: { agent: { select: { id: true, name: true } } },
        },
      },
    });

    const totalCents = records.reduce((sum, r) => sum + r.amountCents, 0);

    // Group by project → agent
    const projectMap = new Map<string, {
      projectId: string;
      projectName: string;
      totalCents: number;
      agentMap: Map<string, { agentId: string; agentName: string; totalCents: number }>;
    }>();

    for (const record of records) {
      const pid = record.project.id;
      if (!projectMap.has(pid)) {
        projectMap.set(pid, {
          projectId: pid,
          projectName: record.project.name,
          totalCents: 0,
          agentMap: new Map(),
        });
      }
      const proj = projectMap.get(pid)!;
      proj.totalCents += record.amountCents;

      const aid = record.projectAgent.agent.id;
      if (!proj.agentMap.has(aid)) {
        proj.agentMap.set(aid, {
          agentId: aid,
          agentName: record.projectAgent.agent.name,
          totalCents: 0,
        });
      }
      proj.agentMap.get(aid)!.totalCents += record.amountCents;
    }

    return {
      workspaceId,
      periodStart,
      periodEnd,
      totalCents,
      totalFormatted: this.formatCents(totalCents),
      byProject: Array.from(projectMap.values()).map((p) => ({
        projectId: p.projectId,
        projectName: p.projectName,
        totalCents: p.totalCents,
        totalFormatted: this.formatCents(p.totalCents),
        byAgent: Array.from(p.agentMap.values()).map((a) => ({
          ...a,
          totalFormatted: this.formatCents(a.totalCents),
        })),
      })),
    };
  }

  async getProviderEarnings(userId: string) {
    const provider = await this.prisma.agentProvider.findUnique({ where: { userId } });
    if (!provider) throw new NotFoundException('Provider account not found');

    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const records = await this.prisma.billingRecord.findMany({
      where: {
        createdAt: { gte: periodStart, lte: periodEnd },
        projectAgent: { agent: { providerId: provider.id } },
      },
      include: {
        project: { select: { id: true, name: true } },
        projectAgent: { include: { agent: { select: { id: true, name: true } } } },
      },
    });

    const totalCents = records.reduce((sum, r) => sum + r.amountCents, 0);

    return {
      providerId: provider.id,
      periodStart,
      periodEnd,
      totalCents,
      totalFormatted: this.formatCents(totalCents),
      records: records.map((r) => ({
        id: r.id,
        agentName: r.projectAgent.agent.name,
        projectName: r.project.name,
        event: r.event,
        amountCents: r.amountCents,
        amountFormatted: this.formatCents(r.amountCents),
        createdAt: r.createdAt,
      })),
    };
  }

  // ─── Stripe ───────────────────────────────────────────────────────────────

  async createCheckoutSession(workspaceId: string, amountCents: number, userId: string) {
    if (!this.stripe) throw new BadRequestException('Stripe is not configured');
    await this.assertWorkspaceMember(workspaceId, userId);

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: 'OpenWorkspace Usage' },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      metadata: { workspaceId },
      success_url: `${this.config.get('WEB_URL', 'http://localhost:3000')}/billing?success=1`,
      cancel_url: `${this.config.get('WEB_URL', 'http://localhost:3000')}/billing?cancelled=1`,
    });

    return { url: session.url };
  }

  async handleStripeWebhook(req: RawBodyRequest<Request>) {
    if (!this.stripe) throw new BadRequestException('Stripe is not configured');
    const sig = req.headers['stripe-signature'] as string;
    const webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET', '');

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(req.rawBody!, sig, webhookSecret);
    } catch {
      throw new BadRequestException('Invalid Stripe webhook signature');
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        // Payment confirmed — record any pending billing top-up or mark invoice paid
        // Extend this as billing model evolves
        break;
      }
    }

    return { received: true };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private formatCents(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
  }

  private async assertWorkspaceMember(workspaceId: string, userId: string) {
    const member = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!member) throw new ForbiddenException('Not a member of this workspace');
  }
}

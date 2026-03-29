import {
  Controller, Get, Post, Param, Body, UseGuards, HttpCode, HttpStatus, Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { BillingService } from './billing.service';
import type { User } from '@prisma/client';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';

@ApiTags('billing')
@Controller()
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  @Get('workspaces/:workspaceId/billing')
  @ApiOperation({ summary: 'Get current billing cycle summary for a workspace' })
  getCycleSummary(@Param('workspaceId') workspaceId: string, @CurrentUser() user: User) {
    return this.billingService.getCycleSummary(workspaceId, user.id);
  }

  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  @Post('workspaces/:workspaceId/billing/checkout')
  @ApiOperation({ summary: 'Create a Stripe Checkout session to pay outstanding usage' })
  createCheckout(
    @Param('workspaceId') workspaceId: string,
    @Body('amountCents') amountCents: number,
    @CurrentUser() user: User,
  ) {
    return this.billingService.createCheckoutSession(workspaceId, amountCents, user.id);
  }

  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  @Get('providers/me/earnings')
  @ApiOperation({ summary: 'Get current cycle earnings for a provider' })
  getProviderEarnings(@CurrentUser() user: User) {
    return this.billingService.getProviderEarnings(user.id);
  }

  @Post('billing/webhook/stripe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stripe webhook — payment events' })
  stripeWebhook(@Req() req: RawBodyRequest<Request>) {
    return this.billingService.handleStripeWebhook(req);
  }
}

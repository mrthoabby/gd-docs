// [SELFHOST PATCH] cron.ts simplificado para self-hosted.
//
// Jobs eliminados (no aplican sin Stripe / RevenueCat):
//   - nightly.reconcileStripeSubscriptions   → requiere Stripe API key real
//   - nightly.reconcileStripeRefunds         → requiere Stripe API key real
//   - nightly.reconcileRevenueCatSubscriptions → requiere RevenueCat API key
//   - nightly.revenuecat.syncUser            → requiere RevenueCat API key
//   - nightly.notifyAboutToExpireWorkspaceSubscriptions → envía emails de expiración
//                                             de suscripciones cloud (no aplica)
//
// Jobs conservados:
//   - nightly.cleanExpiredOnetimeSubscriptions → solo opera sobre la BD local ✅

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaClient } from '@prisma/client';

import { JobQueue, OnJob } from '../../base';
import { SubscriptionService } from './service';
import { SubscriptionVariant } from './types';

declare global {
  interface Jobs {
    'nightly.cleanExpiredOnetimeSubscriptions': {};
  }
}

@Injectable()
export class SubscriptionCronJobs {
  private readonly logger = new Logger(SubscriptionCronJobs.name);

  constructor(
    private readonly db: PrismaClient,
    private readonly queue: JobQueue,
    private readonly subscription: SubscriptionService
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async nightlyJob() {
    // Solo el job que opera sobre la BD local — sin llamadas a APIs externas
    await this.queue.add(
      'nightly.cleanExpiredOnetimeSubscriptions',
      {},
      { jobId: 'nightly-payment-clean-expired-onetime-subscriptions' }
    );
  }

  @OnJob('nightly.cleanExpiredOnetimeSubscriptions')
  async cleanExpiredOnetimeSubscriptions() {
    const subscriptions = await this.db.subscription.findMany({
      where: {
        variant: SubscriptionVariant.Onetime,
        end: { lte: new Date() },
      },
    });

    for (const subscription of subscriptions) {
      await this.db.subscription.delete({
        where: {
          targetId_plan: {
            targetId: subscription.targetId,
            plan: subscription.plan,
          },
        },
      });

      this.logger.log(
        `Suscripción one-time expirada eliminada: userId=${subscription.targetId} plan=${subscription.plan}`
      );
    }
  }
}

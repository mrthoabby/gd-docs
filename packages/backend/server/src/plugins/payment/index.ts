import './config';

// [SELFHOST PATCH] PaymentModule simplificado.
// Se mantiene StripeFactory/StripeProvider porque SubscriptionService y los managers
// lo usan internamente. Lo que se eliminó de los providers son los servicios que
// solo tenían sentido para la nube (RevenueCat, StripeWebhook de cloud).
// Los cron jobs de Stripe/RevenueCat fueron eliminados de cron.ts.

import { Module } from '@nestjs/common';

import { ServerConfigModule } from '../../core';
import { FeatureModule } from '../../core/features';
import { MailModule } from '../../core/mail';
import { PermissionModule } from '../../core/permission';
import { QuotaModule } from '../../core/quota';
import { UserModule } from '../../core/user';
import { WorkspaceModule } from '../../core/workspaces';
import { SubscriptionCronJobs } from './cron';
import { PaymentEventHandlers } from './event';
import { LicenseController } from './license/controller';
import {
  SelfhostTeamSubscriptionManager,
  UserSubscriptionManager,
  WorkspaceSubscriptionManager,
} from './manager';
import {
  SubscriptionResolver,
  UserSubscriptionResolver,
  WorkspaceSubscriptionResolver,
} from './resolver';
import {
  RevenueCatService,
  RevenueCatWebhookHandler,
} from './revenuecat';
import { SubscriptionService } from './service';
import { StripeFactory, StripeProvider } from './stripe';

@Module({
  imports: [
    FeatureModule,
    QuotaModule,
    UserModule,
    PermissionModule,
    WorkspaceModule,
    MailModule,
    ServerConfigModule,
  ],
  providers: [
    StripeFactory,
    StripeProvider,
    // RevenueCatService/Handler se mantienen porque UserSubscriptionResolver los inyecta.
    // Sin API key configurada sus métodos fallan silenciosamente (try-catch interno).
    RevenueCatService,
    RevenueCatWebhookHandler,
    SubscriptionService,
    SubscriptionResolver,
    UserSubscriptionResolver,
    UserSubscriptionManager,
    WorkspaceSubscriptionManager,
    SelfhostTeamSubscriptionManager,
    SubscriptionCronJobs,
    WorkspaceSubscriptionResolver,
    PaymentEventHandlers,
  ],
  controllers: [
    LicenseController,
  ],
})
export class PaymentModule {}

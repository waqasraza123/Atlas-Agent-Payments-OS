import type { MiddlewareConsumer, NestModule } from "@nestjs/common";
import { Module, RequestMethod } from "@nestjs/common";
import { AgentsModule } from "./modules/agents/agents.module";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { ApprovalsModule } from "./modules/approvals/approvals.module";
import { ActorModule } from "./modules/actor/actor.module";
import { AuditModule } from "./modules/audit/audit.module";
import { HealthModule } from "./modules/health/health.module";
import { IdentityModule } from "./modules/identity/identity.module";
import { RequestContextMiddleware } from "./middleware/request-context.middleware";
import { OperatorControlsModule } from "./modules/operator-controls/operator-controls.module";
import { OrganizationsModule } from "./modules/organizations/organizations.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { PlatformModule } from "./modules/platform/platform.module";
import { PoliciesModule } from "./modules/policies/policies.module";
import { ProgrammableSettlementModule } from "./modules/programmable-settlement/programmable-settlement.module";
import { ReceiptsModule } from "./modules/receipts/receipts.module";
import { RequestsModule } from "./modules/requests/requests.module";
import { SellersModule } from "./modules/sellers/sellers.module";
import { ServicesModule } from "./modules/services/services.module";

@Module({
  imports: [
    HealthModule,
    ActorModule,
    AnalyticsModule,
    PlatformModule,
    IdentityModule,
    OrganizationsModule,
    AgentsModule,
    PoliciesModule,
    RequestsModule,
    ApprovalsModule,
    AuditModule,
    SellersModule,
    ServicesModule,
    PaymentsModule,
    ProgrammableSettlementModule,
    ReceiptsModule,
    OperatorControlsModule
  ]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes({
      path: "*",
      method: RequestMethod.ALL
    });
  }
}

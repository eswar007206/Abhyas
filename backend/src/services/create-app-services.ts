import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppConfig } from "../config/env.js";
import { createSupabaseAuthClient } from "../lib/supabase-auth.js";
import { createSupabaseAdmin } from "../lib/supabase.js";
import { AuditRepository } from "../modules/audit/repository.js";
import { AuthRepository } from "../modules/auth/repository.js";
import { AuthService } from "../modules/auth/service.js";
import { BatchesRepository } from "../modules/batches/repository.js";
import { BatchesService } from "../modules/batches/service.js";
import { OrganizationRepository } from "../modules/organization/repository.js";
import { OrganizationService } from "../modules/organization/service.js";
import { PaymentsRepository } from "../modules/payments/repository.js";
import { RazorpayClient } from "../modules/payments/razorpay-client.js";
import { PaymentsService } from "../modules/payments/service.js";
import { PermissionsRepository } from "../modules/permissions/repository.js";
import { PermissionsService } from "../modules/permissions/service.js";
import { SubscriptionsRepository } from "../modules/subscriptions/repository.js";
import { SubscriptionsService } from "../modules/subscriptions/service.js";
import { TeachersRepository } from "../modules/teachers/repository.js";
import { TeachersService } from "../modules/teachers/service.js";
import { createSupabaseServicesFromClient } from "./supabase-services.js";
import type { AppServices } from "./index.js";

export interface ExtendedAppServices extends AppServices {
  authSession: AuthService;
  permissions: PermissionsService;
  subscriptions: SubscriptionsService;
  batches: BatchesService;
  teachers: TeachersService;
  payments: PaymentsService;
  organizationService: OrganizationService;
  audit: AuditRepository;
}

export function createAppServices(
  config: AppConfig,
  supabase?: SupabaseClient,
): ExtendedAppServices {
  const admin = supabase ?? createSupabaseAdmin(config);
  const core = createSupabaseServicesFromClient(admin);

  const authRepository = new AuthRepository(admin);
  const authSession = new AuthService(
    createSupabaseAuthClient(config),
    authRepository,
    config.PLATFORM_ROOT_DOMAIN,
  );

  const organizationRepository = new OrganizationRepository(admin);
  const auditRepository = new AuditRepository(admin);
  const permissions = new PermissionsService(new PermissionsRepository(admin));
  const subscriptionsRepository = new SubscriptionsRepository(admin);
  const subscriptions = new SubscriptionsService(subscriptionsRepository);

  const organizationService = new OrganizationService(
    organizationRepository,
    core.auth,
    core.profile,
    authRepository,
    authSession,
    subscriptions,
    auditRepository,
  );
  const batches = new BatchesService(new BatchesRepository(admin));
  const teachers = new TeachersService(new TeachersRepository(admin), core.auth, core.profile);

  const razorpay = new RazorpayClient(
    config.RAZORPAY_KEY_ID ?? "",
    config.RAZORPAY_KEY_SECRET ?? "",
  );
  const payments = new PaymentsService(
    new PaymentsRepository(admin),
    subscriptionsRepository,
    razorpay,
  );

  return {
    ...core,
    organization: {
      createOrganizationWithAdmin: (input) =>
        organizationService.createOrganizationWithAdmin(input),
      getOrganization: (id) => organizationService.getOrganization(id),
      isOrganizationAdmin: (userId, organizationId) =>
        organizationService.isOrganizationAdmin(userId, organizationId),
      createStudent: (input) => organizationService.createStudent(input),
      getStudentProfile: (studentId) => organizationService.getStudentProfile(studentId),
    },
    authSession,
    permissions,
    subscriptions,
    batches,
    teachers,
    payments,
    organizationService,
    audit: auditRepository,
  };
}

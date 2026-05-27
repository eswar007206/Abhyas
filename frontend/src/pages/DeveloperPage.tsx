import { useCallback, useEffect, useMemo, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { EmptyState, LoadingBlock, PortalTabs } from "@/components/portal-tabs";
import { Card, CardHeader, StatCard } from "@/components/dashboard-cards";
import {
  api,
  isBackendApiEnabled,
  type AuditLogRecord,
  type OrganizationRecord,
  type PlanRecord,
} from "@/lib/api";
import { validateSubdomain } from "@/lib/input-validation";
import { supabase } from "@/lib/supabase";

type DevTab = "organizations" | "create" | "analytics" | "audit";

export default function DeveloperPage() {
  const [tab, setTab] = useState<DevTab>("organizations");
  const [organizations, setOrganizations] = useState<OrganizationRecord[]>([]);
  const [plans, setPlans] = useState<PlanRecord[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "suspended">("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [seatUpgrade, setSeatUpgrade] = useState("");
  const [featureFlagsJson, setFeatureFlagsJson] = useState("{}");
  const [analytics, setAnalytics] = useState<{
    capturedPayments: number;
    revenueInr: number;
    activeOrganizations: number;
    suspendedOrganizations: number;
    studentPayments: number;
    organizationPayments: number;
  } | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [impersonateUserId, setImpersonateUserId] = useState("");
  const [impersonateReason, setImpersonateReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: "",
    contactEmail: "",
    seatLimit: 450,
    subdomain: "",
    planSlug: "",
    adminFullName: "",
    adminEmail: "",
    adminPassword: "",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const backendEnabled = isBackendApiEnabled();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (backendEnabled) {
        const [{ organizations: orgRows }, { plans: planRows }] = await Promise.all([
          api.listOrganizations({
            q: search.trim() || undefined,
            status: statusFilter || undefined,
          }),
          api.listPlans("organization"),
        ]);
        setOrganizations(orgRows);
        setPlans(planRows);
      } else {
        const [{ data: orgs }, { data: planRows }] = await Promise.all([
          supabase
            .from("organizations")
            .select(
              "id, name, contact_email, seat_limit, status, subdomain, plan_slug, active_students, branding, feature_flags",
            )
            .order("created_at", { ascending: false }),
          supabase
            .from("plans")
            .select("id, name, slug, audience, price_monthly_inr, seat_limit")
            .eq("audience", "organization")
            .order("price_monthly_inr"),
        ]);
        setOrganizations((orgs ?? []) as OrganizationRecord[]);
        setPlans((planRows ?? []) as PlanRecord[]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load organizations.");
    } finally {
      setLoading(false);
    }
  }, [backendEnabled, search, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const selected = useMemo(
    () => organizations.find((org) => org.id === selectedId) ?? null,
    [organizations, selectedId],
  );

  useEffect(() => {
    if (selected) {
      setFeatureFlagsJson(JSON.stringify(selected.feature_flags ?? {}, null, 2));
    }
  }, [selected]);

  const loadAnalytics = useCallback(async () => {
    if (!backendEnabled) return;
    try {
      const [{ analytics: stats }, { logs }] = await Promise.all([
        api.getPlatformAnalytics(),
        api.getPlatformAuditLogs(),
      ]);
      setAnalytics(stats);
      setAuditLogs(logs);
    } catch {
      setAnalytics(null);
      setAuditLogs([]);
    }
  }, [backendEnabled]);

  useEffect(() => {
    if (tab === "analytics" || tab === "audit") {
      loadAnalytics();
    }
  }, [tab, loadAnalytics]);

  const activeCount = organizations.filter((org) => org.status === "active").length;
  const suspendedCount = organizations.filter((org) => org.status === "suspended").length;

  const createOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    if (!backendEnabled) {
      setError("Set VITE_API_URL and run the backend to create organizations.");
      return;
    }
    const subdomainError = validateSubdomain(form.subdomain);
    if (subdomainError) {
      setError(subdomainError);
      return;
    }
    try {
      const data = await api.createOrganization({
        ...form,
        subdomain: form.subdomain.trim() || undefined,
        planSlug: form.planSlug || undefined,
      });
      setMessage(`Created ${data.organization.name} and admin ${data.admin.email}.`);
      setForm({
        name: "",
        contactEmail: "",
        seatLimit: 450,
        subdomain: "",
        planSlug: "",
        adminFullName: "",
        adminEmail: "",
        adminPassword: "",
      });
      setTab("organizations");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create organization.");
    }
  };

  const runOrgAction = async (action: "suspend" | "restore" | "seats") => {
    if (!selected || !backendEnabled) return;
    setError("");
    setMessage("");
    try {
      if (action === "suspend") {
        await api.suspendOrganization(selected.id);
        setMessage(`Suspended ${selected.name}.`);
      } else if (action === "restore") {
        await api.restoreOrganization(selected.id);
        setMessage(`Restored ${selected.name}.`);
      } else {
        const next = Number(seatUpgrade);
        if (!Number.isFinite(next) || next < 1) {
          setError("Enter a valid seat limit.");
          return;
        }
        await api.upgradeOrganizationSeats(selected.id, next);
        setMessage(`Updated seat limit for ${selected.name} to ${next}.`);
        setSeatUpgrade("");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Organization action failed.");
    }
  };

  const saveFeatureFlags = async () => {
    if (!selected || !backendEnabled) return;
    setError("");
    setMessage("");
    try {
      const featureFlags = JSON.parse(featureFlagsJson) as Record<string, unknown>;
      await api.updateOrganizationFeatureFlags(selected.id, featureFlags);
      setMessage(`Updated feature flags for ${selected.name}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid feature flags JSON.");
    }
  };

  const startImpersonation = async () => {
    if (!backendEnabled || !impersonateUserId.trim() || !impersonateReason.trim()) return;
    setError("");
    setMessage("");
    try {
      const result = await api.startImpersonation({
        targetUserId: impersonateUserId.trim(),
        reason: impersonateReason.trim(),
      });
      setMessage(`Impersonation session started for ${result.target.fullName}. ${result.message}`);
      setImpersonateUserId("");
      setImpersonateReason("");
      await loadAnalytics();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impersonation failed.");
    }
  };

  return (
    <PortalShell>
      <div className="mb-10">
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Developer Portal
        </div>
        <h1 className="mt-2 font-display text-5xl uppercase">Platform operations.</h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          Search organizations, manage lifecycle, allocate seats, and provision new coaching
          centers.
        </p>
      </div>

      {!backendEnabled && (
        <div className="mb-6 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Backend API is not configured. Add <code className="font-mono">VITE_API_URL</code> for
          suspend/restore, seat upgrades, and organization creation.
        </div>
      )}

      <div className="mb-8 grid gap-4 md:grid-cols-4">
        <StatCard k="Organizations" v={String(organizations.length)} />
        <StatCard k="Active" v={String(activeCount)} />
        <StatCard k="Suspended" v={String(suspendedCount)} />
        <StatCard k="Org plans" v={String(plans.length)} />
      </div>

      <PortalTabs
        tabs={[
          { id: "organizations", label: "Organizations" },
          { id: "create", label: "Create org" },
          { id: "analytics", label: "Revenue" },
          { id: "audit", label: "Audit logs" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "analytics" ? (
        analytics ? (
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard k="Revenue (INR)" v={`₹${analytics.revenueInr.toLocaleString()}`} />
            <StatCard k="Captured payments" v={String(analytics.capturedPayments)} />
            <StatCard
              k="Student / Org payments"
              v={`${analytics.studentPayments} / ${analytics.organizationPayments}`}
            />
            <StatCard k="Active orgs" v={String(analytics.activeOrganizations)} />
            <StatCard k="Suspended orgs" v={String(analytics.suspendedOrganizations)} />
          </div>
        ) : (
          <EmptyState
            title="Analytics unavailable"
            description="Connect the backend API to load live payment and organization metrics."
          />
        )
      ) : tab === "audit" ? (
        <Card>
          <CardHeader title="Platform audit log" sub="Recent developer and lifecycle actions" />
          <div className="mt-5 space-y-3">
            {auditLogs.map((log) => (
              <div key={log.id} className="glass rounded-xl p-4 text-sm">
                <div className="font-semibold">{log.action}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(log.created_at).toLocaleString()} · {log.entity_type}
                  {log.organization_id ? ` · org ${log.organization_id.slice(0, 8)}` : ""}
                </div>
              </div>
            ))}
            {auditLogs.length === 0 && (
              <EmptyState
                title="No audit entries"
                description="Platform actions will appear here."
              />
            )}
          </div>
        </Card>
      ) : tab === "create" ? (
        <Card className="max-w-xl">
          <CardHeader
            title="Create Organization"
            sub="Creates coaching center, subdomain, subscription, and admin credentials"
          />
          <form onSubmit={createOrganization} className="mt-5 space-y-3">
            <input
              required
              placeholder="Organization name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full glass rounded-xl px-4 py-3 text-sm"
            />
            <input
              required
              type="email"
              placeholder="Organization contact email"
              value={form.contactEmail}
              onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
              className="w-full glass rounded-xl px-4 py-3 text-sm"
            />
            <input
              placeholder="Subdomain (e.g. academy → academy.abhyas.in)"
              value={form.subdomain}
              onChange={(e) =>
                setForm({ ...form, subdomain: e.target.value.toLowerCase().replace(/\s+/g, "") })
              }
              minLength={2}
              maxLength={63}
              className="w-full glass rounded-xl px-4 py-3 text-sm"
            />
            <select
              value={form.planSlug}
              onChange={(e) => setForm({ ...form, planSlug: e.target.value })}
              className="w-full glass rounded-xl px-4 py-3 text-sm"
            >
              <option value="">No subscription plan</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.slug}>
                  {plan.name} (₹{plan.price_monthly_inr}/mo)
                </option>
              ))}
            </select>
            <input
              required
              type="number"
              min={1}
              placeholder="Seat limit"
              value={form.seatLimit}
              onChange={(e) => setForm({ ...form, seatLimit: Number(e.target.value) })}
              className="w-full glass rounded-xl px-4 py-3 text-sm"
            />
            <input
              required
              placeholder="Admin full name"
              value={form.adminFullName}
              onChange={(e) => setForm({ ...form, adminFullName: e.target.value })}
              className="w-full glass rounded-xl px-4 py-3 text-sm"
            />
            <input
              required
              type="email"
              placeholder="Admin email (e.g. admin@academy.abhyas.in)"
              value={form.adminEmail}
              onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
              className="w-full glass rounded-xl px-4 py-3 text-sm"
            />
            <input
              required
              type="password"
              minLength={8}
              placeholder="Admin temporary password"
              value={form.adminPassword}
              onChange={(e) => setForm({ ...form, adminPassword: e.target.value })}
              className="w-full glass rounded-xl px-4 py-3 text-sm"
            />
            {(error || message) && (
              <div
                className={`rounded-xl px-4 py-3 text-sm ${error ? "bg-destructive/10 text-destructive" : "bg-neet/10 text-neet"}`}
              >
                {error || message}
              </div>
            )}
            <button
              disabled={!backendEnabled}
              className="w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground disabled:opacity-50"
            >
              Create organization
            </button>
          </form>
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <CardHeader title="Organization directory" sub="Search and filter live customers" />
            <div className="mt-4 flex flex-wrap gap-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, email, subdomain"
                className="min-w-[220px] flex-1 glass rounded-xl px-4 py-2.5 text-sm"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as "" | "active" | "suspended")}
                className="glass rounded-xl px-4 py-2.5 text-sm"
              >
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
              <button
                onClick={() => load()}
                className="rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background"
              >
                Search
              </button>
            </div>
            <div className="mt-5 space-y-3">
              {loading ? (
                <LoadingBlock label="Loading organizations..." />
              ) : organizations.length === 0 ? (
                <EmptyState
                  title="No organizations found"
                  description="Create your first coaching center or adjust search filters."
                />
              ) : (
                organizations.map((org) => (
                  <button
                    key={org.id}
                    type="button"
                    onClick={() => setSelectedId(org.id)}
                    className={`w-full rounded-2xl p-4 text-left transition-colors ${
                      selectedId === org.id ? "border border-primary bg-primary/10" : "glass"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold">{org.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {org.contact_email ?? "No contact email"}
                          {org.subdomain ? ` · ${org.subdomain}.abhyas.in` : ""}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-display text-2xl">
                          {org.active_students}/{org.seat_limit}
                        </div>
                        <div className="text-[10px] font-mono uppercase text-muted-foreground">
                          {org.status}
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Organization details" sub="Lifecycle and seat operations" />
            {!selected ? (
              <EmptyState
                title="Select an organization"
                description="Choose a row to suspend, restore, or upgrade seats."
              />
            ) : (
              <div className="mt-5 space-y-4">
                <div className="glass rounded-2xl p-4">
                  <div className="font-semibold">{selected.name}</div>
                  <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                    <div>Status: {selected.status}</div>
                    <div>Plan: {selected.plan_slug ?? "none"}</div>
                    <div>
                      Seats: {selected.active_students} used / {selected.seat_limit} purchased
                    </div>
                    <div>Subdomain: {selected.subdomain ?? "not set"}</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selected.status === "active" ? (
                    <button
                      disabled={!backendEnabled}
                      onClick={() => runOrgAction("suspend")}
                      className="rounded-xl bg-destructive/10 px-4 py-2 text-sm font-semibold text-destructive disabled:opacity-50"
                    >
                      Suspend
                    </button>
                  ) : (
                    <button
                      disabled={!backendEnabled}
                      onClick={() => runOrgAction("restore")}
                      className="rounded-xl bg-neet/10 px-4 py-2 text-sm font-semibold text-neet disabled:opacity-50"
                    >
                      Restore
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={selected.active_students || 1}
                    placeholder="New seat limit"
                    value={seatUpgrade}
                    onChange={(e) => setSeatUpgrade(e.target.value)}
                    className="flex-1 glass rounded-xl px-4 py-2.5 text-sm"
                  />
                  <button
                    disabled={!backendEnabled}
                    onClick={() => runOrgAction("seats")}
                    className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    Update seats
                  </button>
                </div>
                <div>
                  <div className="mb-2 text-sm font-semibold">Support impersonation</div>
                  <input
                    placeholder="Target user UUID"
                    value={impersonateUserId}
                    onChange={(e) => setImpersonateUserId(e.target.value)}
                    className="mb-2 w-full glass rounded-xl px-4 py-2.5 text-sm font-mono"
                  />
                  <input
                    placeholder="Reason for support access"
                    value={impersonateReason}
                    onChange={(e) => setImpersonateReason(e.target.value)}
                    className="mb-2 w-full glass rounded-xl px-4 py-2.5 text-sm"
                  />
                  <button
                    disabled={!backendEnabled}
                    onClick={startImpersonation}
                    className="rounded-xl bg-destructive/10 px-4 py-2 text-sm font-semibold text-destructive disabled:opacity-50"
                  >
                    Start impersonation session
                  </button>
                </div>
                <div>
                  <div className="mb-2 text-sm font-semibold">Feature flags (JSON)</div>
                  <textarea
                    value={featureFlagsJson}
                    onChange={(e) => setFeatureFlagsJson(e.target.value)}
                    className="min-h-[120px] w-full glass rounded-xl px-4 py-3 font-mono text-xs"
                  />
                  <button
                    disabled={!backendEnabled}
                    onClick={saveFeatureFlags}
                    className="mt-2 rounded-xl bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50"
                  >
                    Save feature flags
                  </button>
                </div>
                {(error || message) && (
                  <div
                    className={`rounded-xl px-4 py-3 text-sm ${error ? "bg-destructive/10 text-destructive" : "bg-neet/10 text-neet"}`}
                  >
                    {error || message}
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      )}
    </PortalShell>
  );
}

import { useEffect, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { Card, CardHeader, StatCard } from "@/components/dashboard-cards";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";

interface Organization {
  id: string;
  name: string;
  contact_email: string | null;
  seat_limit: number;
  status: string;
}

interface Plan {
  id: string;
  name: string;
  audience: string;
  price_monthly_inr: number;
}

export default function DeveloperPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [form, setForm] = useState({
    name: "",
    contactEmail: "",
    seatLimit: 450,
    adminFullName: "",
    adminEmail: "",
    adminPassword: "",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    const [{ data: orgs }, { data: planRows }] = await Promise.all([
      supabase
        .from("organizations")
        .select("id, name, contact_email, seat_limit, status")
        .order("created_at", { ascending: false }),
      supabase
        .from("plans")
        .select("id, name, audience, price_monthly_inr")
        .order("price_monthly_inr"),
    ]);
    setOrganizations((orgs ?? []) as Organization[]);
    setPlans((planRows ?? []) as Plan[]);
  };

  useEffect(() => {
    load();
  }, []);

  const createOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      const data = await api.createOrganization(form);
      setMessage(`Created ${data.organization.name} and admin ${data.admin.email}.`);
      setForm({
        name: "",
        contactEmail: "",
        seatLimit: 450,
        adminFullName: "",
        adminEmail: "",
        adminPassword: "",
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create organization.");
      return;
    }
  };

  return (
    <PortalShell>
      <div className="mb-10">
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Developer Portal
        </div>
        <h1 className="mt-2 font-display text-5xl uppercase">Control Abhyas.</h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          Create organizations, allocate seats, and watch platform setup.
        </p>
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <StatCard k="Organizations" v={String(organizations.length)} />
        <StatCard k="Plans" v={String(plans.length)} />
        <StatCard k="Default org seats" v="450" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader
            title="Create Organization"
            sub="Creates coaching center and admin credentials"
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
              placeholder="Admin email"
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
            {error && (
              <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}
            {message && (
              <div className="rounded-xl bg-neet/10 px-4 py-3 text-sm text-neet">{message}</div>
            )}
            <button className="w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground">
              Create organization
            </button>
          </form>
        </Card>

        <Card>
          <CardHeader title="Organizations" sub="Current customers" />
          <div className="mt-5 space-y-3">
            {organizations.map((org) => (
              <div key={org.id} className="glass rounded-2xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold">{org.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {org.contact_email ?? "No contact email"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-2xl">{org.seat_limit}</div>
                    <div className="text-[10px] font-mono uppercase text-muted-foreground">
                      {org.status}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {organizations.length === 0 && (
              <p className="text-sm text-muted-foreground">No organizations yet.</p>
            )}
          </div>
        </Card>
      </div>
    </PortalShell>
  );
}

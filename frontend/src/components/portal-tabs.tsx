import { cn } from "@/lib/utils";

export function PortalTabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: Array<{ id: T; label: string }>;
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="mb-8 flex flex-wrap gap-2 rounded-2xl glass p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            "rounded-xl px-4 py-2 text-sm font-semibold transition-colors",
            active === tab.id ? "bg-foreground text-background" : "text-muted-foreground",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border px-6 py-10 text-center">
      <div className="font-semibold">{title}</div>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export function LoadingBlock({ label = "Loading..." }: { label?: string }) {
  return <div className="rounded-2xl glass px-6 py-8 text-sm text-muted-foreground">{label}</div>;
}

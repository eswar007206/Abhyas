import { motion } from "framer-motion";

export function StatCard({
  k,
  v,
  delta,
  color,
}: {
  k: string;
  v: string;
  delta?: string;
  color?: string;
}) {
  return (
    <motion.div whileHover={{ y: -2 }} className="glass-strong rounded-2xl p-5">
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        {k}
      </div>
      <div className="font-display text-3xl mt-2" style={{ color }}>
        {v}
      </div>
      {delta && <div className="text-xs text-muted-foreground mt-1">{delta}</div>}
    </motion.div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`glass-strong rounded-3xl p-6 ${className}`}>{children}</div>;
}

export function CardHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        {sub}
      </div>
      <div className="font-display text-2xl uppercase mt-1">{title}</div>
    </div>
  );
}

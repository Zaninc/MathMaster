import { cn } from "@/lib/utils/cn";

export type BadgeVariant = "dev" | "preview" | "planned";

const VARIANT_LABEL: Record<BadgeVariant, string> = {
  dev: "Em desenvolvimento",
  preview: "Preview",
  planned: "Planejado",
};

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  dev: "border-accent-secondary/40 text-accent-secondary bg-accent-secondary/10",
  preview: "border-accent/40 text-accent bg-accent/10",
  planned: "border-border-hover text-text-secondary bg-surface-elevated",
};

interface BadgeProps {
  variant: BadgeVariant;
  children?: React.ReactNode;
  className?: string;
}

export function Badge({ variant, children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium leading-none transition-colors duration-(--motion-fast)",
        VARIANT_CLASSES[variant],
        className
      )}
    >
      {children ?? VARIANT_LABEL[variant]}
    </span>
  );
}

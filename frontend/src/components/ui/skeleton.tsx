import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-lg bg-noc-surface-hover", className)}
      {...props}
    />
  );
}

export { Skeleton };

import { Loader2 } from "lucide-react";

export default function LoadingScreen({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-noc-bg">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-noc-accent" />
        <p className="text-sm text-noc-text-muted">{message}</p>
      </div>
    </div>
  );
}

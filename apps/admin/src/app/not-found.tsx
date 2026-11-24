import Link from "next/link";
import { AlertCircle, ArrowLeft, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground px-4 py-12">
      <div className="max-w-md w-full bg-card text-card-foreground rounded-2xl shadow-xl border border-border/60 p-8 text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
          <AlertCircle className="w-8 h-8" />
        </div>

        <div>
          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-muted text-muted-foreground">
            Error 404
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mt-3">
            Page Not Found
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            The admin console route you are attempting to access does not exist
            or has been relocated.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Button asChild className="w-full sm:w-auto rounded-xl cursor-pointer">
            <Link href="/" className="flex items-center gap-2">
              <Home className="w-4 h-4" />
              Return to Dashboard
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="w-full sm:w-auto rounded-xl border-border/60 cursor-pointer"
          >
            <Link href="/settings" className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              Settings
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

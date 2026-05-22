import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { useAuth } from "@/stores/auth";
import { Building2, Lock, UserPlus } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — Lead Hub CRM" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { signIn, signUp, user } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/" });
  }, [user, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signin") {
        await signIn(email, password);
        toast.success("Welcome back");
      } else {
        if (password.length < 6) throw new Error("Password must be at least 6 characters");
        if (!fullName.trim()) throw new Error("Please enter your name");
        await signUp(email, password, fullName.trim());
        toast.success("Account created");
      }
      navigate({ to: "/" });
    } catch (err: any) {
      toast.error(err?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="hidden md:flex flex-col justify-between p-12 bg-sidebar-bg text-sidebar-fg">
        <div className="flex items-center gap-2">
          <div className="size-9 rounded-md bg-teal text-teal-foreground grid place-items-center">
            <Building2 className="size-5" />
          </div>
          <span className="text-lg font-semibold tracking-tight">Lead Hub</span>
        </div>
        <div>
          <h1 className="text-4xl font-bold leading-tight">Your lead pipeline,<br/>under one roof.</h1>
          <p className="mt-4 text-sidebar-muted max-w-md">
            A simple CRM to capture leads, log updates, and instantly see who's contacting which company.
          </p>
        </div>
        <div className="text-xs text-sidebar-muted">© Lead Hub CRM</div>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="inline-flex rounded-md border border-border bg-card p-1 mb-6">
            <button
              onClick={() => setMode("signin")}
              className={`px-4 py-1.5 text-sm rounded ${mode === "signin" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >Sign in</button>
            <button
              onClick={() => setMode("signup")}
              className={`px-4 py-1.5 text-sm rounded ${mode === "signup" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >Create account</button>
          </div>

          <h2 className="text-2xl font-semibold">{mode === "signin" ? "Sign in" : "Create your account"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signin" ? "Welcome back." : "Start adding and tracking your leads in minutes."}
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <label className="block">
                <span className="text-sm font-medium">Full name</span>
                <input
                  required value={fullName} onChange={(e) => setFullName(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
            )}
            <label className="block">
              <span className="text-sm font-medium">Email</span>
              <input
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Password</span>
              <input
                type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {mode === "signup" && <span className="text-xs text-muted-foreground">At least 6 characters.</span>}
            </label>
            <button
              type="submit" disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
            >
              {mode === "signin" ? <Lock className="size-4" /> : <UserPlus className="size-4" />}
              {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}

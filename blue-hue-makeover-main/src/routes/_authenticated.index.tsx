import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMe } from "@/lib/crm.functions";
import { Dashboard } from "@/components/crm/Dashboard";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({ meta: [{ title: "Dashboard — Lead Hub" }] }),
  component: HomePage,
});

function HomePage() {
  const getMeFn = useServerFn(getMe);
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => getMeFn() });
  const navigate = useNavigate();
  useEffect(() => {
    if (me?.role === "admin") navigate({ to: "/admin" });
  }, [me, navigate]);
  if (me?.role === "admin") return null;
  return <Dashboard />;
}

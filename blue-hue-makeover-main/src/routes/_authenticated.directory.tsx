import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect, useCallback } from "react";
import { searchCompanyDirectory } from "@/lib/crm.functions";
import { Search, Building2, User2, Tag, UserCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/directory")({
  head: () => ({ meta: [{ title: "Company Directory — Lead Hub" }] }),
  component: DirectoryPage,
});

function DirectoryPage() {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const searchFn = useServerFn(searchCompanyDirectory);
  const { data, isFetching } = useQuery({
    queryKey: ["directory-search", query],
    queryFn: () => searchFn({ data: { q: query } }),
    enabled: query.length > 0,
  });

  // debounce input → query
  useEffect(() => {
    const t = setTimeout(() => setQuery(input.trim()), 350);
    return () => clearTimeout(t);
  }, [input]);

  const clear = useCallback(() => {
    setInput("");
    setQuery("");
  }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight inline-flex items-center gap-2">
          <Search className="size-6" /> Company Directory
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Search across the whole team to check if a company or POC is already being handled before you reach out.
        </p>
      </header>

      <div className="mb-5 relative max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type any part of company, lead, POC or phone…"
          className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-24 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {input && (
          <button
            onClick={clear}
            className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-1 text-xs rounded bg-muted text-muted-foreground hover:bg-muted/80"
          >
            Clear
          </button>
        )}
      </div>

      {!query && (
        <div className="text-sm text-muted-foreground border border-dashed border-border rounded-lg p-8 text-center">
          Start typing above to search — even partial names like <strong>"inmo"</strong> will find <strong>InMobi</strong>.
        </div>
      )}

      {query && isFetching && (
        <div className="text-sm text-muted-foreground p-4">Searching…</div>
      )}

      {query && !isFetching && (data?.length ?? 0) === 0 && (
        <div className="text-sm text-muted-foreground border border-dashed border-border rounded-lg p-8 text-center">
          No matches for <strong>“{query}”</strong>. This company isn’t being worked on yet — you’re clear to reach out.
        </div>
      )}

      {query && (data?.length ?? 0) > 0 && (
        <div className="space-y-3">
          {data!.map((row) => (
            <div key={row.id} className="border border-border rounded-lg bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-semibold inline-flex items-center gap-2">
                    <Building2 className="size-4 text-muted-foreground" />
                    {row.company_name || "—"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">Lead: {row.lead_name}</div>
                </div>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-xs capitalize">
                  <Tag className="size-3" /> {row.status ?? "new"}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">POC</div>
                  <div className="inline-flex items-center gap-1.5 mt-0.5">
                    <User2 className="size-3.5 text-muted-foreground" />
                    {row.poc_name || <span className="text-muted-foreground">—</span>}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Handled by</div>
                  <div className="inline-flex items-center gap-1.5 mt-0.5 font-medium">
                    <UserCircle2 className="size-3.5 text-muted-foreground" />
                    {row.owner?.full_name ?? "Unknown"}
                  </div>
                  {row.owner?.email && (
                    <div className="text-xs text-muted-foreground ml-5">{row.owner.email}</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

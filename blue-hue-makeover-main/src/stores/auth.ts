import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

type AuthState = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  init: () => () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
};

export const useAuth = create<AuthState>((set) => ({
  user: null,
  session: null,
  loading: true,
  init: () => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      set({ session, user: session?.user ?? null, loading: false });
    });
    supabase.auth.getSession().then(({ data }) => {
      set({ session: data.session, user: data.session?.user ?? null, loading: false });
    });
    return () => sub.subscription.unsubscribe();
  },
  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  },
  signUp: async (email, password, fullName) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/`,
      },
    });
    if (error) throw error;
    // auto-confirm is on; sign in to establish session immediately
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
    if (signInErr) throw signInErr;
  },
  signOut: async () => {
    await supabase.auth.signOut();
  },
}));

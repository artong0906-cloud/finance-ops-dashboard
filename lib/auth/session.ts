import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { internalEmailToLoginId } from "@/lib/auth/internal-email";

export type AllowedRole = "admin" | "finance" | "executive" | "viewer";

export type AllowedUserProfile = {
  email: string;
  login_id: string | null;
  internal_email: string | null;
  name: string | null;
  role: AllowedRole;
  status: "active" | "inactive";
};

export async function getAllowedUser() {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user?.email) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("allowed_users")
    .select("email,login_id,internal_email,name,role,status")
    .eq("email", authData.user.email)
    .eq("status", "active")
    .maybeSingle<AllowedUserProfile>();

  if (profileError || !profile) {
    redirect("/access-denied");
  }

  return {
    user: authData.user,
    profile: {
      ...profile,
      login_id: profile.login_id || internalEmailToLoginId(profile.email)
    }
  };
}

export async function requireAdmin() {
  const session = await getAllowedUser();
  if (session.profile.role !== "admin") {
    redirect("/access-denied");
  }
  return session;
}

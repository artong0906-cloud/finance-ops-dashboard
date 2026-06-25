import { redirect } from "next/navigation";
import { headers } from "next/headers";
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

async function isLocalDesignReview() {
  const host = (await headers()).get("host") || "";
  return process.env.NODE_ENV === "development" && (host.startsWith("127.0.0.1") || host.startsWith("localhost"));
}

function localDesignReviewSession() {
  const profile: AllowedUserProfile = {
    email: "local-preview@financeops.local",
    login_id: "local-preview",
    internal_email: "local-preview@financeops.local",
    name: "디자인 검토",
    role: "admin",
    status: "active"
  };

  return {
    user: {
      id: "local-preview",
      email: profile.email
    },
    profile
  };
}

export async function getAllowedUser() {
  const supabase = await createClient();
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const sessionUser = sessionData.session?.user;

  if (sessionError || !sessionUser?.email) {
    if (await isLocalDesignReview()) return localDesignReviewSession();
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("allowed_users")
    .select("email,login_id,internal_email,name,role,status")
    .eq("email", sessionUser.email)
    .eq("status", "active")
    .maybeSingle<AllowedUserProfile>();

  if (profileError || !profile) {
    redirect("/access-denied");
  }

  return {
    user: sessionUser,
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

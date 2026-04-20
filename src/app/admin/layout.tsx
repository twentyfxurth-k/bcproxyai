import { redirect } from "next/navigation";
import { auth } from "../../../auth";
import { isOwnerEmail, hasOwners } from "@/lib/admin-emails";

// Server-side guard for /admin/*. Uses Google OAuth session instead of the
// old master-key prompt. If OAuth isn't configured at all (local dev), the
// area is open — matches the rest of the system's "no env = no auth" rule.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const hasOauth = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.NEXTAUTH_SECRET);

  // Local mode: no OAuth, no owners → everything open
  if (!hasOauth && !hasOwners()) return <>{children}</>;

  const session = await auth();
  const email = session?.user?.email ?? "";

  if (!email) {
    // Not logged in → bounce to Google sign-in, return here on success
    redirect("/login?callbackUrl=/admin/keys");
  }

  if (!isOwnerEmail(email)) {
    // Logged in but not an admin
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center p-6">
        <div className="max-w-md rounded-xl border border-red-500/30 bg-red-500/5 p-6 space-y-3 text-center">
          <div className="text-3xl">🚫</div>
          <div className="text-sm font-bold">คุณไม่มีสิทธิ์เข้าหน้า Admin</div>
          <div className="text-xs text-gray-400">
            บัญชี <code className="text-amber-300">{email}</code> ไม่ได้อยู่ใน{" "}
            <code>AUTH_OWNER_EMAIL</code> ของ server นี้
          </div>
          <a href="/" className="inline-block text-xs text-indigo-300 hover:underline">
            กลับหน้าหลัก
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

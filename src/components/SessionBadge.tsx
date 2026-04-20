import { auth, signOut } from "../../auth";

export async function SessionBadge() {
  const session = await auth();
  if (!session?.user?.email) return null;

  const email = session.user.email;
  const role = (session as { role?: string }).role ?? "viewer";
  const isOwner = role === "owner";

  return (
    <div className="fixed bottom-3 right-3 z-[60] flex items-center gap-2 rounded-full border border-gray-700 bg-gray-900/90 pl-3 pr-1.5 py-1 text-xs text-gray-200 backdrop-blur shadow-lg">
      <span
        className={`inline-block h-2 w-2 rounded-full ${
          isOwner ? "bg-emerald-400" : "bg-amber-400"
        }`}
        title={isOwner ? "Owner — full access" : "Viewer — read-only"}
      />
      <span className="font-mono max-w-[14rem] truncate" title={email}>
        {email}
      </span>
      <span
        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
          isOwner ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"
        }`}
      >
        {role}
      </span>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <button
          type="submit"
          className="flex items-center gap-1 rounded-full bg-red-500/15 hover:bg-red-500/30 text-red-300 hover:text-red-200 px-2.5 py-1 transition"
          title="ออกจากระบบ"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span>ออกจากระบบ</span>
        </button>
      </form>
    </div>
  );
}

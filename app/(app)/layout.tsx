import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/top-bar";
import { IdleKeepalive } from "@/components/idle-keepalive";
import { FloatingChat } from "@/components/floating-chat";
import { BottomNav } from "@/components/bottom-nav";
import { ToastProvider } from "@/components/toast-provider";
import { DemoBanner } from "@/components/demo-banner";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const isDemo = session.email === "demo@vitals.app";
  return (
    <div className="min-h-screen flex flex-col">
      {isDemo && <DemoBanner />}
      <div className="flex-1 flex">
      <IdleKeepalive />
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar email={session.email} />
        <main id="main" tabIndex={-1} className="flex-1 px-6 md:px-10 py-8 pb-20 md:pb-8 max-w-7xl w-full mx-auto focus:outline-none">
          {children}
        </main>
      </div>
      </div>
      <FloatingChat />
      <BottomNav />
      <ToastProvider />
    </div>
  );
}

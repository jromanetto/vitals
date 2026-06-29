import { redirect } from "next/navigation";
import { getSession, getViewContext } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/top-bar";
import { ViewingBanner } from "@/components/profile-switcher";
import { IdleKeepalive } from "@/components/idle-keepalive";
import { FloatingChat } from "@/components/floating-chat";
import { BottomNav } from "@/components/bottom-nav";
import { ToastProvider } from "@/components/toast-provider";
import { DemoBanner } from "@/components/demo-banner";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const isDemo = session.email === "demo@vitals.app";
  const viewContext = await getViewContext();
  return (
    <div className="min-h-screen flex flex-col">
      {isDemo && <DemoBanner />}
      <div className="flex-1 flex">
      <IdleKeepalive />
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar email={session.email} viewContext={viewContext} />
        {viewContext && <ViewingBanner ctx={viewContext} />}
        <main id="main" tabIndex={-1} className="flex-1 px-6 md:px-12 py-10 md:py-14 lg:py-16 pb-24 md:pb-16 max-w-6xl w-full mx-auto focus:outline-none">
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

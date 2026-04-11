import { AIChatbot } from "@/components/ai/AIChatbot";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { SidebarProvider } from "@/components/layout/SidebarProvider";
import { UIProvider } from "@/components/providers/UIProvider";
import { CommandMenu } from "@/components/ui-patterns/CommandMenu";

export default function ShellLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <UIProvider>
      <SidebarProvider>
        <div className="flex h-screen overflow-hidden">
          <Sidebar />

          <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-transparent">
            <Header />

            <main className="workspace-canvas flex-1 overflow-y-auto p-4 sm:p-8">
              {children}
            </main>
          </div>

          <CommandMenu />
          <AIChatbot />
        </div>
      </SidebarProvider>
    </UIProvider>
  );
}

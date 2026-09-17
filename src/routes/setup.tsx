import { createFileRoute, Outlet } from "@tanstack/react-router";
import { WizardTabs } from "@/components/WizardTabs";
import { AppFooter } from "@/components/AppFooter";


export const Route = createFileRoute("/setup")({
  component: SetupLayout,
});

function SetupLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <WizardTabs />
      <main className="flex-1 overflow-auto bg-surface">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <Outlet />
        </div>
      </main>
      <AppFooter variant="light" />
    </div>
  );
}



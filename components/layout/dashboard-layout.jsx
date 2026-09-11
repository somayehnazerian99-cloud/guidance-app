"use client";

import * as React from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";

function DashboardLayout({ children, user }) {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const role = user?.role;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        role={role}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          user={user}
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
        />

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

export { DashboardLayout };

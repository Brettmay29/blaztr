import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  LayoutDashboard,
  FlaskConical,
  Mail,
  FileText,
  Send,
  Menu,
  X,
  Rocket,
  Plug,
  User,
  LogOut,
  Settings,
  ChevronDown,
  FileSpreadsheet
} from "lucide-react";
import { cn } from "@/lib/utils";
import { base44 } from "@/api/base44Client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navItems = [
  { name: "Dashboard", page: "Dashboard", icon: LayoutDashboard },
  { name: "Campaigns", page: "Campaigns", icon: Send },
  { name: "Inbox", page: "Inbox", icon: Mail },
  { name: "Sequences", page: "Sequences", icon: FileText },
  { name: "Leads Database", page: "LeadsDatabase", icon: FileSpreadsheet },
  { name: "Analytics", page: "Analytics", icon: FlaskConical },
  { name: "Email Testing", page: "EmailTesting", icon: Mail },
  { name: "Templates", page: "Templates", icon: FileText },
  { name: "Gmail Accounts", page: "GmailAccounts", icon: Mail },

  { name: "Integrations", page: "Integrations", icon: Plug },
];

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-neutral-50 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:sticky top-0 left-0 z-50 h-screen w-60 bg-white border-r border-neutral-200 flex flex-col transition-transform duration-200 ease-out",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="h-14 flex items-center px-5 border-b border-neutral-100">
          <span className="text-sm font-semibold tracking-wide text-neutral-900">Blaztr</span>
          <button
            className="ml-auto lg:hidden text-neutral-400 hover:text-neutral-600"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-0.5">
          {navItems.map((item) => {
            const isActive = currentPageName === item.page;
            return (
              <Link
                key={item.page}
                to={createPageUrl(item.page)}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors",
                  isActive
                    ? "bg-neutral-900 text-white"
                    : "text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100"
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-neutral-100">
          <p className="text-[11px] text-neutral-400">v1.0 MVP</p>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-white border-b border-neutral-200 flex items-center px-4 lg:px-6 sticky top-0 z-30">
          <button
            className="lg:hidden mr-3 text-neutral-500 hover:text-neutral-800"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="text-sm font-medium text-neutral-800 capitalize">
            {currentPageName?.replace(/([A-Z])/g, ' $1').trim()}
          </h1>
          <div className="ml-auto flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-neutral-100 transition-colors">
                  <div className="w-7 h-7 rounded-full bg-neutral-900 flex items-center justify-center">
                    <span className="text-[11px] font-semibold text-white">
                      {user?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U"}
                    </span>
                  </div>
                  <div className="hidden sm:flex flex-col items-start">
                    <span className="text-[12px] font-medium text-neutral-800 leading-none">
                      {user?.full_name || "Account"}
                    </span>
                    <span className="text-[11px] text-neutral-400 leading-none mt-0.5">
                      {user?.email || ""}
                    </span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-neutral-400 hidden sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-0.5">
                    <p className="text-[13px] font-medium text-neutral-900">{user?.full_name || "User"}</p>
                    <p className="text-[11px] text-neutral-500 truncate">{user?.email || ""}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-[13px] cursor-pointer" onClick={() => {}}>
                  <User className="w-3.5 h-3.5 mr-2 text-neutral-500" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem className="text-[13px] cursor-pointer" onClick={() => {}}>
                  <Settings className="w-3.5 h-3.5 mr-2 text-neutral-500" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-[13px] cursor-pointer text-red-600 focus:text-red-600"
                  onClick={() => base44.auth.logout()}
                >
                  <LogOut className="w-3.5 h-3.5 mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <img
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69b02505f9b4d10dd348ac34/caa67dcfa_Screenshot2026-03-11at93645AM.png"
              alt="Blaztr"
              className="h-8 w-auto object-contain"
            />
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
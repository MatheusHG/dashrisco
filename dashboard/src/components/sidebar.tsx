"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { cn } from "@/lib/utils";
import {
  Bell,
  Users,
  Shield,
  FileText,
  Lock,
  LayoutDashboard,
  ListTodo,
  LogOut,
  BarChart3,
  Search,
  Sun,
  Moon,
  Monitor,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface NavItem {
  name: string;
  href: string;
  icon: typeof LayoutDashboard;
  permission: string | null;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: "Geral",
    items: [
      { name: "Dashboard", href: "/", icon: LayoutDashboard, permission: null },
    ],
  },
  {
    label: "Monitoramento",
    items: [
      { name: "Monitoramento", href: "/monitoring", icon: Monitor, permission: "panel:read" },
      { name: "Alertas", href: "/alerts", icon: Bell, permission: "alerts:read" },
      { name: "Painel de Alertas", href: "/panel/alerts", icon: FileText, permission: "panel:read" },
      { name: "Painel de Tasks", href: "/panel/tasks", icon: ListTodo, permission: "panel:read" },
    ],
  },
  {
    label: "Investigacao",
    items: [
      { name: "Buscar Cliente", href: "/clients", icon: Search, permission: "panel:read" },
      { name: "Relatorios", href: "/reports", icon: BarChart3, permission: "panel:read" },
    ],
  },
  {
    label: "Operacional",
    items: [
      { name: "Grupos de Bloqueio", href: "/groups", icon: Lock, permission: "groups:manage" },
    ],
  },
  {
    label: "Administracao",
    items: [
      { name: "Usuarios", href: "/users", icon: Users, permission: "users:manage" },
      { name: "Roles", href: "/roles", icon: Shield, permission: "roles:manage" },
      { name: "Logs", href: "/logs", icon: FileText, permission: "logs:read" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout, hasPermission } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [tooltip, setTooltip] = useState<{ text: string; top: number } | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("sidebar_collapsed");
    if (stored === "true") setCollapsed(true);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar_collapsed", String(next));
      return next;
    });
  };

  const filteredGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !item.permission || hasPermission(item.permission)
      ),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <div
      className={cn(
        "flex h-screen flex-col border-r border-border bg-sidebar-background transition-all duration-300",
        collapsed ? "w-[68px]" : "w-64"
      )}
    >
      {/* Logo + Toggle */}
      <div className="flex h-16 items-center border-b border-border px-3">
        {!collapsed && (
          <Link href="/" className="flex-1 flex justify-center">
            <Image src={theme === "dark" ? "/logo-risco-dark.png" : "/logo-risco.png"} alt="JBD Risco" width={120} height={40} className="h-20 w-auto object-contain" />
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-8 w-8 shrink-0", collapsed && "mx-auto")}
          onClick={toggleCollapsed}
          title={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4 text-sidebar-foreground" />
          ) : (
            <PanelLeftClose className="h-4 w-4 text-sidebar-foreground" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <nav className={cn("flex-1 overflow-y-auto py-4", collapsed ? "px-2 space-y-2" : "px-3 space-y-6")}>
        {filteredGroups.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </p>
            )}
            {collapsed && group.label !== "Geral" && (
              <div className="mx-2 mb-2 border-t border-border" />
            )}
            <div className="space-y-1">
              {group.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center rounded-lg transition-all duration-200",
                      collapsed
                        ? "justify-center px-0 py-2.5"
                        : "gap-3 px-3 py-2 text-sm font-medium",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                    onMouseEnter={(e) => {
                      if (!collapsed) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      setTooltip({ text: item.name, top: rect.top + rect.height / 2 });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  >
                    <item.icon className={cn("shrink-0", collapsed ? "h-5 w-5" : "h-4 w-4")} />
                    {!collapsed && <span className="truncate">{item.name}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User info */}
      <div className="border-t border-border p-3 space-y-2">
        {!collapsed && (
          <div className="mb-1 px-1">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {user?.name}
            </p>
            <p className="text-xs text-muted-foreground truncate">{user?.role}</p>
          </div>
        )}
        <div className={cn("flex", collapsed ? "flex-col items-center gap-2" : "gap-1")}>
          <Button
            variant="ghost"
            size={collapsed ? "icon" : "sm"}
            className={cn(collapsed ? "h-8 w-8" : "flex-1 justify-start gap-2")}
            onClick={logout}
            title={collapsed ? "Sair" : undefined}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && "Sair"}
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={toggleTheme}
            title={theme === "dark" ? "Modo claro" : "Modo escuro"}
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4 text-yellow-400" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Tooltip (fixed, rendered outside overflow containers) */}
      {collapsed && tooltip && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left: 76,
            top: tooltip.top,
            transform: "translateY(-50%)",
          }}
        >
          <div className="whitespace-nowrap rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-lg">
            {tooltip.text}
          </div>
        </div>
      )}
    </div>
  );
}

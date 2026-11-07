import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTheme } from "@/contexts/ThemeContext";
import { useIsMobile } from "@/hooks/useMobile";
import {
  BarChart3,
  Bell,
  Car,
  ClipboardList,
  LogOut,
  Package,
  PanelLeft,
  Settings,
  Users,
  Wallet,
  Wrench,
  Moon,
  Sun,
} from "lucide-react";
import { motion } from "framer-motion";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { LOGO_TRANSPARENT, LOGO_NORMAL } from "@/lib/brand";
import { trpc } from "@/lib/trpc";
import { LoginScreen } from "./LoginScreen";

const menuItems = [
  { icon: BarChart3, label: "Dashboard", path: "/" },
  { icon: Users, label: "Clientes", path: "/clientes" },
  { icon: Car, label: "Veículos", path: "/veiculos" },
  { icon: Wrench, label: "Ordens de Serviço", path: "/os" },
  { icon: Package, label: "Estoque", path: "/estoque" },
  { icon: Wallet, label: "Financeiro", path: "/financeiro" },
  { icon: ClipboardList, label: "Relatórios", path: "/relatorios" },
  { icon: Settings, label: "Configurações", path: "/config" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 264;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <SidebarProvider
      style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeMenuItem = menuItems.find((item) => item.path === location);
  const isMobile = useIsMobile();

  const { data: unreadNotifications } = trpc.notifications.unread.useQuery(undefined, {
    refetchInterval: 30_000,
  });
  const unreadCount = unreadNotifications?.length ?? 0;

  const utils = trpc.useUtils();
  const markAllRead = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => {
      utils.notifications.unread.invalidate();
      utils.notifications.list.invalidate();
    },
  });

  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= 200 && newWidth <= 420) setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0 bg-sidebar text-sidebar-foreground"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-sidebar-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Alternar navegação"
              >
                <PanelLeft className="h-4 w-4 text-sidebar-foreground/70" />
              </button>
              {!isCollapsed && (
                <motion.div
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.15 }}
                  className="flex items-center gap-2 min-w-0"
                >
                  <span className="rounded-lg bg-white px-1.5 py-0.5">
                    <img
                      src={LOGO_NORMAL}
                      alt="SGPO — Sistema de Gestão para Pequenas Oficinas"
                      className="h-7 object-contain"
                    />
                  </span>
                </motion.div>
              )}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            <SidebarMenu className="px-2 py-1">
              {menuItems.map((item) => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className="h-10 transition-all font-normal data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground data-[active=true]:shadow-sm"
                    >
                      <item.icon className={`h-4 w-4 shrink-0 ${isActive ? "text-sidebar-primary" : "text-sidebar-foreground/70"}`} />
                      <span>{item.label}</span>
                      {isActive && (
                        <motion.span
                          layoutId="sidebar-active"
                          className="ml-auto h-1.5 w-1.5 rounded-full bg-sidebar-primary"
                        />
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-sidebar-accent transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border shrink-0 bg-sidebar-accent text-sidebar-accent-foreground">
                    <AvatarFallback className="text-xs font-semibold bg-flame text-white">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">
                      {user?.name || "Usuário"}
                    </p>
                    <p className="text-xs text-sidebar-foreground/60 truncate mt-1.5">
                      {user?.role === "admin" ? "Administrador" : "Usuário"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem
                  onClick={() => setLocation("/config")}
                  className="cursor-pointer"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Configurações</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sair</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset className="relative">
        {/* Barra superior: hamburger + título (mobile) e sino/toggle (desktop) */}
        <div className="flex border-b h-14 items-center justify-between bg-background/95 px-2 lg:px-4 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="h-9 w-9 rounded-lg bg-background lg:hidden" />
            {isMobile && (
              <span className="tracking-tight font-semibold text-foreground">
                {activeMenuItem?.label ?? "SGPO"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <NotificationsButton unreadCount={unreadCount} onMarkAllRead={() => markAllRead.mutate()} />
          </div>
        </div>
        <main className="flex-1 p-4 lg:p-6 page-enter">{children}</main>
      </SidebarInset>
    </>
  );
}

function NotificationsButton({
  unreadCount,
  onMarkAllRead,
}: {
  unreadCount: number;
  onMarkAllRead: () => void;
}) {
  const { data: notifications } = trpc.notifications.list.useQuery(undefined, {
    refetchInterval: 30_000,
  });

  return (
    <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="relative h-10 w-10 rounded-lg bg-card border shadow-soft flex items-center justify-center hover:bg-accent transition-colors"
              aria-label="Notificações"
            >
              <Bell className="h-4.5 w-4.5 text-foreground/70" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-accent-foreground text-accent text-[10px] font-bold flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <div className="px-3 py-2 flex items-center justify-between">
              <span className="text-sm font-semibold">Notificações</span>
              {unreadCount > 0 && (
                <button
                  className="text-xs text-primary hover:underline"
                  onClick={onMarkAllRead}
                >
                  Marcar todas como lidas
                </button>
              )}
            </div>
            <DropdownMenuSeparator />
            {(notifications ?? []).length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                Nenhuma notificação
              </div>
            ) : (
              (notifications ?? []).slice(0, 8).map((n) => (
                <div key={n.id} className="px-3 py-2.5 hover:bg-accent/50 transition-colors">
                  <p className="text-sm font-medium leading-tight">{n.title}</p>
                  {n.message && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                  )}
                </div>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
  );
}

export function useUnreadNotificationCount() {
  const { data } = trpc.notifications.unread.useQuery(undefined, {
    refetchInterval: 30_000,
  });
  return data?.length ?? 0;
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={toggleTheme}
          className="h-10 w-10 rounded-lg bg-card border shadow-soft flex items-center justify-center hover:bg-accent transition-colors"
          aria-label={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4 text-amber-400" />
          ) : (
            <Moon className="h-4 w-4 text-foreground/70" />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="z-[60]">
        {theme === "dark" ? "Modo claro" : "Modo escuro"}
      </TooltipContent>
    </Tooltip>
  );
}

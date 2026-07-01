import {
    Ad,
    CalendarDays,
    MessageCircle,
    Bot,
    ExternalLink,
    LayoutDashboard,
    Settings,
    ShoppingCart,
    SquareKanban,
    UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type BadgeVariant =
    | "default"
    | "secondary"
    | "destructive"
    | "outline"
    | "ghost"
    | "link";

export interface MenuItem {
    name: string;
    href: string;
    icon?: LucideIcon;
    badge?: { variant?: BadgeVariant; text?: string; icon?: LucideIcon };
    submenu?: MenuItem[];
}

export default <MenuItem[]>[
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Quadros", href: "/boards", icon: SquareKanban },
    { name: "Calendário", href: "/calendar", icon: CalendarDays },
    {
        name: "Vendas",
        href: "/sales",
        icon: ShoppingCart,
        submenu: [
            { name: "Vendas REDICOM", href: "/sales/redicom" },
            { name: "Relatórios", href: "/sales/reports" },
        ],
    },
    {
        name: "Marketing",
        href: "/marketing",
        icon: Ad,
        submenu: [
            { name: "Despesas", href: "/marketing/expenses" },
            { name: "Relatórios", href: "/marketing/reports" },
        ],
    },
    {
        name: "Membros",
        href: "/members",
        icon: UsersRound,
        submenu: [{ name: "Todos os membros", href: "/members" }],
    },
    { name: "Chat", href: "/chat", icon: MessageCircle },
    { name: "IntraAI", href: "/chat-ai", icon: Bot, badge: { variant: "secondary", icon: ExternalLink } },
    { name: "Definições", href: "/settings", icon: Settings },
];

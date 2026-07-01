import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { CreateAlertDialog } from "@/components/create-alert-dialog";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/sidebar";
import { verifySession } from "@/lib/auth/session";
import type { SessionPayload } from "@/lib/auth/session-store";
import Config from "@/lib/config";
import {
  DatabaseConnectionError,
  warnIfDatabaseConnectionError,
} from "@/lib/utils/errors";
import { getTenantOptionsForUser, type TenantOption } from "@/services/tenants";

export const metadata: Metadata = {
  title: Config.APP_NAME + " • Dashboard",
  description: Config.APP_DESCRIPTION,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let session: SessionPayload | null = null;
  let databaseError: string | null = null;
  let tenants: TenantOption[] = [];

  try {
    session = await verifySession();
  } catch (error) {
    if (!warnIfDatabaseConnectionError(error)) {
      throw error;
    }
    databaseError = DatabaseConnectionError.defaultMessage;
  }

  if (session && !databaseError) {
    try {
      tenants = await getTenantOptionsForUser(session.userId, session.role);
    } catch (error) {
      if (!warnIfDatabaseConnectionError(error)) {
        throw error;
      }
      databaseError = DatabaseConnectionError.defaultMessage;
    }
  }

  const sidebarSession = session ?? {
    activeTenantId: null,
    email: "",
    name: Config.APP_NAME,
    role: "user",
    userId: 0,
  };

  return (
    <SidebarProvider>
      <AppSidebar
        sessionPromise={Promise.resolve(sidebarSession)}
        tenantsPromise={Promise.resolve(tenants)}
      />
      <SidebarInset className="min-w-0 overflow-hidden">
        <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-border bg-background/95 px-3 backdrop-blur md:hidden">
          <SidebarTrigger />
          <Link href="/" className="flex min-w-0 items-center gap-2">
            <span className="hidden truncate text-sm font-semibold sm:block">
              {Config.APP_NAME}
            </span>
            <Image
              src="/intranet_logo.png"
              alt=""
              width={28}
              height={28}
              className="size-7 shrink-0"
            />
          </Link>
        </header>
        <CreateAlertDialog
          error={databaseError}
          title="Nenhuma ligação à base de dados encontrada"
          minify
        />
        <div className="min-h-svh min-w-0 flex-1 overflow-auto">
          {databaseError ? null : children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

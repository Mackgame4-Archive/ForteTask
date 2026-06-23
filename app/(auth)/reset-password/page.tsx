"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useActionState } from "react";
import { KeyRound } from "lucide-react";

import { resetPassword } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function ResetPasswordForm() {
  const [state, action, pending] = useActionState(resetPassword, {});
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <Card className="relative w-full max-w-md border-primary/40 shadow-[0_0_24px_color-mix(in_oklch,var(--primary),transparent_55%),0_0_64px_color-mix(in_oklch,var(--primary),transparent_82%)] before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:bg-primary/20 before:blur-2xl">
        <form action={action}>
          <CardHeader>
            <CardTitle>Nova palavra-passe</CardTitle>
            <CardDescription>Defina uma nova palavra-passe para a sua conta.</CardDescription>
          </CardHeader>

          <CardContent className="my-5 space-y-4">
            <input type="hidden" name="token" value={token} />

            <div className="space-y-2">
              <Label htmlFor="password">Nova palavra-passe</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={6}
                required
              />
            </div>

            {state.error ? (
              <p className="text-sm text-destructive">{state.error}</p>
            ) : null}
            {state.success ? (
              <p className="text-sm text-muted-foreground">{state.success}</p>
            ) : null}
          </CardContent>

          <CardFooter className="flex-col gap-4">
            <Button type="submit" className="w-full" disabled={pending || !token}>
              <KeyRound className="me-2 h-4 w-4" />
              {pending ? "A atualizar..." : "Atualizar palavra-passe"}
            </Button>

            <Link href="/login" className="text-sm font-medium text-foreground">
              Entrar
            </Link>
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}

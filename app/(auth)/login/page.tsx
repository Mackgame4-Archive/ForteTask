"use client";

import Link from "next/link";
import { useActionState } from "react";

import { login } from "@/app/(auth)/actions";
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
import { LogIn } from "lucide-react";
import Config from "@/lib/config";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, {});

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <Card className="relative w-full max-w-sm border-primary/40 shadow-[0_0_24px_color-mix(in_oklch,var(--primary),transparent_55%),0_0_64px_color-mix(in_oklch,var(--primary),transparent_82%)] before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:bg-primary/20 before:blur-2xl">
        <form action={action}>
          <CardHeader>
            <CardTitle>Entrar</CardTitle>
            <CardDescription>Continuar para {Config.APP_NAME}.</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 my-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="password">Palavra-passe</Label>
                <Link href="/forgot-password" className="text-xs font-medium text-foreground">
                  Esqueceu-se?
                </Link>
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>

            {state.error ? (
              <p className="text-sm text-destructive">{state.error}</p>
            ) : null}
          </CardContent>

          <CardFooter className="flex-col gap-4">
            <Button type="submit" className="w-full" disabled={pending}>
              <LogIn className="me-2 h-4 w-4" />
              {pending ? "A entrar..." : "Entrar"}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Ainda não tem conta?{" "}
              <Link href="/signup" className="font-medium text-foreground">
                Criar conta
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}

"use client";

import Link from "next/link";
import { useActionState } from "react";

import { signup } from "@/app/(auth)/actions";
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
import { KeyRound } from "lucide-react";

export default function SignupPage() {
  const [state, action, pending] = useActionState(signup, {});

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <Card className="relative w-full max-w-md border-primary/40 shadow-[0_0_24px_color-mix(in_oklch,var(--primary),transparent_55%),0_0_64px_color-mix(in_oklch,var(--primary),transparent_82%)] before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:bg-primary/20 before:blur-2xl">
        <form action={action}>
          <CardHeader>
            <CardTitle>Criar conta</CardTitle>
            <CardDescription>Crie a sua conta.</CardDescription>
          </CardHeader>

          <CardContent className="grid gap-4 my-5">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" name="name" autoComplete="name" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="email" placeholder="example@email.com" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Palavra-passe</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                placeholder="Pelo menos 6 caracteres"
                required
                minLength={6}
              />
            </div>

            {state.error ? (
              <p className="text-sm text-destructive">{state.error}</p>
            ) : null}
          </CardContent>

          <CardFooter className="flex-col gap-4">
            <Button type="submit" className="w-full" disabled={pending}>
              <KeyRound className="me-2 h-4 w-4" />
              {pending ? "A criar conta..." : "Criar conta"}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Já tem conta?{" "}
              <Link href="/login" className="font-medium text-foreground">
                Entrar
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}

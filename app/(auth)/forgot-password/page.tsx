"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Mail } from "lucide-react";

import { requestPasswordReset } from "@/app/(auth)/actions";
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

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(requestPasswordReset, {});

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <Card className="relative w-full max-w-md border-primary/40 shadow-[0_0_24px_color-mix(in_oklch,var(--primary),transparent_55%),0_0_64px_color-mix(in_oklch,var(--primary),transparent_82%)] before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:bg-primary/20 before:blur-2xl">
        <form action={action}>
          <CardHeader>
            <CardTitle>Recuperar palavra-passe</CardTitle>
            <CardDescription>
              Introduza o email da conta para receber um link de recuperação.
            </CardDescription>
          </CardHeader>

          <CardContent className="my-5 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </div>

            {state.error ? (
              <p className="text-sm text-destructive">{state.error}</p>
            ) : null}
            {state.success ? (
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>{state.success}</p>
                {state.resetUrl ? (
                  <p>
                    Link de desenvolvimento:{" "}
                    <Link href={state.resetUrl} className="font-medium text-foreground">
                      abrir recuperação
                    </Link>
                  </p>
                ) : null}
              </div>
            ) : null}
          </CardContent>

          <CardFooter className="flex-col gap-4">
            <Button type="submit" className="w-full" disabled={pending}>
              <Mail className="me-2 h-4 w-4" />
              {pending ? "A enviar..." : "Enviar link"}
            </Button>

            <Link href="/login" className="text-sm font-medium text-foreground">
              Voltar ao login
            </Link>
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}

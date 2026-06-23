import { redirect } from "next/navigation";

import { deleteSession } from "@/lib/auth/session";

export async function GET() {
  await deleteSession();
  redirect("/login");
}

export async function POST() {
  await deleteSession();
  redirect("/login");
}

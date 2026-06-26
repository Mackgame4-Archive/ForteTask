import { redirect } from "next/navigation";

import { getChatPageData } from "@/services/chat";

// The standalone /chat index is gone — it now forwards to the first available
// conversation so the sidebar "Chat" link still lands somewhere useful.
export default async function ChatPage() {
  const { members } = await getChatPageData();

  if (members[0]) {
    redirect(`/chat/${members[0].id}`);
  }

  return (
    <main className="grid min-h-screen place-items-center bg-muted/40 px-4 text-center text-sm text-muted-foreground">
      Não existem conversas disponíveis.
    </main>
  );
}

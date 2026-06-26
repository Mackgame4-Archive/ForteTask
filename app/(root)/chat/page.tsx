import { ChatPanel } from "@/components/pages/chat/chat-panel";
import { getChatPageData } from "@/services/chat";

export default async function ChatPage() {
  const { members, session } = await getChatPageData();

  return (
    <main className="min-h-screen bg-muted/40">
      <ChatPanel
        members={members}
        roomScope="private"
        socketUrl={process.env.NEXT_PUBLIC_CHAT_SOCKET_URL}
        user={{
          id: session.userId,
          name: session.name,
          email: session.email,
        }}
      />
    </main>
  );
}

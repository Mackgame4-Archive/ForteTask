import type { ChatMessage } from "@/lib/utils/sockets";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { formatAppDate, parseDateValue } from "@/lib/utils/date";

type MessageBubbleProps = {
  message: ChatMessage;
  own?: boolean;
};

function getInitials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U"
  );
}

function MessageBubble({ message, own }: MessageBubbleProps) {
  const createdAt = parseDateValue(message.createdAt);

  return (
    <div
      className={cn(
        "flex w-full items-end gap-2",
        own ? "flex-row-reverse" : "flex-row"
      )}
    >
      <Avatar size="sm" className="mb-5">
        <AvatarFallback>{getInitials(message.authorName)}</AvatarFallback>
      </Avatar>
      <article
        className={cn(
          "flex max-w-[min(34rem,85%)] flex-col gap-1",
          own ? "items-end" : "items-start"
        )}
      >
        <div
          className={cn(
            "min-w-0 border px-3 py-2 text-sm shadow-sm",
            own
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card text-card-foreground"
          )}
        >
          <p className="whitespace-pre-wrap break-words leading-6">{message.body}</p>
        </div>
        <div
          className={cn(
            "flex max-w-full items-center gap-2 truncate text-[11px] text-muted-foreground",
            own && "flex-row-reverse"
          )}
        >
          <span className="truncate font-medium">
            {own ? "Você" : message.authorName}
          </span>
          {createdAt ? <span>{formatAppDate(createdAt, "HH:mm")}</span> : null}
        </div>
      </article>
    </div>
  );
}

export { MessageBubble };

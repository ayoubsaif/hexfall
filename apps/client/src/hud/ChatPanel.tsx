// In-game chat, the third tab of the log drawer (openspec change in-game-chat). Lines come from
// the server (kept in memory only); your own are right-aligned. Built on the shadcn Message and
// Bubble components.
import { CHAT_MAX_LENGTH } from "@hexfall/protocol";
import { type FormEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button.tsx";
import { Bubble, BubbleContent } from "@/components/ui/bubble.tsx";
import { Input } from "@/components/ui/input.tsx";
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageGroup,
  MessageHeader,
} from "@/components/ui/message.tsx";
import { sendChat } from "../net/actions.ts";
import { markChatRead, useChatStore } from "../store/chat.ts";
import { useConnectionStore } from "../store/connection.ts";
import { useRoomStore } from "../store/room.ts";
import { SeatAvatar } from "./Avatar.tsx";

/** Pixels from the bottom that still count as "at the newest line". */
const STICK_PX = 24;

/** Mount while seated. Mounted means visible, so everything received here counts as read. */
export function ChatPanel() {
  const { t } = useTranslation();
  const entries = useChatStore((s) => s.entries);
  const mine = useRoomStore((s) => s.seat);
  const online = useConnectionStore((s) => s.status === "open");
  const [text, setText] = useState("");
  const list = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  useEffect(() => {
    markChatRead();
  }, [entries]);
  useLayoutEffect(() => {
    const el = list.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [entries]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const line = text.trim();
    if (line.length === 0) return;
    if (sendChat(line)) {
      setText("");
      stick.current = true;
    }
  };

  return (
    <section
      aria-label={t("dialogs.feed.tabChat")}
      data-testid="chat"
      className="flex max-h-full min-h-0 flex-1 flex-col gap-2"
    >
      <div
        ref={list}
        role="log"
        aria-live="polite"
        className="min-h-0 flex-1 overflow-y-auto px-1 py-1"
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight <= STICK_PX;
        }}
      >
        {entries.length === 0 ? (
          <p data-testid="chat-empty" className="m-0 px-1.5 py-1 text-muted-foreground">
            {t("dialogs.chat.empty")}
          </p>
        ) : (
          <MessageGroup>
            {entries.map((entry) => {
              const own = entry.seat === mine;
              return (
                <Message key={entry.id} align={own ? "end" : "start"} data-testid="chat-line">
                  <MessageAvatar>
                    <SeatAvatar seat={entry.seat} size="sm" />
                  </MessageAvatar>
                  <MessageContent>
                    {!own && <MessageHeader>{entry.name}</MessageHeader>}
                    <Bubble>
                      <BubbleContent>{entry.text}</BubbleContent>
                    </Bubble>
                  </MessageContent>
                </Message>
              );
            })}
          </MessageGroup>
        )}
      </div>
      <form onSubmit={submit} className="flex shrink-0 gap-2" data-testid="chat-form">
        <Input
          value={text}
          onChange={(e) => setText(e.currentTarget.value)}
          maxLength={CHAT_MAX_LENGTH}
          placeholder={t("dialogs.chat.placeholder")}
          aria-label={t("dialogs.chat.placeholder")}
          autoComplete="off"
          enterKeyHint="send"
          data-testid="chat-input"
          // Typing must never trigger board hotkeys.
          onKeyDown={(e) => e.stopPropagation()}
        />
        <Button type="submit" disabled={!online || text.trim().length === 0}>
          {t("dialogs.chat.send")}
        </Button>
      </form>
    </section>
  );
}

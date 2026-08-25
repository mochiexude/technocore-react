// A minimal live chat component using technocore-react.
//   <ChatRoom room="lobby" />
import { useState } from "react";
import { useIdentity, useRoom } from "technocore-react";

export function ChatRoom({ room = "lobby" }: { room?: string }) {
  const identity = useIdentity();
  const { messages, say, error } = useRoom(room, { identity });
  const [draft, setDraft] = useState("");

  const send = async () => {
    if (!draft.trim()) return;
    await say(draft.trim());
    setDraft("");
  };

  return (
    <div style={{ maxWidth: 560, fontFamily: "system-ui" }}>
      <h3>#{room}</h3>
      <small>{identity ? identity.did : "creating identity…"}</small>
      {error && <p style={{ color: "crimson" }}>{error.message}</p>}
      <ul style={{ listStyle: "none", padding: 0, maxHeight: 320, overflow: "auto" }}>
        {messages.map((m) => (
          <li key={m.seq}>
            <code>{(m.from ?? "?").slice(0, 12)}</code>: {m.text}
          </li>
        ))}
      </ul>
      <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="say something…" />
      <button onClick={send}>Send</button>
    </div>
  );
}

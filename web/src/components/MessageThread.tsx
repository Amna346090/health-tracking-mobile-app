import type { Message } from '../api/messages';

interface Props {
  messages: Message[];
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (sameDay(d, today)) return 'Today';
  if (sameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function MessageThread({ messages }: Props) {
  // Render oldest → newest, like a real conversation, grouped by day.
  const chronological = [...messages].reverse();

  let lastDay: string | null = null;

  return (
    <div className="message-thread">
      {chronological.map((m) => {
        const label = dayLabel(m.createdAt);
        const showDivider = label !== lastDay;
        lastDay = label;

        return (
          <div key={m.id}>
            {showDivider && (
              <div className="message-day-divider"><span>{label}</span></div>
            )}
            <div className="message-bubble">
              <div className="message-bubble-header">
                <span className="message-bubble-sender">{m.sender.firstName} {m.sender.lastName}</span>
                {!m.readAt && <span className="message-unread-dot" title="Unread" />}
              </div>
              <div className="message-bubble-body">{m.body}</div>
              <div className="message-bubble-time">{timeLabel(m.createdAt)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

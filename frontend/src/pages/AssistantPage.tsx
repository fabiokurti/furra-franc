import React, { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Bot, Send, User, Loader2, Sparkles, Plus, MessageSquare, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';

type Msg = { role: 'user' | 'assistant'; content: string };
type Chat = { id: string; title: string; messages: Msg[]; createdAt: number };

const STORAGE_KEY = 'furra-ai-chats';
const NEW_TITLE = 'Bisedë e re';

const SUGGESTIONS = [
  'Sa është diferenca e bukëve të prodhuara të dielën e kaluar nga kjo e diel?',
  'Më bëj një raport javor të shitjeve.',
  'Cili është produkti më i shitur?',
  'Krahaso prodhimin me shitjet javë pas jave.',
];

// crypto.randomUUID() only exists in secure contexts (HTTPS/localhost), so we
// fall back to a simple unique id for plain-http access (e.g. on a tablet).
function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function newChat(): Chat {
  return { id: uid(), title: NEW_TITLE, messages: [], createdAt: Date.now() };
}

function loadChats(): Chat[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Chat[];
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch {
    /* ignore corrupt storage */
  }
  return [newChat()];
}

export function AssistantPage() {
  const { user } = useAuth();
  const [chats, setChats] = useState<Chat[]>(loadChats);
  const [activeId, setActiveId] = useState<string>(() => chats[0].id);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeChat = chats.find((c) => c.id === activeId) ?? chats[0];
  const messages = activeChat?.messages ?? [];

  // Persist to localStorage whenever chats change.
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
  }, [chats]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  function createChat() {
    const chat = newChat();
    setChats((prev) => [chat, ...prev]);
    setActiveId(chat.id);
    setError(null);
    setListOpen(false);
  }

  function selectChat(id: string) {
    setActiveId(id);
    setError(null);
    setListOpen(false);
  }

  function deleteChat(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setChats((prev) => {
      const remaining = prev.filter((c) => c.id !== id);
      const next = remaining.length ? remaining : [newChat()];
      if (id === activeId) setActiveId(next[0].id);
      return next;
    });
  }

  async function send(text: string) {
    const question = text.trim();
    if (!question || loading) return;

    setError(null);
    const chatId = activeChat.id;
    const history = messages.slice(-10);

    // Append the user message (and set title from first message).
    setChats((prev) =>
      prev.map((c) =>
        c.id === chatId
          ? {
              ...c,
              title: c.title === NEW_TITLE ? question.slice(0, 40) : c.title,
              messages: [...c.messages, { role: 'user', content: question }],
            }
          : c
      )
    );
    setInput('');
    setLoading(true);

    try {
      const { data } = await api.post('/ai/chat', { message: question, history });
      setChats((prev) =>
        prev.map((c) =>
          c.id === chatId ? { ...c, messages: [...c.messages, { role: 'assistant', content: data.answer }] } : c
        )
      );
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ndodhi një gabim. Provo përsëri.');
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    send(input);
  }

  const ChatList = (
    <div className="flex flex-col h-full">
      <Button onClick={createChat} className="gap-2 m-3 mb-2">
        <Plus className="h-4 w-4" />
        Bisedë e re
      </Button>
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
        {chats.map((c) => (
          <div
            key={c.id}
            onClick={() => selectChat(c.id)}
            className={`group flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors ${
              c.id === activeId ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
            }`}
          >
            <MessageSquare className="h-4 w-4 shrink-0" />
            <span className="flex-1 truncate">{c.title}</span>
            <button
              onClick={(e) => deleteChat(c.id, e)}
              className={`shrink-0 p-1 -m-1 opacity-70 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity ${
                c.id === activeId ? 'hover:text-primary-foreground/70' : 'hover:text-destructive'
              }`}
              title="Fshi bisedën"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  // Manager-only: delivery (STAFF) and shop (BUSINESS) accounts are redirected.
  // (The backend also enforces this — the endpoint is admin-only.)
  if (user && user.role !== 'ADMIN') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex gap-4 h-[calc(100dvh-6rem)] lg:h-[calc(100dvh-3.5rem)]">
      {/* Chat list — desktop/large tablets */}
      <Card className="hidden lg:flex w-64 shrink-0 overflow-hidden">{ChatList}</Card>

      {/* Chat list — mobile & tablet drawer */}
      {listOpen && (
        <div className="lg:hidden fixed inset-0 z-40" onClick={() => setListOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <Card
            className="absolute left-0 top-0 h-full w-72 max-w-[85vw] rounded-none overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {ChatList}
          </Card>
        </div>
      )}

      {/* Chat area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
          <Button
            variant="outline"
            size="icon"
            className="lg:hidden shrink-0"
            onClick={() => setListOpen(true)}
            title="Bisedat"
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
          <div className="hidden sm:flex h-10 w-10 items-center justify-center rounded-lg bg-primary shrink-0">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-xl font-bold leading-none truncate">
              {activeChat?.title && activeChat.title !== NEW_TITLE ? activeChat.title : 'Asistenti AI'}
            </h1>
            <p className="hidden sm:block text-sm text-muted-foreground mt-1 truncate">Financieri i furrës — pyet për shitjet, prodhimin dhe raportet</p>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="lg:hidden shrink-0"
            onClick={createChat}
            title="Bisedë e re"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Messages */}
        <Card className="flex-1 overflow-hidden flex flex-col">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center gap-4 py-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent">
                  <Bot className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">Si mund të të ndihmoj?</p>
                  <p className="text-sm text-muted-foreground">Zgjidh një pyetje ose shkruaj tënden.</p>
                </div>
                <div className="grid gap-2 w-full max-w-md">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="text-left text-sm rounded-lg border px-3 py-2 hover:bg-accent transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'assistant' && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary">
                    <Bot className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] sm:max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap break-words overflow-x-auto ${
                    m.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                      : 'bg-accent text-accent-foreground rounded-bl-sm'
                  }`}
                >
                  {m.content}
                </div>
                {m.role === 'user' && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-3 justify-start">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary">
                  <Bot className="h-4 w-4 text-primary-foreground" />
                </div>
                <div className="rounded-2xl rounded-bl-sm bg-accent px-4 py-2.5">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}

            {error && <p className="text-sm text-destructive text-center">{error}</p>}
          </div>

          {/* Input */}
          <form onSubmit={onSubmit} className="border-t p-3 flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Shkruaj pyetjen tënde..."
              className="flex-1 min-w-0 rounded-lg border bg-background px-3 py-2 text-base sm:text-sm outline-none focus:ring-2 focus:ring-ring"
              disabled={loading}
            />
            <Button type="submit" size="icon" className="shrink-0" disabled={loading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

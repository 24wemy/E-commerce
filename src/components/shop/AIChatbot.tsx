'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Bot, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export function AIChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userText = input.trim();
    setInput('');

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userText,
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok) {
        throw new Error('Layanan AI sedang tidak dapat diakses.');
      }

      const data = await response.json().catch(() => ({
        text: 'Maaf, saat ini layanan AI Assistant sedang bermasalah atau tidak aktif. Silakan hubungi customer service kami atau coba beberapa saat lagi.',
      }));

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content:
          data.text ||
          'Maaf, saat ini layanan AI Assistant sedang bermasalah atau tidak aktif. Silakan hubungi customer service kami atau coba beberapa saat lagi.',
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (error: unknown) {
      console.error('Chat Error:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'assistant',
          content:
            'Maaf, saat ini layanan AI Assistant sedang bermasalah atau tidak aktif. Silakan hubungi customer service kami atau coba beberapa saat lagi.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {!isOpen && (
        <Button onClick={() => setIsOpen(true)} className="rounded-full h-14 w-14 shadow-lg p-0">
          <MessageSquare className="h-6 w-6" />
        </Button>
      )}

      {isOpen && (
        <Card className="w-[360px] sm:w-[400px] h-[520px] shadow-2xl flex flex-col border-primary/20 bg-white">
          <CardHeader className="py-3 px-4 flex flex-row items-center justify-between border-b bg-primary text-primary-foreground">
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="h-5 w-5" /> Store Assistant
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="text-primary-foreground hover:bg-primary/80 h-8 w-8"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>

          <CardContent ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <p className="text-sm text-muted-foreground text-center mt-12">
                Halo! Ada yang bisa saya bantu tentang produk roti, harga, atau status pesanan Anda?
              </p>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-2 text-sm ${
                  m.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {m.role !== 'user' && <Bot className="h-5 w-5 text-primary mt-1 shrink-0" />}
                <div
                  className={`rounded-lg px-3 py-2 max-w-[80%] whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  {m.content}
                </div>
                {m.role === 'user' && <User className="h-5 w-5 text-muted-foreground mt-1 shrink-0" />}
              </div>
            ))}
            {isLoading && (
              <div className="text-xs text-muted-foreground animate-pulse">Mengetik...</div>
            )}
          </CardContent>

          <CardFooter className="p-3 border-t">
            <form onSubmit={handleSubmit} className="flex gap-2 w-full">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Tanyakan produk, harga, pesanan..."
                className="text-sm"
              />
              <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}

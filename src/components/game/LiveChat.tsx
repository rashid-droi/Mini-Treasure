"use client";

import { useEffect, useState, useRef } from "react";
import { Send, MessageCircle } from "lucide-react";
import { useSocket } from "@/components/SocketProvider";

export interface ChatMessage {
  id: string;
  message: string;
  senderId: string;
  sender?: { id?: string; username?: string };
}

export default function LiveChat({
  teamId,
  userId,
  initialMessages = []
}: {
  teamId: string;
  userId: string;
  initialMessages?: ChatMessage[];
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (chatData: ChatMessage) => {
      setMessages(prev => {
        if (prev.find(c => c.id === chatData.id)) return prev;
        return [...prev, chatData];
      });
    };

    socket.on("new_message", handleNewMessage);

    return () => {
      socket.off("new_message", handleNewMessage);
    };
  }, [socket, teamId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !socket) return;

    const message = chatInput.trim();
    setChatInput("");

    const tempId = Date.now().toString();
    setMessages(prev => [
      ...prev,
      { id: tempId, message, sender: { username: "You" }, senderId: userId }
    ]);

    socket.emit("send_message", {
      teamId,
      participantId: userId,
      content: message
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-zinc-500 text-center text-sm h-full flex flex-col items-center justify-center space-y-2">
            <MessageCircle className="w-8 h-8 opacity-20" />
            <p>No messages yet.<br/>Say hello to your team!</p>
          </div>
        ) : (
          messages.map(msg => {
            const isMe = msg.senderId === userId;
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                <span className="text-[10px] text-zinc-500 mb-0.5 px-1 uppercase tracking-wider">{isMe ? "You" : msg.sender?.username}</span>
                <div className={`px-3 py-2 rounded-2xl max-w-[85%] text-sm shadow-sm ${
                  isMe
                    ? "bg-[#f5c518] text-zinc-900 rounded-br-sm"
                    : "bg-zinc-100 text-zinc-800 rounded-bl-sm border border-zinc-200"
                }`}>
                  {msg.message}
                </div>
              </div>
            );
          })
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input Area */}
      <form onSubmit={handleSendMessage} className="p-3 bg-zinc-50 border-t border-zinc-200 flex gap-2">
        <input
          type="text"
          value={chatInput}
          onChange={e => setChatInput(e.target.value)}
          placeholder="Message..."
          className="flex-1 bg-white border border-zinc-300 rounded-xl px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-[#f5c518]"
        />
        <button
          type="submit"
          disabled={!chatInput.trim()}
          className="p-2 bg-[#f5c518] hover:bg-[#e6b800] disabled:opacity-50 text-zinc-900 rounded-xl transition-colors"
          aria-label="Send message"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare } from 'lucide-react';
import type { ChatMessage } from '../hooks/useP2P';

interface ChatConsoleProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  myPeerId: string;
}

export const ChatConsole: React.FC<ChatConsoleProps> = ({ messages, onSendMessage, myPeerId }) => {
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText);
    setInputText('');
  };

  return (
    <div className="terminal-window" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div className="terminal-header">
        <div className="terminal-title">
          <MessageSquare size={14} className="cyber-glow-cyan" />
          <span>ROOM_ENCRYPTED_FEED</span>
        </div>
        <div className="terminal-actions">
          <span className="terminal-dot active" style={{ backgroundColor: 'var(--color-cyan-glow)', boxShadow: '0 0 6px var(--color-cyan-glow)' }}></span>
        </div>
      </div>
      
      <div ref={scrollRef} className="terminal-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div className="chat-messages">
          {messages.map((msg) => {
            if (msg.isSystem) {
              return (
                <div key={msg.id} className="chat-system-msg">
                  {msg.text}
                </div>
              );
            }

            const isMe = msg.senderId === myPeerId;
            return (
              <div key={msg.id} className={`chat-bubble ${isMe ? 'outgoing' : 'incoming'}`}>
                <div className="chat-meta">
                  {isMe ? 'YOU' : msg.senderName} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
                <div className="chat-body">
                  {msg.text}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <form onSubmit={handleSend} className="chat-input-area" style={{ padding: '10px', background: 'rgba(0,0,0,0.5)' }}>
        <input
          type="text"
          className="hacker-input"
          style={{ flex: 1, fontSize: '14px', padding: '8px 12px' }}
          placeholder="Transmit signal..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
        />
        <button type="submit" className="hacker-btn btn-cyan" style={{ padding: '8px 14px' }}>
          <Send size={14} />
        </button>
      </form>
    </div>
  );
};

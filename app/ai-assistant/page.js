'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send,
  Bot,
  User,
  Trash2,
  Zap,
  Database,
  Shield,
  Camera,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import AIResponseRenderer from './AIResponseRenderer';
import styles from './page.module.css';

/* ---------- Helpers ---------- */

function formatTime(date) {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/* ---------- Suggested Questions ---------- */
const SUGGESTIONS = [
  'How many unresolved incidents do we have right now?',
  'Which safety zones have active breaches?',
  'Show me the most critical incidents today',
  'What is the current compliance score?',
  'Are there any unauthorized access incidents?',
  'Which cameras are currently offline?',
  'Give me a safety summary for today',
  'Who are the employees involved in recent incidents?',
];

/* ============================================================
   AI Assistant Page
   ============================================================ */
export default function AIAssistantPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [dbContext, setDbContext] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const sendMessage = useCallback(async (text) => {
    const userMessage = text || input.trim();
    if (!userMessage || loading) return;

    const userMsg = {
      id: Date.now(),
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      // Build history for context
      const history = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          history,
        }),
      });

      const data = await res.json();

      const assistantMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        content: data.response || 'Sorry, I could not generate a response.',
        timestamp: new Date(),
        responseTime: data.responseTime,
        error: data.error || null,
      };

      setMessages((prev) => [...prev, assistantMsg]);

      if (data.dbContext) {
        setDbContext(data.dbContext);
      }
    } catch (err) {
      console.error('Chat error:', err);
      const errorMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        content: 'Sorry, I encountered a connection error. Please check your network and try again.',
        timestamp: new Date(),
        error: 'network_error',
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
      // Re-focus input
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [input, loading, messages]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  const handleSuggestion = useCallback((text) => {
    sendMessage(text);
  }, [sendMessage]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setDbContext(null);
    inputRef.current?.focus();
  }, []);

  // Auto-resize textarea
  const handleInputChange = useCallback((e) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }, []);

  return (
    <div className={styles.page}>
      {/* Page Header */}
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.aiIcon}>
            <Bot size={22} />
          </div>
          <div className={styles.headerInfo}>
            <h1 className={styles.pageTitle}>AI Assistant</h1>
            <div className={styles.pageSubtitle}>
              Full database access
              <span className={styles.modelBadge}>
                <Zap size={8} />
                Claude
              </span>
            </div>
          </div>
        </div>
        {messages.length > 0 && (
          <button className={styles.clearBtn} onClick={clearChat}>
            <Trash2 size={12} />
            Clear Chat
          </button>
        )}
      </div>

      {/* Chat Container */}
      <div className={styles.chatContainer}>
        {/* Messages */}
        <div className={styles.messagesArea}>
          {messages.length === 0 && !loading ? (
            /* Welcome State */
            <div className={styles.welcomeState}>
              <div className={styles.welcomeIcon}>
                <Bot size={28} />
              </div>
              <div className={styles.welcomeTitle}>
                National Beef AI Assistant
              </div>
              <div className={styles.welcomeDesc}>
                I have full access to your facility database — incidents, safety zones, 
                cameras, alerts, employees, and production lines. Ask me anything.
              </div>
              <div className={styles.suggestionsGrid}>
                {SUGGESTIONS.slice(0, 6).map((s) => (
                  <button
                    key={s}
                    className={styles.suggestionBtn}
                    onClick={() => handleSuggestion(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`${styles.message} ${
                    msg.role === 'user' ? styles.messageUser : styles.messageAssistant
                  }`}
                >
                  <div
                    className={`${styles.messageAvatar} ${
                      msg.role === 'user' ? styles.avatarUser : styles.avatarAssistant
                    }`}
                  >
                    {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                  </div>
                  <div>
                    <div
                      className={`${styles.messageBubble} ${
                        msg.role === 'user'
                          ? styles.bubbleUser
                          : msg.error
                          ? `${styles.bubbleAssistant} ${styles.errorBubble}`
                          : styles.bubbleAssistant
                      }`}
                    >
                      {msg.role === 'assistant' ? (
                        <AIResponseRenderer content={msg.content} />
                      ) : (
                        msg.content
                      )}
                    </div>
                    <div
                      className={`${styles.messageMeta} ${
                        msg.role === 'user' ? styles.messageMetaUser : ''
                      }`}
                    >
                      <span>{formatTime(msg.timestamp)}</span>
                      {msg.responseTime && (
                        <span className={styles.responseTime}>
                          <Clock size={8} />
                          {(msg.responseTime / 1000).toFixed(1)}s
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* Thinking indicator */}
              {loading && (
                <div className={styles.thinkingMessage}>
                  <div className={`${styles.messageAvatar} ${styles.avatarAssistant}`}>
                    <Bot size={16} />
                  </div>
                  <div className={styles.thinkingBubble}>
                    <div className={styles.thinkingDots}>
                      <div className={styles.thinkingDot} />
                      <div className={styles.thinkingDot} />
                      <div className={styles.thinkingDot} />
                    </div>
                    Querying database & thinking…
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Context Bar */}
        {dbContext && (
          <div className={styles.contextBar}>
            <span className={styles.contextItem}>
              <span className={styles.contextDot} />
              DB Connected
            </span>
            <span className={styles.contextItem}>
              <Shield size={9} />
              {dbContext.zoneCount} zones
            </span>
            <span className={styles.contextItem}>
              <AlertTriangle size={9} />
              {dbContext.incidentCount} incidents
            </span>
            <span className={styles.contextItem}>
              <Camera size={9} />
              {dbContext.cameraCount} cameras
            </span>
            <span className={styles.contextItem}>
              <Database size={9} />
              {dbContext.alertCount} alerts
            </span>
          </div>
        )}

        {/* Input Area */}
        <div className={styles.inputArea}>
          <div className={styles.inputWrapper}>
            <textarea
              ref={inputRef}
              className={styles.chatInput}
              placeholder="Ask about incidents, safety zones, cameras, employees..."
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={loading}
            />
          </div>
          <button
            className={styles.sendBtn}
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            aria-label="Send message"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

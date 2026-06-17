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
  Copy,
  Check,
  Sparkles,
  Activity,
  Users,
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

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/* ---------- Suggested Questions ---------- */
const SUGGESTIONS = [
  {
    icon: AlertTriangle,
    title: 'Unresolved incidents',
    question: 'How many unresolved incidents do we have right now?',
    desc: 'View all open and investigating incidents across the facility',
  },
  {
    icon: Shield,
    title: 'Safety zone breaches',
    question: 'Which safety zones have active breaches?',
    desc: 'Check real-time breach status for all monitored zones',
  },
  {
    icon: Activity,
    title: 'Today\'s critical alerts',
    question: 'Show me the most critical incidents today',
    desc: 'Review high-priority incidents requiring immediate attention',
  },
  {
    icon: Camera,
    title: 'Camera status',
    question: 'Which cameras are currently offline?',
    desc: 'Monitor connectivity and health of surveillance cameras',
  },
];

/* ---------- Capability Pills ---------- */
const CAPABILITIES = [
  { icon: AlertTriangle, label: 'Incidents' },
  { icon: Shield, label: 'Safety Zones' },
  { icon: Camera, label: 'Cameras' },
  { icon: Users, label: 'Employees' },
  { icon: Activity, label: 'Alerts' },
  { icon: Database, label: 'Production Lines' },
];

/* ---------- Thinking State Labels ---------- */
const THINKING_LABELS = [
  'Analyzing your query…',
  'Querying database…',
  'Processing results…',
  'Generating response…',
];

/* ============================================================
   AI Assistant Page
   ============================================================ */
export default function AIAssistantPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [dbContext, setDbContext] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [thinkingLabelIdx, setThinkingLabelIdx] = useState(0);
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

  // Cycle thinking labels
  useEffect(() => {
    if (!loading) {
      setThinkingLabelIdx(0);
      return;
    }
    const interval = setInterval(() => {
      setThinkingLabelIdx((prev) => (prev + 1) % THINKING_LABELS.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [loading]);

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

  const copyMessage = useCallback(async (msg) => {
    try {
      await navigator.clipboard.writeText(msg.content);
      setCopiedId(msg.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Clipboard API not available
    }
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
            <div className={styles.statusDot} />
          </div>
          <div className={styles.headerInfo}>
            <h1 className={styles.pageTitle}>AI Assistant</h1>
            <div className={styles.pageSubtitle}>
              Full database access
              <span className={styles.modelBadge}>
                <Sparkles size={9} />
                Claude
              </span>
            </div>
          </div>
        </div>
        {messages.length > 0 && (
          <button className={styles.clearBtn} onClick={clearChat}>
            <Trash2 size={12} />
            Clear Chat
            <span className={styles.clearBtnShortcut}>⌘K</span>
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
                <Sparkles size={28} />
              </div>
              <div className={styles.welcomeGreeting}>{getGreeting()}</div>
              <div className={styles.welcomeTitle}>
                How can I help you today?
              </div>
              <div className={styles.welcomeDesc}>
                I have full access to your facility database — incidents, safety zones, 
                cameras, alerts, employees, and production lines. Ask me anything.
              </div>
              <div className={styles.capabilityPills}>
                {CAPABILITIES.map((cap) => (
                  <span key={cap.label} className={styles.capabilityPill}>
                    <cap.icon size={12} />
                    {cap.label}
                  </span>
                ))}
              </div>
              <div className={styles.suggestionsGrid}>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.question}
                    className={styles.suggestionCard}
                    onClick={() => handleSuggestion(s.question)}
                  >
                    <div className={styles.suggestionCardIcon}>
                      <s.icon size={16} />
                    </div>
                    <div className={styles.suggestionCardContent}>
                      <div className={styles.suggestionCardTitle}>{s.title}</div>
                      <div className={styles.suggestionCardDesc}>{s.desc}</div>
                    </div>
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
                  {msg.role === 'user' ? (
                    /* User message */
                    <>
                      <div className={`${styles.messageAvatar} ${styles.avatarUser}`}>
                        <User size={14} />
                      </div>
                      <div>
                        <div className={`${styles.messageBubble} ${styles.bubbleUser}`}>
                          {msg.content}
                        </div>
                        <div className={`${styles.messageMeta} ${styles.messageMetaUser}`}>
                          <span>{formatTime(msg.timestamp)}</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    /* Assistant message */
                    <>
                      <div className={styles.assistantLabel}>
                        <span className={styles.assistantLabelIcon}>
                          <Sparkles size={10} />
                        </span>
                        AI Assistant
                      </div>
                      <div
                        className={`${styles.messageBubble} ${
                          msg.error
                            ? `${styles.bubbleAssistant} ${styles.errorBubble}`
                            : styles.bubbleAssistant
                        }`}
                      >
                        <AIResponseRenderer content={msg.content} />
                      </div>
                      <div className={styles.messageMeta}>
                        <span>{formatTime(msg.timestamp)}</span>
                        {msg.responseTime && (
                          <span className={styles.responseTime}>
                            <Clock size={8} />
                            {(msg.responseTime / 1000).toFixed(1)}s
                          </span>
                        )}
                      </div>
                      <div className={styles.messageActions}>
                        <button
                          className={`${styles.copyBtn} ${copiedId === msg.id ? styles.copied : ''}`}
                          onClick={() => copyMessage(msg)}
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check size={10} />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy size={10} />
                              Copy
                            </>
                          )}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}

              {/* Thinking indicator */}
              {loading && (
                <div className={styles.thinkingMessage}>
                  <div className={styles.assistantLabel}>
                    <span className={styles.assistantLabelIcon}>
                      <Sparkles size={10} />
                    </span>
                    AI Assistant
                  </div>
                  <div className={styles.thinkingBubble}>
                    <div className={styles.thinkingHeader}>
                      <div className={styles.thinkingDots}>
                        <div className={styles.thinkingDot} />
                        <div className={styles.thinkingDot} />
                        <div className={styles.thinkingDot} />
                      </div>
                      <div className={styles.thinkingLabel} key={thinkingLabelIdx}>
                        {THINKING_LABELS[thinkingLabelIdx]}
                      </div>
                    </div>
                    <div className={styles.thinkingLines}>
                      <div className={styles.thinkingLine} />
                      <div className={styles.thinkingLine} />
                      <div className={styles.thinkingLine} />
                    </div>
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

        {/* Input Area — Floating */}
        <div className={styles.inputArea}>
          <div className={styles.inputContainer}>
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
            <button
              className={`${styles.sendBtn} ${input.trim() ? styles.sendBtnActive : ''}`}
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              aria-label="Send message"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

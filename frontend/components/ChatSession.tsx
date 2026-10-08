import React, { useState, useEffect, useCallback } from 'react';
import { AnalysisResult, SessionType, Answer } from '../types.ts';
import { aiService } from '../services/geminiService.ts';
import { chatMemoryService, ChatMessage } from '../services/chatMemoryService.ts';
import { sessionService } from '../services/session.service.ts';
import { authService } from '../services/auth.service.ts';

interface Props {
  result: AnalysisResult;
  answers: Answer[];
  sessionType: SessionType;
  sessionId?: string;
}

const ChatSession: React.FC<Props> = ({ result, answers, sessionType, sessionId }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatInitialized, setChatInitialized] = useState(false);
  const [memoryStats, setMemoryStats] = useState({ messageCount: 0, tokenCount: 0, hasSummary: false });
  const currentUser = authService.getCurrentUser();

  useEffect(() => {
    if (sessionId && currentUser) {
      initializeChat();
      loadMemoryStats();
    }
  }, [sessionId, currentUser, result, answers, sessionType]);

  const loadMemoryStats = () => {
    if (sessionId && currentUser) {
      const stats = chatMemoryService.getMemoryStats(currentUser.id, sessionId);
      setMemoryStats(stats);
    }
  };

  const initializeChat = () => {
    if (!sessionId || !currentUser) return;

    // Get or create chat memory
    const memory = chatMemoryService.getOrCreateMemory(
      currentUser.id, 
      sessionId, 
      sessionType, 
      result
    );

    // Load existing messages
    const history = chatMemoryService.getChatHistory(currentUser.id, sessionId);
    
    if (history.length > 0) {
      setMessages(history);
    } else {
      // First time - add greeting
      const greeting = getInitialGreeting();
      const greetingMsg: ChatMessage = {
        id: `msg-${Date.now()}-init`,
        role: 'assistant',
        content: greeting,
        timestamp: Date.now(),
        tokens: Math.ceil(greeting.length / 4),
      };
      setMessages([greetingMsg]);
      chatMemoryService.addMessage(currentUser.id, sessionId, {
        role: 'assistant',
        content: greeting,
        timestamp: Date.now(),
      });
    }
    setChatInitialized(true);
    loadMemoryStats();
  };

  const getInitialGreeting = () => {
    const archetype = result.archetype || 'Explorer';
    const sessionTypeLabels: Record<SessionType, string> = {
      school: 'academic',
      medical: 'health',
      psychological: 'mental wellbeing',
      career: 'career development',
      relationship: 'relationship dynamics'
    };
    
    const typeLabel = sessionTypeLabels[sessionType] || 'personal growth';
    
    return `Hello! I'm your counseling companion. I've reviewed your ${typeLabel} session results and see you're identified as a ${archetype}. How can I help you better understand your results or explore any questions you have about your ${typeLabel} journey?`;
  };

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading || !sessionId || !currentUser) return;

    const userMessage = input;
    setInput('');
    setIsLoading(true);

    // Add user message to local state immediately
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
      tokens: Math.ceil(userMessage.length / 4),
    };
    setMessages(prev => [...prev, userMsg]);

    // Save to memory
    chatMemoryService.addMessage(currentUser.id, sessionId, {
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
    });

    try {
      // Get AI response using optimized prompt
      const aiResponse = await getChatResponse(userMessage);
      
      // Add assistant response to local state
      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now()}-assistant`,
        role: 'assistant',
        content: aiResponse,
        timestamp: Date.now(),
        tokens: Math.ceil(aiResponse.length / 4),
      };
      setMessages(prev => [...prev, assistantMsg]);

      // Save to memory
      chatMemoryService.addMessage(currentUser.id, sessionId, {
        role: 'assistant',
        content: aiResponse,
        timestamp: Date.now(),
      });

      loadMemoryStats();
    } catch (error) {
      console.error('Chat error:', error);
      const errorMsg = "I apologize, but I'm having trouble processing your question right now. Please try again in a moment.";
      const errorMsgObj: ChatMessage = {
        id: `msg-${Date.now()}-error`,
        role: 'assistant',
        content: errorMsg,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMsgObj]);
      chatMemoryService.addMessage(currentUser.id, sessionId, {
        role: 'assistant',
        content: errorMsg,
        timestamp: Date.now(),
      });
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, sessionId, currentUser, result, sessionType, answers]);

  const getChatResponse = useCallback(async (userMessage: string): Promise<string> => {
    if (!sessionId || !currentUser) return "Session not found.";

    // Build optimized prompt using chat memory
    const prompt = chatMemoryService.buildOptimizedPrompt(
      currentUser.id, 
      sessionId, 
      userMessage, 
      result
    );

    const chatSchema = {
      type: "OBJECT",
      properties: {
        response: { type: "STRING" },
        suggestions: { 
          type: "ARRAY", 
          items: { type: "STRING" } 
        }
      },
      required: ["response"]
    };

    const systemInstruction = `You are a compassionate counseling AI assistant with memory of past conversations. You have access to a user's counseling session results and conversation history. Provide helpful, empathetic, and insightful responses. Reference past discussions when relevant. Keep responses warm, supportive, and actionable.`;

    try {
      const res = await aiService.generateContent<any>(prompt, chatSchema, systemInstruction);
      return res.response || "I'm here to help you explore your thoughts further. Could you tell me more about what you'd like to understand?";
    } catch (error) {
      return getFallbackResponse(userMessage);
    }
  }, [sessionId, currentUser, result]);

  const getFallbackResponse = (userMessage: string): string => {
    const lowerMessage = userMessage.toLowerCase();
    
    if (lowerMessage.includes('archetype') || lowerMessage.includes('result')) {
      return `Based on your session results, you're identified as a ${result.archetype}. This suggests ${result.archetypeDescription.toLowerCase()}. Would you like me to elaborate on any particular aspect of this profile?`;
    }
    
    if (lowerMessage.includes('trait') || lowerMessage.includes('strength') || lowerMessage.includes('weakness')) {
      const strongestTrait = Object.entries(result.traits).reduce((a, b) => 
        a[1] > b[1] ? a : b
      );
      return `Your strongest trait appears to be ${strongestTrait[0]} (${strongestTrait[1]}/100), while you might want to pay attention to areas where you scored lower. Would you like suggestions for developing specific traits?`;
    }
    
    if (lowerMessage.includes('advice') || lowerMessage.includes('help') || lowerMessage.includes('what should')) {
      return result.counselingAdvice || "I encourage you to reflect on what matters most to you right now. Sometimes small, consistent steps lead to the most meaningful changes.";
    }
    
    return `That's an interesting question. Based on our session, I notice you're exploring themes around ${result.archetype.toLowerCase()} qualities. Could you tell me more about what specific aspect you'd like to explore further?`;
  };

  const handleNewChat = () => {
    if (sessionId && currentUser) {
      chatMemoryService.clearMemory(currentUser.id, sessionId);
      initializeChat();
    }
  };

  if (!chatInitialized) {
    return <div className="text-center py-8">Initializing chat...</div>;
  }

  return (
    <div className="border-t border-slate-200 mt-12 pt-10">
      <div className="space-y-6">
        {/* Chat Header */}
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-brand-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
              💬
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Counseling Companion Chat</h3>
              <p className="text-sm text-slate-500">Ask questions about your results • {memoryStats.messageCount} messages • ~${memoryStats.tokenCount} tokens</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {memoryStats.hasSummary && (
              <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">
                Memory Optimized
              </span>
            )}
            <button 
              onClick={handleNewChat}
              className="text-sm text-brand-600 hover:text-brand-700"
            >
              New Chat
            </button>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="h-96 overflow-y-auto pr-2 mb-4 space-y-4">
          {messages.map((msg, index) => (
            <div key={msg.id || index} className={`max-w-[85%] ${msg.role === 'user' ? 'ml-auto' : 'mr-auto'} `}>
              <div className={`${msg.role === 'user' ? 'bg-brand-600 text-white' : 'bg-white border border-slate-200'} rounded-xl p-3 py-2 max-w-xs `}>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                <span className="block text-xs text-slate-400 mt-1">{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <div className="w-4 h-4 border-2 border-brand-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="ml-2 text-sm text-slate-500">Thinking...</span>
            </div>
          )}
        </div>

        {/* Chat Input */}
        <div className="flex space-x-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask about your results, traits, or next steps..."
            className="flex-1 min-h-[44px] rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600 resize-none"
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="px-5 py-3 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-colors disabled:opacity-50 flex-shrink-0"
          >
            {isLoading ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                Sending...
              </>
            ) : (
              <span>Send</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatSession;
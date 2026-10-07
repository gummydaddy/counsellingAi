import React, { useState, useEffect } from 'react';
import { AnalysisResult, SessionType, Answer } from '../types.ts';
import { aiService } from '../services/geminiService.ts';

interface Props {
  result: AnalysisResult;
  answers: Answer[];
  sessionType: SessionType;
}

const ChatSession: React.FC<Props> = ({ result, answers, sessionType }) => {
  const [messages, setMessages] = useState<Array<{role: 'user' | 'assistant', content: string, timestamp: number}>>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatInitialized, setChatInitialized] = useState(false);

  useEffect(() => {
    // Initialize chat with a contextual greeting based on the result
    initializeChat();
  }, [result, answers, sessionType]);

  const initializeChat = () => {
    const greeting = getInitialGreeting();
    setMessages([
      {
        role: 'assistant',
        content: greeting,
        timestamp: Date.now()
      }
    ]);
    setChatInitialized(true);
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

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input;
    setInput('');
    setIsLoading(true);

    // Add user message to chat
    setMessages(prev => [...prev, {
      role: 'user',
      content: userMessage,
      timestamp: Date.now()
    }]);

    try {
      // Get AI response based on context
      const aiResponse = await getChatResponse(userMessage);
      
      // Add assistant response to chat
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: aiResponse,
        timestamp: Date.now()
      }]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "I apologize, but I'm having trouble processing your question right now. Please try again in a moment.",
        timestamp: Date.now()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const getChatResponse = async (userMessage: string) => {
    // Create context from the session results
    const context = createSessionContext();
    
    // Define the schema for chat response
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

    const systemInstruction = `You are a compassionate counseling AI assistant. You have access to a user's counseling session results and should provide helpful, empathetic, and insightful responses to their questions. Base your responses on their session data but also provide general guidance when appropriate. Keep responses warm, supportive, and actionable. If suggesting resources or actions, make sure they are appropriate and safe.`;

    const prompt = `
Session Context:
${context}

User's Question: ${userMessage}

Please provide a helpful response to the user's question based on their session results. If appropriate, you can also offer 1-2 gentle suggestions for next steps or reflection.`;

    try {
      const res = await aiService.generateContent<any>(prompt, chatSchema, systemInstruction);
      return res.response || "I'm here to help you explore your thoughts further. Could you tell me more about what you'd like to understand?";
    } catch (error) {
      // Fallback response if AI fails
      return getFallbackResponse(userMessage);
    }
  };

  const createSessionContext = () => {
    const { archetype, archetypeDescription, traits, counselingAdvice, riskAssessment } = result;
    
    let context = `
SESSION SUMMARY:
- Archetype: ${archetype}
- Description: ${archetypeDescription}
- Risk Level: ${riskAssessment.level}
- Key Traits:
  • Empathy: ${traits.empathy}/100
  • Logic: ${traits.logic}/100
  • Integrity: ${traits.integrity}/100
  • Ambition: ${traits.ambition}/100
  • Resilience: ${traits.resilience}/100
  • Social Calibration: ${traits.social_calibration}/100
`;

    // Add session-specific details
    if (sessionType === 'medical' && result.professionalDiagnosis) {
      context += `- Professional Diagnosis: ${result.professionalDiagnosis}\n`;
    }
    
    if (sessionType === 'psychological' && result.rootCauses) {
      context += `- Identified Root Causes: ${result.rootCauses.join(', ')}\n`;
    }
    
    if (sessionType === 'relationship' && result.interpersonalStrategy) {
      context += `- Interpersonal Strategy: ${result.interpersonalStrategy}\n`;
    }
    
    if (result.counselingAdvice) {
      context += `- Counseling Advice: ${result.counselingAdvice}\n`;
    }

    context += `
RECENT EXCHANGES:
${answers.slice(-3).map((a, i) => 
  `Q${i+1}: ${a.questionText}\nA${i+1}: ${a.userResponse}`
).join('\n\n')}`;

    return context;
  };

  const getFallbackResponse = (userMessage: string) => {
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
              �� 💬
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Counseling Companion Chat</h3>
              <p className="text-sm text-slate-500">Ask questions about your results</p>
            </div>
          </div>
          <button 
            onClick={() => {
              setMessages([]);
              initializeChat();
            }}
            className="text-sm text-brand-600 hover:text-brand-700"
          >
            New Chat
          </button>
        </div>

        {/* Chat Messages */}
        <div className="h-96 overflow-y-auto pr-2 mb-4 space-y-4">
          {messages.map((msg, index) => (
            <div key={index} className={`max-w-[85%] ${msg.role === 'user' ? 'ml-auto' : 'mr-auto'} `}>
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
import { AnalysisResult, Answer, SessionType } from '../types.ts';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  tokens?: number;
}

export interface ChatMemory {
  sessionId: string;
  userId: string;
  sessionType: SessionType;
  messages: ChatMessage[];
  summary: string;
  keyTopics: string[];
  totalTokens: number;
  createdAt: string;
  updatedAt: string;
  // Cached result for summarization
  cachedResult?: AnalysisResult;
}

export interface CompressedContext {
  summary: string;
  keyTopics: string[];
  recentMessages: ChatMessage[];
  traitProfile: Record<string, number>;
  riskLevel: string;
  archetype: string;
}

const MAX_TOKENS_PER_CHAT = 3000;
const SUMMARIZE_THRESHOLD = 2000;
const MAX_RECENT_MESSAGES = 10;

class ChatMemoryService {
  private readonly MEMORY_KEY = 'mindpath_chat_memory_';

  private getMemoryKey(userId: string, sessionId: string): string {
    return `${this.MEMORY_KEY}${userId}_${sessionId}`;
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  // Initialize or get existing chat memory
  getOrCreateMemory(userId: string, sessionId: string, sessionType: SessionType, result: AnalysisResult): ChatMemory {
    const key = this.getMemoryKey(userId, sessionId);
    let memory: ChatMemory | null = null;

    try {
      const stored = localStorage.getItem(key);
      if (stored) memory = JSON.parse(stored);
    } catch {
      memory = null;
    }

    if (!memory) {
      memory = {
        sessionId,
        userId,
        sessionType,
        messages: [],
        summary: '',
        keyTopics: [],
        totalTokens: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    // Update with latest result context
    memory.sessionType = sessionType;
    memory.cachedResult = result;
    memory.updatedAt = new Date().toISOString();
    
    this.saveMemory(memory);
    return memory;
  }

  // Add a message to chat memory
  addMessage(userId: string, sessionId: string, message: Omit<ChatMessage, 'id' | 'tokens'>): ChatMemory {
    const key = this.getMemoryKey(userId, sessionId);
    let memory: ChatMemory | null = null;

    try {
      const stored = localStorage.getItem(key);
      if (stored) memory = JSON.parse(stored);
    } catch {
      memory = {
        sessionId,
        userId,
        sessionType: 'school',
        messages: [],
        summary: '',
        keyTopics: [],
        totalTokens: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    if (!memory) throw new Error('Memory not initialized');

    const tokens = this.estimateTokens(message.content);
    const newMessage: ChatMessage = {
      ...message,
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      tokens,
    };

    memory.messages.push(newMessage);
    memory.totalTokens += tokens;
    memory.updatedAt = new Date().toISOString();

    // Auto-summarize if token count exceeds threshold
    if (memory.totalTokens > SUMMARIZE_THRESHOLD) {
      memory = this.summarizeMemory(memory, memory.cachedResult);
    }

    // Extract key topics from user messages
    this.extractKeyTopics(memory);

    this.saveMemory(memory);
    return memory;
  }

  // Summarize old messages to reduce token usage
  private summarizeMemory(memory: ChatMemory, result: AnalysisResult): ChatMemory {
    const messagesToSummarize = memory.messages.slice(0, -MAX_RECENT_MESSAGES);
    const recentMessages = memory.messages.slice(-MAX_RECENT_MESSAGES);

    if (messagesToSummarize.length === 0) return memory;

    const conversationText = messagesToSummarize
      .map(m => `${m.role}: ${m.content}`)
      .join('\n');

    const summary = this.generateSummary(conversationText, result);
    const keyTopics = this.extractTopics(conversationText);
    const recentTokens = recentMessages.reduce((sum, m) => sum + (m.tokens || this.estimateTokens(m.content)), 0);

    return {
      ...memory,
      messages: recentMessages,
      summary,
      keyTopics: [...new Set([...memory.keyTopics, ...keyTopics])],
      totalTokens: recentTokens + this.estimateTokens(summary),
    };
  }

  private generateSummary(conversation: string, result: AnalysisResult): string {
    const archetype = result.archetype || 'User';
    const riskLevel = result.riskAssessment?.level || 'Unknown';
    
    return `Previous conversation summary (${this.estimateTokens(conversation)} tokens compressed): 
User identified as ${archetype} with ${riskLevel} risk level. 
Key discussion points: ${this.extractTopics(conversation).join(', ')}. 
The user explored themes around their ${archetype.toLowerCase()} profile, discussed coping strategies, and sought guidance on next steps.`;
  }

  private extractTopics(text: string): string[] {
    const topics: string[] = [];
    const lowerText = text.toLowerCase();
    
    const topicKeywords = {
      'anxiety': ['anxiety', 'anxious', 'worry', 'nervous', 'panic'],
      'depression': ['depression', 'depressed', 'sad', 'hopeless', 'low mood'],
      'relationships': ['relationship', 'partner', 'friend', 'family', 'social'],
      'career': ['career', 'job', 'work', 'profession', 'career path'],
      'academic': ['school', 'study', 'exam', 'grade', 'academic', 'learning'],
      'health': ['health', 'medical', 'doctor', 'symptom', 'pain', 'illness'],
      'trauma': ['trauma', 'ptsd', 'abuse', 'past', 'childhood'],
      'stress': ['stress', 'overwhelmed', 'burnout', 'pressure'],
      'self-esteem': ['confidence', 'self-worth', 'self-esteem', 'insecurity'],
      'coping': ['coping', 'strategy', 'manage', 'deal with', 'handle'],
    };

    Object.entries(topicKeywords).forEach(([topic, keywords]) => {
      if (keywords.some(k => lowerText.includes(k))) {
        topics.push(topic);
      }
    });

    return topics;
  }

  private extractKeyTopics(memory: ChatMemory): void {
    const userMessages = memory.messages
      .filter(m => m.role === 'user')
      .map(m => m.content)
      .join(' ');
    
    memory.keyTopics = this.extractTopics(userMessages);
  }

  // Get compressed context for AI (token-optimized)
  getCompressedContext(userId: string, sessionId: string, result: AnalysisResult): CompressedContext {
    const key = this.getMemoryKey(userId, sessionId);
    let memory: ChatMemory | null = null;

    try {
      const stored = localStorage.getItem(key);
      if (stored) memory = JSON.parse(stored);
    } catch {
      memory = null;
    }

    if (!memory) {
      return {
        summary: '',
        keyTopics: [],
        recentMessages: [],
        traitProfile: result.traits,
        riskLevel: result.riskAssessment?.level || 'Unknown',
        archetype: result.archetype || 'Unknown',
      };
    }

    return {
      summary: memory.summary,
      keyTopics: memory.keyTopics,
      recentMessages: memory.messages.slice(-MAX_RECENT_MESSAGES),
      traitProfile: result.traits,
      riskLevel: result.riskAssessment?.level || 'Unknown',
      archetype: result.archetype || 'Unknown',
    };
  }

  // Build optimized prompt context for chat
  buildOptimizedPrompt(userId: string, sessionId: string, userMessage: string, result: AnalysisResult): string {
    const context = this.getCompressedContext(userId, sessionId, result);
    
    let prompt = `USER PROFILE:
- Archetype: ${context.archetype}
- Risk Level: ${context.riskLevel}
- Traits: Empathy ${context.traitProfile.empathy}, Logic ${context.traitProfile.logic}, Integrity ${context.traitProfile.integrity}, Ambition ${context.traitProfile.ambition}, Resilience ${context.traitProfile.resilience}, Social Calibration ${context.traitProfile.social_calibration}
`;

    if (context.summary) {
      prompt += `
CONVERSATION SUMMARY:
${context.summary}
`;
    }

    if (context.keyTopics.length > 0) {
      prompt += `
KEY TOPICS DISCUSSED: ${context.keyTopics.join(', ')}
`;
    }

    if (context.recentMessages.length > 0) {
      prompt += `
RECENT EXCHANGES:
${context.recentMessages.map(m => `${m.role}: ${m.content}`).join('\n')}
`;
    }

    prompt += `
CURRENT QUESTION: ${userMessage}

Provide a helpful, empathetic response based on the user's profile and conversation history.`;

    return prompt;
  }

  // Get chat history for display
  getChatHistory(userId: string, sessionId: string): ChatMessage[] {
    const key = this.getMemoryKey(userId, sessionId);
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const memory = JSON.parse(stored) as ChatMemory;
        return memory.messages;
      }
    } catch {
      return [];
    }
    return [];
  }

  // Clear chat memory
  clearMemory(userId: string, sessionId: string): void {
    const key = this.getMemoryKey(userId, sessionId);
    localStorage.removeItem(key);
  }

  private saveMemory(memory: ChatMemory): void {
    const key = this.getMemoryKey(memory.userId, memory.sessionId);
    localStorage.setItem(key, JSON.stringify(memory));
  }

  // Get memory stats
  getMemoryStats(userId: string, sessionId: string): { messageCount: number; tokenCount: number; hasSummary: boolean } {
    const key = this.getMemoryKey(userId, sessionId);
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const memory = JSON.parse(stored) as ChatMemory;
        return {
          messageCount: memory.messages.length,
          tokenCount: memory.totalTokens,
          hasSummary: !!memory.summary,
        };
      }
    } catch {
      return { messageCount: 0, tokenCount: 0, hasSummary: false };
    }
    return { messageCount: 0, tokenCount: 0, hasSummary: false };
  }
}

export const chatMemoryService = new ChatMemoryService();
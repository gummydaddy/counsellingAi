# Counselling AI System - Technical Working Explanation

## System Overview
Counselling AI is a full-stack web application that provides AI-powered counselling sessions across multiple domains (school, medical, psychological, career, relationship). The system combines user input with AI analysis to generate personalized insights and recommendations.

## Core Components

### 1. Authentication System (`services/auth.service.ts`)
- Handles user login/logout functionality
- Stores user data in localStorage
- Provides current user information and role (user/admin)

### 2. Session Management (`services/session.service.ts`)
- Saves and retrieves counselling sessions from localStorage
- Manages session lifecycle (creation, deletion, retrieval)
- Stores all session data including inputs, questions, answers, and analysis results

### 3. Knowledge Base (`services/knowledgeBaseService.ts`)
- Learns from past sessions to improve future analyses
- Provides statistical data and learned context for AI processing
- Implements asynchronous stats fetching to mimic database calls

### 4. AI Service (`services/geminiService.ts`)
- Multi-provider AI abstraction layer supporting Gemini, OpenAI, OpenRouter, Anthropic, and Groq
- Handles API key detection and provider selection
- Implements retry logic and error handling for robust AI interactions
- Uses structured JSON schemas for consistent AI responses
- Generates specialized prompts based on session type (medical, psychological, etc.)

### 5. UI Components
- **App.tsx**: Main application controller managing state and navigation
- **SessionSidebar.tsx**: Persistent sidebar showing session history and controls
- **WelcomeScreen.tsx**: Initial landing page
- **SessionSelectionScreen.tsx**: Session type selection interface
- **CounselorNotesLayer.tsx**: Optional expert notes input
- **MCQPhase.tsx**: Multiple-choice questionnaire phase
- **Assessment.tsx**: Dynamic question-answer assessment phase
- **ResultsView.tsx**: Final analysis and recommendations display
- **SessionDetailView.tsx**: Historical session viewing interface
- **AdminComponents.tsx**: Administrative interface (when enabled)

## Complete System Flow

### Phase 1: Initialization & Authentication
1. Application loads and checks authentication status via `authService.getCurrentUser()`
2. If not authenticated, shows AdminComponents (login interface)
3. If authenticated, loads user sessions and proceeds to welcome screen

### Phase 2: Session Initiation
1. User clicks "Start" on WelcomeScreen → navigates to SessionSelectionScreen
2. User selects session type (school/medical/psychological/career/relationship)
3. System transitions to either:
   - **Notes Prompt**: If user chooses to provide counselor notes
   - **MCQ Phase**: If user skips notes and proceeds directly to assessment

### Phase 3: Context Gathering
**Option A: Counselor Notes Path**
1. User inputs optional counselor notes in CounselorNotesLayer
2. System stores notes and proceeds to AI question generation

**Option B: MCQ Path**
1. User completes standardized multiple-choice questionnaire (MCQPhase)
2. System stores MCQ answers and proceeds to AI question generation

### Phase 4: AI-Powered Question Generation
1. System calls `generatePhase1Questions()` with either:
   - Counselor notes OR
   - MCQ answers
2. AI service:
   - Retrieves learned context from KnowledgeBaseService for the session type
   - Constructs specialized prompt based on session type (e.g., "Senior MBBS, MD Physician" for medical)
   - Generates 5 tailored foundation questions using structured prompting
   - Falls back to predefined questions if AI service fails

### Phase 5: Dynamic Assessment
1. User answers the 5 AI-generated questions in Assessment component
2. System collects responses and proceeds to analysis phase

### Phase 6: Analysis & Insight Generation
1. System calls `analyzeStudentAnswers()` with user responses
2. AI service:
   - Applies session-type-specific expert role instructions
   - Performs comprehensive analysis producing:
     - Archetype identification with description
     - Risk assessment (level, flags, concern status, detailed analysis)
     - Six personality trait scores (empathy, logic, integrity, ambition, resilience, social calibration)
     - Career path suggestions with strategic fit explanations
     - Personalized counseling advice
     - Specialized fields based on session type (diagnosis, precautions, medicines, root causes, interpersonal strategy)
3. System saves complete session to storage via sessionService

### Phase 7: Results Presentation
1. User views comprehensive ResultsView showing:
   - Personalized archetype and description
   - Risk assessment visualization
   - Trait analysis radar chart
   - Career recommendations
   - Counseling advice
   - Session-type-specific insights
2. Options to reset or start new session

### Phase 8: Session Management & Learning
1. All sessions stored in sidebar for historical review
2. Knowledge base continuously learns from completed sessions
3. AI stats update to reflect growing experience level
4 - Admin panel provides system overview (when enabled)

## Technical Implementation Details

### State Management
- React hooks (useState, useEffect, useCallback) manage application state
- Key state variables:
  - Authentication status and user data
  - Current application step/wizard state
  - Session type selection
  - AI-generated questions and user answers
  - Analysis results and error states
  - Session history and sidebar UI state

### AI Integration
- Abstracted AIService class supports multiple providers
- Automatic API key detection from environment variables
- Provider-specific handling for response formatting
- Retry mechanism with exponential backoff
- JSON schema validation for consistent AI outputs
- Specialized role prompting for domain-specific expertise

### Data Persistence
- All data stored in browser localStorage
- SessionService encapsulates storage logic
- Automatic session loading on user authentication
- Delete functionality for session management

### UI/UX Features
- Responsive design with collapsible sidebar
- Animated loading states during AI processing
- Error handling with user-friendly messages
- Role-based UI elements (admin panel visibility)
- Session type badges in header
- Smooth transitions between application states

## Production Considerations
- Environment-based configuration for API keys
- Fallback mechanisms for AI service failures
- Loading states improve perceived performance
- Error boundaries prevent application crashes
- LocalStorage persistence enables offline usage
- Modular component architecture facilitates maintenance

This system provides a sophisticated AI-powered counselling experience that adapts to user inputs while maintaining clinical rigor through specialized prompting and structured analysis frameworks.
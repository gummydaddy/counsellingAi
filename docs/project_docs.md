# Project Documentation

## Product Requirement Document (PRD)

**Product Name:** MindPath AI

**Purpose:** 
To assist schools and counselors in identifying student mindsets (e.g., Analytical, Empathetic, Leadership-oriented) and detecting potential behavioral risks (Anti-social, Aggressive, Predatory) early on, providing tailored career guidance and counseling advice.

**Target Audience:** 
- Students (High School/College)
- School Counselors
- Educational Institutions

**Key Features:**
1.  **Psychological Assessment:** A set of 12 hypothetical scenario-based questions to gauge ethics, logic, empathy, ambition, and social dynamics.
2.  **Chain-of-Thought AI Analysis:** Aggregates all answers and sends them to Gemini AI to analyze complex patterns (e.g., distinguishing between a "bold leader" and a "manipulative narcissist").
3.  **Archetype Identification:** Classifies students into constructive archetypes (e.g., Engineer, Doctor, Leader) or Risk Categories.
4.  **Risk Flagging:** Privately identifies high-risk keywords or thought patterns for counselor intervention.
    *   *Note:* The system detects predatory/criminal thought patterns but uses professional clinical language (e.g., "High Risk Anti-Social Profile") to ensure safety and liability protection.
5.  **Visual Dashboard:** Displays a radar chart of personality traits, risk index, and career compatibility.

---

## YAML Configuration

```yaml
app_config:
  name: "MindPath AI"
  version: "2.0.0"
  model_provider: "Google Gemini"
  model_tier: "gemini-2.5-flash"

assessment:
  question_count: 12
  categories:
    - ethics
    - logic
    - empathy
    - resilience
    - ambition
    - leadership

analysis_parameters:
  temperature: 0.5
  output_format: "JSON"
  thinking_budget: "adaptive" # Uses standard processing but prompts for Chain-of-Thought
  safety_settings:
    harassment: "BLOCK_NONE" # Required to analyze potentially negative student answers
    hate_speech: "BLOCK_NONE"
    
risk_thresholds:
  critical_flags:
    - "violence"
    - "lack of remorse"
    - "manipulation"
    - "predatory behavior"
    - "sexual aggression"
```

---

## Chain-of-Thought Prompt Strategy

This is the internal logic used in `geminiService.ts` to instruct the AI.

**System Role:** 
You are an advanced Criminal Psychologist and Career Counselor AI.

**Input Data:**
A list of questions and the student's corresponding raw text answers.

**Reasoning Steps (Chain of Thought):**
1.  **Dark Triad Analysis:** 
    *   Scan for Machiavellianism (Does the user view people as tools?).
    *   Scan for Narcissism (Does the user show extreme entitlement?).
    *   Scan for Psychopathy (Does the user lack remorse or empathy?).
    *   *Differentiation:* A "Politician" may have high Machiavellianism but high social goals. A "Criminal" has high Machiavellianism + High Aggression + Low Ethics.

2.  **Constructive Trait Analysis:**
    *   **Engineer:** High Logic + Systemizing interest (fixing things) + Moderate/Low Empathy.
    *   **Doctor:** High Empathy + High Integrity + High Logic (fixing people).
    *   **Judge/Lawyer:** High Logic + High Ethics + High Leadership.

3.  **Risk Level Determination:**
    *   *Low:* Normal teenage responses.
    *   *Critical:* Admissions of wanting to hurt others, "might makes right" philosophy, or predatory sexual attitudes.

4.  **Output Generation:**
    *   Map findings to the JSON schema.
    *   If Risk is Critical, set `isConcern` to true and override career suggestions with behavioral counseling recommendations.
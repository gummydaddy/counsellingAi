
import { Question, MCQQuestion, SessionType } from './types';

// School / Academic Counseling (The original set)
const SCHOOL_POOL: MCQQuestion[] = [
  {
    id: 1,
    text: "When you enter a classroom full of strangers, what is your immediate instinct?",
    category: "social_calibration",
    options: [
      { value: "observe", label: "Stand back and observe the dynamics first." },
      { value: "engage", label: "Introduce myself to the first person I see." },
      { value: "dominate", label: "Make a loud entrance to get attention." },
      { value: "avoid", label: "Find a quiet corner or look at my phone." }
    ]
  },
  {
    id: 2,
    text: "A teacher wrongly accuses you of cheating. How do you handle it?",
    category: "resilience",
    options: [
      { value: "argue", label: "Immediately argue back and demand proof." },
      { value: "evidence", label: "Calmly gather evidence to prove my innocence." },
      { value: "emotional", label: "Get upset and cry or shut down." },
      { value: "revenge", label: "Accept it now but plan a way to get back at them." }
    ]
  },
  {
    id: 3,
    text: "In a group project, you prefer to be...",
    category: "leadership",
    options: [
      { value: "leader", label: "The Leader: Directing everyone else." },
      { value: "specialist", label: "The Specialist: Doing one hard task alone." },
      { value: "supporter", label: "The Supporter: Helping wherever needed." },
      { value: "observer", label: "The Observer: Doing the minimum required." }
    ]
  },
  {
    id: 4,
    text: "Your friend is crying because they failed a test. What do you say?",
    category: "empathy",
    options: [
      { value: "solution", label: "I help them study for the next one." },
      { value: "comfort", label: "I hug them and listen to their feelings." },
      { value: "dismiss", label: "I tell them it's not a big deal and to move on." },
      { value: "joke", label: "I crack a joke to distract them." }
    ]
  },
  {
    id: 5,
    text: "Which academic goal appeals to you most?",
    category: "ambition",
    options: [
      { value: "top_grades", label: "Being the valedictorian/top of class." },
      { value: "knowledge", label: "Actually understanding how things work." },
      { value: "popularity", label: "Being well-liked by teachers and peers." },
      { value: "survival", label: "Just passing with minimum effort." }
    ]
  }
];

// Medical / Health Counseling
const MEDICAL_POOL: MCQQuestion[] = [
  {
    id: 101,
    text: "When you feel a sudden, unknown pain, what is your first reaction?",
    category: "anxiety_response",
    options: [
      { value: "panic", label: "Immediately assume the worst (WebMD spiral)." },
      { value: "ignore", label: "Ignore it and hope it goes away." },
      { value: "logic", label: "Monitor it for 24 hours to see if it changes." },
      { value: "action", label: "Immediately schedule a doctor's appointment." }
    ]
  },
  {
    id: 102,
    text: "How strictly do you follow a prescribed medication routine?",
    category: "compliance",
    options: [
      { value: "strict", label: "To the exact minute and dosage." },
      { value: "loose", label: "I take it when I remember." },
      { value: "skeptical", label: "I stop as soon as I feel better, regardless of instructions." },
      { value: "avoidant", label: "I avoid taking pills unless absolutely necessary." }
    ]
  },
  {
    id: 103,
    text: "A doctor gives you a diagnosis you don't like. You...",
    category: "trust_authority",
    options: [
      { value: "accept", label: "Trust their expertise completely." },
      { value: "second_opinion", label: "Calmly seek a second professional opinion." },
      { value: "denial", label: "Assume they are wrong or incompetent." },
      { value: "alternative", label: "Try to treat it with home remedies instead." }
    ]
  },
  {
    id: 104,
    text: "How do you view your own body?",
    category: "self_perception",
    options: [
      { value: "machine", label: "A machine that needs maintenance." },
      { value: "temple", label: "Something sacred to be protected." },
      { value: "enemy", label: "Something that often betrays me." },
      { value: "tool", label: "Just a vehicle for my mind." }
    ]
  },
  {
    id: 105,
    text: "Dealing with long-term recovery or chronic issues makes you feel...",
    category: "resilience",
    options: [
      { value: "determined", label: "Ready to fight and adapt." },
      { value: "hopeless", label: "Like giving up." },
      { value: "angry", label: "Frustrated at the unfairness." },
      { value: "analytical", label: "Focused on researching every detail." }
    ]
  }
];

// Psychological / Mental Health Counseling
const PSYCH_POOL: MCQQuestion[] = [
  {
    id: 201,
    text: "When you are extremely stressed, your sleep pattern...",
    category: "somatic_response",
    options: [
      { value: "excessive", label: "I sleep all day to escape." },
      { value: "insomnia", label: "I can't sleep at all; my mind races." },
      { value: "normal", label: "Stays mostly the same." },
      { value: "nightmares", label: "Is interrupted by vivid, stressful dreams." }
    ]
  },
  {
    id: 202,
    text: "You make a small mistake in public. Your internal monologue says:",
    category: "self_talk",
    options: [
      { value: "critic", label: "'You idiot, everyone is laughing at you.'" },
      { value: "reassurance", label: "'It's okay, nobody noticed.'" },
      { value: "catastrophe", label: "'This is going to ruin my reputation forever.'" },
      { value: "humor", label: "'Lol, that was clumsy.'" }
    ]
  },
  {
    id: 203,
    text: "How do you handle intense sadness?",
    category: "coping_mechanism",
    options: [
      { value: "isolate", label: "Withdraw from everyone completely." },
      { value: "share", label: "Talk to a trusted friend or therapist." },
      { value: "distract", label: "Binge watch TV or play games to numb it." },
      { value: "mask", label: "Pretend everything is fine and smile." }
    ]
  },
  {
    id: 204,
    text: "Do you believe you can change your fundamental personality?",
    category: "growth_mindset",
    options: [
      { value: "yes_hard", label: "Yes, but it requires immense effort." },
      { value: "no_fixed", label: "No, people are born the way they are." },
      { value: "fluid", label: "Yes, we change constantly based on environment." },
      { value: "skeptical", label: "Maybe slightly, but the core remains." }
    ]
  },
  {
    id: 205,
    text: "When someone hurts you, forgiveness is...",
    category: "ethics_emotion",
    options: [
      { value: "impossible", label: "Weakness. They must pay." },
      { value: "transactional", label: "Possible if they apologize sincerely." },
      { value: "internal", label: "Necessary for my own peace of mind." },
      { value: "hard", label: "Very difficult; I hold grudges easily." }
    ]
  }
];

// Career Counseling
const CAREER_POOL: MCQQuestion[] = [
  {
    id: 301,
    text: "Would you rather have a job that...",
    category: "values",
    options: [
      { value: "money", label: "Pays $500k but you hate the work." },
      { value: "passion", label: "Pays $50k but you love the work." },
      { value: "impact", label: "Changes the world but is very stressful." },
      { value: "balance", label: "Is easy, low stress, and allows free time." }
    ]
  },
  {
    id: 302,
    text: "In a team meeting, you usually...",
    category: "role",
    options: [
      { value: "facilitate", label: "Make sure everyone is heard." },
      { value: "decide", label: "Make the final decision to move forward." },
      { value: "analyze", label: "Point out the flaws in the plan." },
      { value: "execute", label: "Wait for instructions on what to do." }
    ]
  },
  {
    id: 303,
    text: "Your definition of a 'Risk' in career is...",
    category: "risk_tolerance",
    options: [
      { value: "exciting", label: "An opportunity for high reward." },
      { value: "terrifying", label: "Something to be avoided at all costs." },
      { value: "calculated", label: "Acceptable if the math works out." },
      { value: "unnecessary", label: "Why risk if you are comfortable?" }
    ]
  },
  {
    id: 304,
    text: "How do you handle repetitive tasks?",
    category: "work_style",
    options: [
      { value: "automate", label: "I find a way to automate or delegate them." },
      { value: "grind", label: "I just put my head down and do them." },
      { value: "bore", label: "I get distracted and procrastinate." },
      { value: "meditative", label: "I find them relaxing." }
    ]
  },
  {
    id: 305,
    text: "You have a conflict with your boss. You...",
    category: "diplomacy",
    options: [
      { value: "confront", label: "Address it directly and professionally." },
      { value: "gossip", label: "Complain to coworkers." },
      { value: "submit", label: "Apologize even if I'm right to keep peace." },
      { value: "quit", label: "Start looking for a new job immediately." }
    ]
  }
];

// Relationship Counseling
const RELATIONSHIP_POOL: MCQQuestion[] = [
  {
    id: 401,
    text: "The most important aspect of a partner is...",
    category: "values",
    options: [
      { value: "loyalty", label: "Unwavering loyalty and trust." },
      { value: "ambition", label: "Drive and financial success." },
      { value: "empathy", label: "Emotional intelligence and kindness." },
      { value: "fun", label: "Excitement and spontaneity." }
    ]
  },
  {
    id: 402,
    text: "During a heated argument, you tend to...",
    category: "conflict_resolution",
    options: [
      { value: "explode", label: "Yell and let it all out." },
      { value: "shutdown", label: "Go silent and refuse to talk (stonewalling)." },
      { value: "deflect", label: "Make a joke or change the subject." },
      { value: "deescalate", label: "Try to calm things down and listen." }
    ]
  },
  {
    id: 403,
    text: "Your partner wants to do something you hate. You...",
    category: "compromise",
    options: [
      { value: "sacrifice", label: "Do it anyway to make them happy." },
      { value: "refuse", label: "Say no, I have my boundaries." },
      { value: "bargain", label: "Do it only if they do something for me." },
      { value: "complain", label: "Do it but complain the whole time." }
    ]
  },
  {
    id: 404,
    text: "Jealousy is...",
    category: "attachment",
    options: [
      { value: "love", label: "A sign they care about me." },
      { value: "insecurity", label: "A personal weakness to overcome." },
      { value: "toxic", label: "A dealbreaker." },
      { value: "normal", label: "Normal in small doses." }
    ]
  },
  {
    id: 405,
    text: "Ideally, you want a relationship that is...",
    category: "vision",
    options: [
      { value: "independent", label: "Two strong individuals living side by side." },
      { value: "merged", label: "We do absolutely everything together." },
      { value: "traditional", label: "Clear roles and structure." },
      { value: "passionate", label: "High highs and intense emotion." }
    ]
  }
];

export const SESSION_MCQ_POOLS: Record<SessionType, MCQQuestion[]> = {
  school: SCHOOL_POOL,
  medical: MEDICAL_POOL,
  psychological: PSYCH_POOL,
  career: CAREER_POOL,
  relationship: RELATIONSHIP_POOL
};

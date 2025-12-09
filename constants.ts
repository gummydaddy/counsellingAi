import { Question } from './types';

export const QUESTION_POOL: Question[] = [
  // Ethics
  {
    id: 1,
    text: "Imagine you found a wallet with $500 and an ID inside on a busy street. No one is watching. What exactly do you do and why?",
    category: 'ethics'
  },
  {
    id: 2,
    text: "You discover a loophole in an online game that lets you win every time. Do you use it, report it, or tell your friends?",
    category: 'ethics'
  },
  {
    id: 3,
    text: "If you could get away with a crime that would benefit your family financially, would you do it? Why or why not?",
    category: 'ethics'
  },
  
  // Empathy
  {
    id: 4,
    text: "A classmate who often bullies others falls down the stairs and is hurt. What is your immediate thought and action?",
    category: 'empathy'
  },
  {
    id: 5,
    text: "Your friend is crying over something you think is trivial. How do you react to them?",
    category: 'empathy'
  },
  {
    id: 6,
    text: "You see a stray dog looking hungry and scared. What do you do?",
    category: 'empathy'
  },

  // Logic
  {
    id: 7,
    text: "You see a complex machine or system that is broken. Do you prefer to walk away, call for help, or try to take it apart to fix it yourself?",
    category: 'logic'
  },
  {
    id: 8,
    text: "You have two paths to solve a problem: a fast risky one, or a slow guaranteed one. Which do you choose and why?",
    category: 'logic'
  },
  {
    id: 9,
    text: "Explain how you would organize a library that has no numbering system.",
    category: 'logic'
  },

  // Ambition
  {
    id: 10,
    text: "When you want something very badly (like a promotion or a specific person's attention), how far are you willing to go to get it?",
    category: 'ambition'
  },
  {
    id: 11,
    text: "Would you rather be the most loved person in a room or the most powerful person in the room?",
    category: 'ambition'
  },
  {
    id: 12,
    text: "If you had to choose between a happy average life or a stressful but historically significant life, which would you pick?",
    category: 'ambition'
  },

  // Leadership
  {
    id: 13,
    text: "You are the captain of a sinking ship. The lifeboat holds 5 people, but there are 6 of you. How do you decide who stays behind?",
    category: 'leadership'
  },
  {
    id: 14,
    text: "A group project is failing because one member isn't doing their work. How do you handle this person?",
    category: 'leadership'
  },

  // Social Calibration / Resilience
  {
    id: 15,
    text: "Someone publicly insults you in front of a group. How do you respond?",
    category: 'social_calibration'
  },
  {
    id: 16,
    text: "You worked hard on a project for weeks, but it was rejected immediately. What is your first reaction?",
    category: 'resilience'
  },
  {
    id: 17,
    text: "If you could be invisible for a day, what would you do?",
    category: 'social_calibration'
  },
  {
    id: 18,
    text: "Do you believe rules are meant to be followed strictly, or are they guidelines that can be bent?",
    category: 'social_calibration'
  }
];

export const DEMO_RESULT_MOCK = {
  archetype: "The Strategic Guardian",
  archetypeDescription: "You possess a balanced mind that values structure and protection. You think like a planner who wants to safeguard the community.",
  riskAssessment: {
    level: "Low",
    flags: [],
    isConcern: false
  },
  traits: {
    empathy: 75,
    logic: 80,
    integrity: 90,
    ambition: 60,
    resilience: 70,
    social_calibration: 85
  },
  careerPathSuggestions: [
    { title: "Civil Engineer", description: "Building infrastructure to help society." },
    { title: "Medical Doctor", description: "Using logic and care to heal." }
  ],
  counselingAdvice: "Keep nurturing your empathy while strengthening your leadership skills."
};
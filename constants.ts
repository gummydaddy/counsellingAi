import { Question } from './types';

export const QUESTIONS: Question[] = [
  {
    id: 1,
    text: "Imagine you found a wallet with $500 and an ID inside on a busy street. No one is watching. What exactly do you do and why?",
    category: 'ethics'
  },
  {
    id: 2,
    text: "You are working on a group project and one member is not doing their work, causing the team to fail. How do you handle this person?",
    category: 'leadership'
  },
  {
    id: 3,
    text: "A classmate who often bullies others falls down the stairs and is hurt. What is your immediate thought and action?",
    category: 'empathy'
  },
  {
    id: 4,
    text: "If you could change one rule in society to make the world better, but it would hurt a few people, would you do it? Explain your reasoning.",
    category: 'logic'
  },
  {
    id: 5,
    text: "Someone publicly embarrasses you for a mistake you made. How do you feel, and how do you plan to respond to them later?",
    category: 'resilience'
  },
  {
    id: 6,
    text: "Do you believe that the ends justify the means? For example, is it okay to lie or manipulate someone if it results in a huge success for you?",
    category: 'ethics'
  },
  {
    id: 7,
    text: "You see a complex machine or system that is broken. Do you prefer to walk away, call for help, or try to take it apart to fix it yourself?",
    category: 'logic'
  },
  {
    id: 8,
    text: "When you want something very badly (like a promotion or a specific person's attention), how far are you willing to go to get it?",
    category: 'ambition'
  },
  {
    id: 9,
    text: "If you were invisible for a day and could get away with anything, what would you do?",
    category: 'ethics'
  },
  {
    id: 10,
    text: "A friend tells you a secret that could ruin their reputation. Later, you get into a fight with them. Do you reveal the secret?",
    category: 'resilience'
  },
  {
    id: 11,
    text: "Do you think most people are generally good, or are they just waiting for a chance to take advantage of you?",
    category: 'empathy'
  },
  {
    id: 12,
    text: "You are the captain of a sinking ship. The lifeboat holds 5 people, but there are 6 of you. How do you decide who stays behind?",
    category: 'leadership'
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
    leadership: 60,
    aggression: 20,
    integrity: 90
  },
  careerPathSuggestions: [
    { title: "Civil Engineer", description: "Building infrastructure to help society." },
    { title: "Medical Doctor", description: "Using logic and care to heal." }
  ],
  counselingAdvice: "Keep nurturing your empathy while strengthening your leadership skills."
};
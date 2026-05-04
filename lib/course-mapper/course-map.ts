/**
 * Static map of topics → Heartbeat course links.
 *
 * Only community.reallovenetwork.com URLs are used here — never Vimeo.
 * Each entry has:
 *   - name:  Human-readable course name
 *   - url:   Heartbeat course URL
 *   - keywords: Words/phrases that should trigger this suggestion
 *   - confidence: How strongly this topic relates (higher = more relevant)
 */

export interface CourseEntry {
  name: string;
  url: string;
  keywords: string[];
  confidence: number; // 0–1, only suggested when match exceeds 0.6
}

/**
 * Course map — keyed by a short slug for easy reference.
 *
 * URLs follow the Heartbeat convention:
 *   https://community.reallovenetwork.com/courses/<slug>
 *
 * If the real slugs differ, update them here.
 */
export const COURSE_MAP: Record<string, CourseEntry> = {
  'boundaries-masterclass': {
    name: 'Boundaries Masterclass',
    url: 'https://community.reallovenetwork.com/courses/boundaries-masterclass',
    keywords: [
      'boundaries', 'boundary', 'saying no', 'setting limits', 'can\'t say no',
      'people pleaser', 'people-pleasing', 'walked over', 'pushover',
      'disrespect', 'being taken advantage of', 'enforcing boundaries',
      'personal boundaries', 'relationship boundaries',
    ],
    confidence: 0.9,
  },

  'confident-dater': {
    name: 'Become A Confident Dater',
    url: 'https://community.reallovenetwork.com/courses/become-a-confident-dater',
    keywords: [
      'confidence', 'confident dating', 'dating confidence', 'self-esteem dating',
      'nervous dating', 'anxious about dating', 'dating anxiety',
      'fear of dating', 'dating mindset', 'be more confident',
      'insecure dating', 'self-doubt dating',
    ],
    confidence: 0.85,
  },

  'dating-profile-hack': {
    name: 'Dating Profile Hack',
    url: 'https://community.reallovenetwork.com/courses/dating-profile-hack',
    keywords: [
      'dating profile', 'profile pictures', 'profile photos', 'bio',
      'dating app profile', 'tinder profile', 'bumble profile', 'hinge profile',
      'profile tips', 'better profile', 'profile help', 'matches',
      'no matches', 'profile makeover', 'dating photos', 'swipe right',
    ],
    confidence: 0.9,
  },

  'choose-right-person': {
    name: 'How To Choose The Right Person',
    url: 'https://community.reallovenetwork.com/courses/how-to-choose-the-right-person',
    keywords: [
      'choose right person', 'right person', 'picking the right partner',
      'is he the one', 'is she the one', 'red flags', 'green flags',
      'compatibility', 'wrong person', 'settling', 'don\'t settle',
      'partner selection', 'choosing a partner', 'evaluate',
      'good match', 'bad match', 'signs of a good',
    ],
    confidence: 0.85,
  },

  'ultimate-guide-dating': {
    name: 'The Ultimate Guide to Dating',
    url: 'https://community.reallovenetwork.com/courses/the-ultimate-guide-to-dating',
    keywords: [
      'dating guide', 'how to date', 'dating tips', 'dating advice',
      'dating strategy', 'dating rules', 'modern dating', 'dating game',
      'dating again', 'back to dating', 'reentering dating',
      'dating after divorce', 'dating after breakup',
    ],
    confidence: 0.8,
  },

  'relationship-now-what': {
    name: 'So You\'re In A Relationship, Now What?',
    url: 'https://community.reallovenetwork.com/courses/so-youre-in-a-relationship-now-what',
    keywords: [
      'new relationship', 'relationship now what', 'now that we\'re together',
      'relationship advice', 'keeping relationship', 'relationship stages',
      'early relationship', 'starting a relationship', 'relationship tips',
      'relationship goals', 'healthy relationship', 'relationship work',
      'making it work', 'maintaining relationship',
    ],
    confidence: 0.8,
  },

  'success-path': {
    name: 'WANTED Woman Success Path',
    url: 'https://community.reallovenetwork.com/courses/wanted-woman-success-path',
    keywords: [
      'success path', 'success journey', 'roadmap', 'path to love',
      'steps to love', 'framework', 'program', 'where do I start',
      'getting started', 'what\'s next', 'next step',
    ],
    confidence: 0.75,
  },

  'sexologist-sessions': {
    name: 'Sexologist Sessions',
    url: 'https://community.reallovenetwork.com/courses/sexologist-sessions',
    keywords: [
      'sex', 'intimacy', 'sexual', 'sexology', 'sexologist',
      'physical intimacy', 'sex life', 'sexual compatibility',
      'libido', 'desire', 'intimacy issues',
    ],
    confidence: 0.85,
  },

  'therapist-sessions': {
    name: 'Therapist Sessions',
    url: 'https://community.reallovenetwork.com/courses/therapist-sessions',
    keywords: [
      'therapy', 'therapist', 'trauma', 'healing', 'past trauma',
      'emotional healing', 'inner child', 'self-worth', 'worthiness',
      'abandonment', 'attachment', 'attachment style', 'anxious attachment',
      'avoidant attachment', 'triggered', 'emotional wounds',
    ],
    confidence: 0.8,
  },

  'love-vision': {
    name: 'The Love Vision Experience',
    url: 'https://community.reallovenetwork.com/courses/the-love-vision-experience',
    keywords: [
      'love vision', 'vision board', 'manifesting love', 'law of attraction',
      'visualize', 'vision for love', 'what I want', 'intentions',
      'love vision board', 'manifest',
    ],
    confidence: 0.8,
  },

  'dating-prep': {
    name: 'Dating Prep',
    url: 'https://community.reallovenetwork.com/courses/dating-prep',
    keywords: [
      'dating prep', 'prepare for dating', 'ready to date',
      'dating preparation', 'getting ready to date', 'date prep',
      'first date tips', 'first date', 'date ideas',
    ],
    confidence: 0.8,
  },

  'sister-circle': {
    name: 'Sister Circle Mondays',
    url: 'https://community.reallovenetwork.com/courses/sister-circle-mondays',
    keywords: [
      'sister circle', 'community', 'sisterhood', 'group coaching',
      'women supporting women', 'support group', 'lonely',
      'no friends', 'community support', 'other women',
    ],
    confidence: 0.7,
  },
};
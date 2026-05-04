export interface UserPattern {
  id: string;
  user_id: string;
  generated_at: string;
  topics_observed: string[];
  tone_trend: string;
  repeat_questions: string[];
  suggested_focus: string;
  heartbeat_link: string | null;
  is_read: boolean;
  is_dismissed: boolean;
}

export interface PatternAnalysisResult {
  topics_observed: string[];
  tone_trend: string;
  repeat_questions: string[];
  suggested_focus: string;
  heartbeat_link: string | null;
}
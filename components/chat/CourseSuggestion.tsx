'use client';

interface CourseSuggestionProps {
  name: string;
  url: string;
}

/**
 * Inline card that appears below Suzy's answer when a course is relevant.
 * Shows "📚 Related: [Course Name]" with a link to the Heartbeat course.
 */
export default function CourseSuggestion({ name, url }: CourseSuggestionProps) {
  return (
    <div className="mt-3">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl
          bg-surface-container-low/60 border border-primary/20
          hover:border-primary/50 hover:bg-surface-container-low/80
          transition-all duration-200 active:scale-[0.98]
          group text-sm font-body"
      >
        <span className="text-base shrink-0">📚</span>
        <span className="text-secondary/80 group-hover:text-primary transition-colors">
          Related:
        </span>
        <span className="text-primary font-semibold group-hover:underline">
          {name}
        </span>
        <span className="material-symbols-outlined text-sm text-secondary/40 group-hover:text-primary/60 transition-colors">
          open_in_new
        </span>
      </a>
    </div>
  );
}
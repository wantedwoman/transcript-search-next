'use client';

import { Fragment, ReactNode } from 'react';

interface MessageBubbleProps {
  content: string;
  isUser: boolean;
  sources?: Array<{
    lesson_title: string;
    course_name: string;
    module_name: string;
  }>;
}

function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>;
    }

    return <Fragment key={`${part}-${index}`}>{part}</Fragment>;
  });
}

function renderContent(content: string) {
  const blocks = content
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks.map((block, index) => {
    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
    const isBulletList = lines.every((line) => /^([-*]|\d+\.)\s+/.test(line) || /^\*\*[^*]+\*\*$/.test(line));

    if (isBulletList) {
      return (
        <div key={index} className="mb-4">
          <ul className="space-y-2 pl-5 text-sm leading-7">
            {lines.map((line, lineIndex) => {
              const cleaned = line.replace(/^([-*]|\d+\.)\s+/, '').trim();
              return <li key={lineIndex}>{renderInline(cleaned)}</li>;
            })}
          </ul>
        </div>
      );
    }

    if (lines.length === 1 && /:$/.test(lines[0])) {
      return (
        <h3 key={index} className="mb-3 mt-5 text-sm font-semibold uppercase tracking-[0.12em] text-[#8b4f6d] first:mt-0">
          {lines[0]}
        </h3>
      );
    }

    return (
      <div key={index} className="mb-4 space-y-3 text-sm leading-7">
        {lines.map((line, lineIndex) => (
          <p key={lineIndex}>{renderInline(line)}</p>
        ))}
      </div>
    );
  });
}

export default function MessageBubble({ content, isUser, sources }: MessageBubbleProps) {
  return (
    <div className={`mb-6 flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser ? (
        <div className="mr-3 mt-1 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#4d1d57] text-xs font-bold text-white shadow-sm">
          WW
        </div>
      ) : null}
      <div
        className={`max-w-[85%] rounded-[24px] px-5 py-4 sm:px-6 ${
          isUser
            ? 'bg-[#ff7095] text-white shadow-[0_12px_30px_rgba(255,112,149,0.18)]'
            : 'border border-[#f0d7e4] bg-[#fffafc] text-[#332630] shadow-[0_10px_30px_rgba(77,29,87,0.05)]'
        }`}
      >
        <div className={isUser ? 'text-sm leading-7' : 'text-sm leading-7 text-[#382933]'}>{renderContent(content)}</div>

        {!isUser && sources && sources.length > 0 ? (
          <div className="mt-5 border-t border-[#efd8e4] pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9d7188]">Sources</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {sources.map((source, index) => (
                <span
                  key={`${source.lesson_title}-${index}`}
                  className="rounded-full border border-[#edd6e3] bg-white px-3 py-1 text-xs text-[#7a5a6d]"
                >
                  {source.lesson_title}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

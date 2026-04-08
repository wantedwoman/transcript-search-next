'use client';

interface MessageBubbleProps {
  content: string;
  isUser: boolean;
  sources?: Array<{
    lesson_title: string;
    course_name: string;
    module_name: string;
    chunk_index: number;
    text: string;
  }>;
}

export default function MessageBubble({ content, isUser, sources }: MessageBubbleProps) {
  return (
    <div className={`mb-4 flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser ? (
        <div className="mr-3 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-purple-900 text-xs font-bold text-white">
          WW
        </div>
      ) : null}
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser ? 'bg-pink-600 text-white' : 'border border-gray-200 bg-gray-100 text-gray-900'
        }`}
      >
        <p className="whitespace-pre-wrap text-sm leading-6">{content}</p>

        {!isUser && sources && sources.length > 0 ? (
          <div className="mt-3 border-t border-gray-300 pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Sources</p>
            <div className="mt-2 space-y-2">
              {sources.map((source, index) => (
                <div key={`${source.lesson_title}-${index}`} className="rounded-md bg-white px-3 py-2 text-xs text-gray-700">
                  <div className="font-semibold text-gray-900">{source.lesson_title}</div>
                  <div>{source.course_name} • {source.module_name}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

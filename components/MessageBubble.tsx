import { Image } from 'next/image';

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

export default function MessageBubble({ 
  content, 
  isUser, 
  sources 
}: MessageBubbleProps) {
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-[80%] px-4 py-3 rounded-lg ${
        isUser 
          ? 'bg-primary text-white' 
          : 'bg-gray-100 text-gray-900 border border-gray-200'
      }`}>
        <p className="whitespace-pre-wrap">{content}</p>
        
        {!isUser && sources && sources.length > 0 && (
          <div className="mt-3 pt-2 border-t border-gray-300">
            <p className="text-xs text-gray-600 font-medium">Sources:</p>
            <div className="mt-1 space-y-1">
              {sources.map((source, index) => (
                <div key={index} className="bg-gray-50 px-2 py-1 rounded text-xs">
                  <strong className="text-gray-800">{source.lesson_title}</strong> 
                  <span className="text-gray-600"> ({source.course_name})</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {!isUser && (
        <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center ml-3">
          <Image 
            src="/wanted-woman-logo.png" 
            alt="WANTED Woman" 
            width={40} 
            height={40} 
            priority
          />
        </div>
      )}
    </div>
  );
}
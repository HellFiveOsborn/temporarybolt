import { modificationsRegex } from '~/utils/diff';
import { Markdown } from './Markdown';
import type { Attachment } from 'ai';
import { useState } from 'react';

interface UserMessageProps {
  content: string;
  experimental_attachments?: Attachment[];
}

export function UserMessage({ content, experimental_attachments }: UserMessageProps) {
  const [expandedImage, setExpandedImage] = useState(null);

  return (
    <div className="overflow-hidden pt-[4px]">
      {experimental_attachments?.map((attachment) => { // @ts-ignore
        if (attachment?.contentType.startsWith('image/')) {
          return (
            <div key={attachment.url.split('base64,')[1].slice(0, 10)}>
              <img
                src={attachment.url}
                alt={attachment.name}
                className="max-h-[200px] max-w-[200px] object-contain rounded-xl cursor-pointer"
                onClick={() => setExpandedImage(attachment?.url as any)}
              />

              {expandedImage && (
                <div
                  className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 transition-opacity duration-300 ease-in-out"
                  onClick={() => setExpandedImage(null)}
                >
                  <div className="relative max-w-[30%] max-h-[30%] top-[10%] transition-all duration-300 ease-in-out transform scale-0 opacity-0"
                    style={{
                      transform: expandedImage ? 'scale(1)' : 'scale(0)',
                      opacity: expandedImage ? '1' : '0',
                    }}
                  >
                    <img
                      src={expandedImage}
                      alt="Expanded view"
                      className="max-w-full max-h-full object-contain rounded-xl"
                    />
                    <button
                      className="absolute top-2 right-2 text-white bg-black bg-opacity-40 rounded-full p-1 transition-transform duration-200 ease-in-out hover:scale-110"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedImage(null);
                      }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        }
        return null;
      })}
      <Markdown limitedMarkdown>{sanitizeUserMessage(content)}</Markdown>
    </div>
  );
}


function sanitizeUserMessage(content: string) {
  return content.replace(modificationsRegex, '').trim();
}

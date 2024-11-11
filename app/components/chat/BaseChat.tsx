import { useState, useEffect, useCallback, useRef } from 'react';
import React, { type ChangeEvent, type RefCallback } from 'react';
import { Progress as ProgressBar } from '@radix-ui/react-progress';
import { useCookies } from 'react-cookie';
import type { Message } from 'ai';
import { v4 as uuidv4 } from 'uuid';
import { ClientOnly } from 'remix-utils/client-only';
import { Menu } from '~/components/sidebar/Menu.client';
import { IconButton } from '~/components/ui/IconButton';
import { Workbench } from '~/components/workbench/Workbench.client';
import { classNames } from '~/utils/classNames';
import { Messages } from './Messages.client';
import { SendButton } from './SendButton.client';
import styles from './BaseChat.module.scss';
import type { ModelType } from '~/lib/.server/llm/model';
import { toast } from 'react-toastify';

interface BaseChatProps {
  textareaRef?: React.RefObject<HTMLTextAreaElement> | undefined;
  messageRef?: RefCallback<HTMLDivElement> | undefined;
  scrollRef?: RefCallback<HTMLDivElement> | undefined;
  showChat?: boolean;
  showWorkbench?: boolean;
  chatStarted?: boolean;
  isStreaming?: boolean;
  defaultModel?: ModelType;
  messages?: Message[];
  enhancingPrompt?: boolean;
  promptEnhanced?: boolean;
  input?: string;
  handleStop?: () => void;
  sendMessage?: (event: React.UIEvent, messageInput?: string, fileInput?: FileList | null) => void;
  handleInputChange?: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  enhancePrompt?: () => void;
}

interface Model {
  id: string;
  name: string;
  contextWindow?: string | number;
  maxOutput?: string | number | null;
  vision?: boolean;
}

interface Provider {
  name: string;
  baseUrl: string;
  models: Model[];
}

const EXAMPLE_PROMPTS = [
  { text: 'Start a blog with Astro' },
  { text: 'Build a mobile app simple browser with NativeScript' },
  { text: 'Create a docs site with Vitepress' },
  { text: 'Scaffold UI with shadcn' },
  { text: 'Draft a presentation with Slidev' },
  { text: 'Code a video with Remotion' },
];

const TEXTAREA_MIN_HEIGHT = 76;

export const BaseChat = React.forwardRef<HTMLDivElement, BaseChatProps>(
  ({
    textareaRef,
    messageRef,
    scrollRef,
    showChat = true,
    showWorkbench = false,
    chatStarted = false,
    isStreaming = false,
    enhancingPrompt = false,
    promptEnhanced = false,
    messages,
    input = '',
    sendMessage,
    handleInputChange,
    enhancePrompt,
    handleStop,
  }, ref) => {
    const TEXTAREA_MAX_HEIGHT = chatStarted ? 400 : 200;

    const [selectedModel, setSelectedModel] = useState<string | null>(null);
    const [providers, setProviders] = useState<Provider[]>([]);
    const [cookies, setCookie] = useCookies(['uid', 'model', 'enhancerModel', 'autocompleteModel', 'autocompleteEnabled']);

    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      const fetchModelAndInitialize = async () => {
        if (!cookies.uid) setCookie('uid', uuidv4(), { path: '/' });

        try {
          const res = await fetch(`${process.env.BASE_URL || "http://localhost:5173"}/api/model/get`, {
            method: "POST",
            body: new URLSearchParams({ uid: cookies.uid }),
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
          });

          if (!res.ok) throw new Error('Failed to fetch model');
          const { model, providers: fetchedProviders } = await res.json() as { model: string; providers: Provider[] };

          setSelectedModel(model || null);
          setProviders(fetchedProviders || []);

          if (fetchedProviders.length < 1) {
            toast.warn("No providers found. Please try again later.");
          } else {
            setCookie('model', model, { path: '/' });
          }

          // Set autocomplete model default value if it's not already set
          if (!cookies.autocompleteModel) {
            setCookie('autocompleteModel', model, { path: '/' });
          }

          // Set enhancer model default value if it's not already set
          if (!cookies.enhancerModel) {
            setCookie('enhancerModel', model, { path: '/' });
            setCookie('autocompleteEnabled', 'true', { path: '/' }); // Enable autocomplete by default
          }
        } catch (error) {
          console.error('Error fetching model:', error);
          toast.error("Failed to load models. Please try again later.");
        }
      };

      fetchModelAndInitialize();
    }, [cookies.uid, setCookie]);

    useEffect(() => {
      let interval: NodeJS.Timeout;
      if (uploading) {
        interval = setInterval(() => {
          setUploadProgress((prev) => {
            const next = prev + 5;
            return next > 100 ? 100 : next;
          });
        }, 100);
      } else {
        setUploadProgress(0);
      }

      return () => {
        if (interval) clearInterval(interval);
      };
    }, [uploading]);

    const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = event.target.files?.[0];

      if (selectedFile) {
        if (selectedFile.size > 5 * 1024 * 1024) { // 5MB
          toast.error('File size must be less than 5MB.');
          return;
        }

        // Verificar se o arquivo é uma imagem
        if (selectedFile.type.startsWith('image/')) {
          const selModel = selectedModel?.split("@") as [string, string];
          const modelFound = providers.find(provider =>
            provider.models.some(model => model.id === selModel[1] && provider.name === selModel[0])
          );

          console.log(selModel)

          if (modelFound) {
            const selectedModelData = modelFound.models.find(model => model.id === selModel[1]);
            if (!selectedModelData?.vision) {
              toast.error(`The selected model (${selModel[1]}) does not support vision.`);
              return;
            }
          } else {
            toast.error('Provider corresponding to the selected model not found.');
            return;
          }
        }

        setFile(selectedFile);
        setUploading(true);
        setTimeout(() => {
          setUploading(false);
        }, 2000);
      }
    }, [providers, selectedModel, setFile, setUploading]);

    const handlePaste = useCallback((event: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = event.clipboardData?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image') !== -1) {
            const blob = items[i].getAsFile();
            if (blob) {
              setFile(blob);
              setUploading(true);
              setTimeout(() => {
                setUploading(false);
              }, 2000);
            }
            break;
          }
        }
      }
    }, []);

    const handleClearFile = useCallback(() => {
      setFile(null);
    }, []);

    const triggerFileInput = useCallback(() => {
      fileInputRef.current?.click();
    }, []);

    const createFileList = (files: File[]): FileList => {
      const dt = new DataTransfer();
      files.forEach(file => dt.items.add(file));
      return dt.files;
    };

    return (
      <div
        ref={ref}
        className={classNames(
          styles.BaseChat,
          'BaseChat relative flex h-full w-full overflow-hidden bg-bolt-elements-background-depth-1',
        )}
        data-chat-visible={showChat}
      >
        <div className="RayContainer" data-theme="dark" data-chat-started="false">
          <div className="LightRay RayOne"></div>
          <div className="LightRay RayTwo"></div>
          <div className="LightRay RayThree">
          </div><div className="LightRay RayFour"></div>
          <div className="LightRay RayFive"></div>
        </div>
        <div className="fixed top-[var(--header-height)] bottom-0 z-10 flex flex-col items-center justify-end px-2.5 p-3">
          <button className="bg-transparent text-bolt-elements-textSecondary cursor-none">
            <div className="i-ph:sidebar-simple-duotone text-xl"></div>
          </button>
        </div>
        <ClientOnly>{() => <Menu />}</ClientOnly>
        <div ref={scrollRef} className="flex overflow-y-auto w-full h-full">
          <div className={classNames(styles.Chat, 'flex flex-col flex-grow min-w-[var(--chat-min-width)] h-full', showWorkbench ? 'ml-6' : '')}>
            {!chatStarted && (
              <div id="intro" className="mt-[26vh] max-w-chat mx-auto">
                <h1 className="text-[44px] text-center font-semibold text-bolt-elements-textPrimary tracking-tight mb-2">
                  What do you want to build?
                </h1>
                <p className="mb-6 text-center text-bolt-elements-textSecondary">
                  Prompt, run, edit, and deploy full-stack web apps.
                </p>
              </div>
            )}
            <div
              className={classNames('pt-6 px-6', {
                'h-full flex flex-col': chatStarted,
              })}
            >
              <ClientOnly>
                {() => {
                  return chatStarted ? (
                    <Messages
                      ref={messageRef}
                      className="flex flex-col w-full flex-1 max-w-chat px-4 pb-6 mx-auto z-1"
                      messages={messages}
                      isStreaming={isStreaming}
                    />
                  ) : null;
                }}
              </ClientOnly>
              <div
                className={classNames('relative w-full max-w-chat mx-auto z-prompt', {
                  'sticky bottom-0': chatStarted,
                })}
              >
                <div
                  className={classNames(
                    'relative shadow-xs border border-bolt-elements-borderColor bg-bolt-elements-prompt-background backdrop-blur rounded-lg',
                  )}
                >
                  <svg className="PromptEffectContainer">
                    <defs>
                      <linearGradient id="line-gradient" x1="20%" y1="0%" x2="-14%" y2="10%" gradientUnits="userSpaceOnUse" gradientTransform="rotate(-45)">
                        <stop offset="0%" stopColor="#1488fc" stopOpacity="0%"></stop>
                        <stop offset="40%" stopColor="#1488fc" stopOpacity="80%"></stop>
                        <stop offset="50%" stopColor="#1488fc" stopOpacity="80%"></stop>
                        <stop offset="100%" stopColor="#1488fc" stopOpacity="0%"></stop>
                      </linearGradient>
                      <linearGradient id="shine-gradient">
                        <stop offset="0%" stopColor="white" stopOpacity="0%"></stop>
                        <stop offset="40%" stopColor="#8adaff" stopOpacity="80%"></stop>
                        <stop offset="50%" stopColor="#8adaff" stopOpacity="80%"></stop>
                        <stop offset="100%" stopColor="white" stopOpacity="0%"></stop>
                      </linearGradient>
                    </defs>
                    <rect className="PromptEffectLine" pathLength="100" strokeLinecap="round"></rect>
                    <rect className="PromptShine" x="48" y="24" width="70" height="1"></rect>
                  </svg>
                  {file && (
                    <div className="flex flex-col gap-5 bg-bolt-elements-background-depth-1 border-b border-bolt-elements-borderColor py-5 rounded-t-lg">
                      <div className="px-5 flex gap-5">
                        <div className="flex items-start space-x-4 p-4 shadow-xs border border-bolt-elements-borderColor bg-bolt-elements-prompt-background transition-border rounded-lg relative">
                          {file.type.startsWith('image/') ? (
                            <img src={URL.createObjectURL(file)} alt="Uploaded" className="h-10 w-10 object-cover rounded" />
                          ) : (
                            <div className="i-ph:file h-10 w-10 text-blue-500 flex-shrink-0"></div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-bolt-elements-textPrimary truncate">
                              {file.name.slice(0, 30) + (file.name.length > 30 ? '...' : '')}
                            </p>
                            <p className="text-sm text-bolt-elements-textSecondary">
                              {(file.size / 1024).toFixed(2)} KB
                            </p>
                          </div>
                          {uploading && (
                            <div className="absolute top-0 left-0 w-8/10 h-1 bg-gray-200 rounded-xl overflow-hidden" style={{ height: '2.5px' }}>
                              <div
                                className="h-full bg-blue-500 transition-all duration-300 ease-out"
                                style={{
                                  width: `${uploadProgress}%`,
                                  transform: `translateX(${-100 + uploadProgress}%)`
                                }}
                              />
                            </div>
                          )}
                          <IconButton
                            size='md'
                            icon="i-ph:x"
                            onClick={handleClearFile}
                            className="text-bolt-elements-textPrimary hover:text-bolt-elements-textSecondary"
                            disabled={uploading}
                          ></IconButton>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="relative select-none">
                    <textarea
                      ref={textareaRef}
                      className="w-full pl-4 pt-4 pr-16 focus:outline-none resize-none text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary bg-transparent text-sm"
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          const attach = file ? ((): FileList => {
                            const dataTransfer = new DataTransfer();
                            dataTransfer.items.add(file);
                            return dataTransfer.files;
                          })() : null;
                          sendMessage?.(event, input, attach);
                          setFile(null);
                        }
                      }}
                      value={input}
                      onPaste={handlePaste}
                      onChange={handleInputChange}
                      style={{
                        minHeight: TEXTAREA_MIN_HEIGHT,
                        maxHeight: TEXTAREA_MAX_HEIGHT,
                      }}
                      placeholder="How can Bolt help you today?"
                      translate="no"
                    />
                  </div>
                  <ClientOnly>
                    {() => (
                      <SendButton
                        show={input.length > 0 || isStreaming}
                        isStreaming={isStreaming}
                        onClick={(event) => {
                          if (isStreaming) {
                            handleStop?.();
                            return;
                          }
                          const attach = file ? ((): FileList => {
                            const dataTransfer = new DataTransfer();
                            dataTransfer.items.add(file);
                            return dataTransfer.files;
                          })() : null;
                          sendMessage?.(event, input, attach);
                          setFile(null);
                        }}
                      />
                    )}
                  </ClientOnly>
                  <div className="flex justify-between text-sm p-4 pt-2">
                    <div className="flex gap-1 items-center">
                      {/* File Upload */}
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        style={{ display: 'none' }}
                        accept="image/*,.txt,.js,.jsx,.ts,.tsx,.html,.css,.py,.json"
                      />
                      <IconButton
                        title="Upload Files"
                        className={classNames({
                          'text-bold-elements-item-contentDefault': true,
                          'p-1': true
                        })}
                        disabled={false}
                        onClick={triggerFileInput}
                      >
                        <div className="i-ph:paperclip text-xl"></div>
                      </IconButton>
                      {/* Enhance Prompt */}
                      <IconButton
                        title="Enhance the prompt."
                        disabled={input.length === 0 || enhancingPrompt}
                        className={classNames({
                          'opacity-100!': enhancingPrompt,
                          'text-bolt-elements-item-contentAccent! pr-1.5 enabled:hover:bg-bolt-elements-item-backgroundAccent!': promptEnhanced,
                        })}
                        onClick={enhancePrompt}
                      >
                        {enhancingPrompt ? (
                          <>
                            <div className="i-svg-spinners:90-ring-with-bg text-bolt-elements-loader-progress text-xl"></div>
                            <div className="ml-1.5">Enhancing in progress...</div>
                          </>
                        ) : (
                          <>
                            <div className="i-bolt:stars text-xl"></div>
                            {promptEnhanced && <div className="ml-1.5">Prompt reinforced.</div>}
                          </>
                        )}
                      </IconButton>
                    </div>
                    {input.length > 3 && (
                      <div className="text-xs text-bolt-elements-textTertiary">
                        Use <kbd className="kdb">Shift</kbd> + <kbd className="kdb">Return</kbd> A new line.
                      </div>
                    )}
                  </div>
                </div>
                <div className="bg-bolt-elements-background-depth-1 pb-6">{/* Ghost Element */}</div>
              </div>
            </div>
            {!chatStarted && (
              <div id="examples" className="relative flex flex-col gap-9 w-full max-w-3xl mx-auto mt-8 flex justify-center mt-6">
                <div className="flex flex-wrap justify-center gap-2">
                  {EXAMPLE_PROMPTS.map((examplePrompt, index) => (
                    <button
                      key={index}
                      onClick={(event) => {
                        sendMessage?.(event, examplePrompt.text);
                      }}
                      className="ExamplePrompts border border-bolt-elements-borderColor rounded-full bg-gray-50 hover:bg-gray-100 dark:bg-gray-950 dark:hover:bg-gray-900 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary px-3 py-1 text-xs transition-theme"
                    >
                      {examplePrompt.text}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <ClientOnly>{() => <Workbench chatStarted={chatStarted} isStreaming={isStreaming} />}</ClientOnly>
        </div>
      </div>
    );
  },
);


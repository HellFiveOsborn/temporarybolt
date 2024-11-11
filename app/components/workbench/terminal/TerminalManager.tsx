import React, { forwardRef, memo, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Panel, PanelGroup } from 'react-resizable-panels';
import { Terminal, type TerminalRef } from './Terminal';
import { IconButton } from '~/components/ui/IconButton';
import { classNames } from '~/utils/classNames';
import type { Theme } from '~/lib/stores/theme';
import type { Terminal as XTerm } from '@xterm/xterm';
import { workbenchStore } from '~/lib/stores/workbench';

export interface TerminalManagerProps {
    className?: string;
    theme: Theme;
    showTerminal: boolean;
    onTerminalReady?: (terminal: XTerm) => void;
    onTerminalResize?: (cols: number, rows: number) => void;
    onClose: () => void;
}

export interface TerminalManagerRef {
    reloadStyles: () => void;
}

const MAX_USER_TERMINALS = 3;

export const TerminalManager = memo(
    forwardRef<TerminalManagerRef, TerminalManagerProps>(
        ({ className, theme, showTerminal, onTerminalReady, onTerminalResize, onClose }, ref) => {
            const terminalRefs = useRef<Array<TerminalRef | null>>([]);
            const [activeTerminal, setActiveTerminal] = useState(0);
            const [terminalCount, setTerminalCount] = useState(1);
            const [showBoltTerminal, setShowBoltTerminal] = useState(false);

            useEffect(() => {
                return () => {
                    terminalRefs.current = [];
                };
            }, []);

            useImperativeHandle(ref, () => ({
                reloadStyles: () => {
                    for (const ref of terminalRefs.current) {
                        ref?.reloadStyles();
                    }
                },
            }));

            const addTerminal = () => {
                if (terminalCount < MAX_USER_TERMINALS) {
                    setTerminalCount(terminalCount + 1);
                    setActiveTerminal(terminalCount);
                    setShowBoltTerminal(false);
                }
            };

            const toggleBoltTerminal = () => {
                setShowBoltTerminal(!showBoltTerminal);
                if (!showBoltTerminal) {
                    setActiveTerminal(-1); // -1 represents Bolt terminal
                } else {
                    setActiveTerminal(0);
                }
            };

            return (
                <div className={classNames('h-full', className)}>
                    <div className="bg-bolt-elements-terminals-background h-full flex flex-col">
                        <div className="flex items-center bg-bolt-elements-background-depth-2 border-y border-bolt-elements-borderColor gap-1.5 min-h-[34px] p-2">
                            {/* Bolt Terminal Tab */}
                            <button
                                className={classNames(
                                    'flex items-center text-sm cursor-pointer gap-1.5 px-3 py-2 h-full whitespace-nowrap rounded-full',
                                    {
                                        'bg-bolt-elements-terminals-buttonBackground text-bolt-elements-textPrimary': showBoltTerminal,
                                        'bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary hover:bg-bolt-elements-terminals-buttonBackground':
                                            !showBoltTerminal,
                                    },
                                )}
                                onClick={toggleBoltTerminal}
                            >
                                <div className="i-ph:lightning-duotone text-lg" />
                                Bolt
                            </button>

                            {/* User Terminal Tabs */}
                            {Array.from({ length: terminalCount }, (_, index) => {
                                const isActive = activeTerminal === index && !showBoltTerminal;
                                return (
                                    <button
                                        key={index}
                                        className={classNames(
                                            'flex items-center text-sm cursor-pointer gap-1.5 px-3 py-2 h-full whitespace-nowrap rounded-full',
                                            {
                                                'bg-bolt-elements-terminals-buttonBackground text-bolt-elements-textPrimary': isActive,
                                                'bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary hover:bg-bolt-elements-terminals-buttonBackground':
                                                    !isActive,
                                            },
                                        )}
                                        onClick={() => {
                                            setActiveTerminal(index);
                                            setShowBoltTerminal(false);
                                        }}
                                    >
                                        <div className="i-ph:terminal-window-duotone text-lg" />
                                        Terminal {terminalCount > 1 && index + 1}
                                    </button>
                                );
                            })}

                            {/* Control Buttons */}
                            {terminalCount < MAX_USER_TERMINALS && !showBoltTerminal && (
                                <IconButton icon="i-ph:plus" size="md" onClick={addTerminal} />
                            )}
                            <IconButton
                                className="ml-auto"
                                icon="i-ph:caret-down"
                                title="Close"
                                size="md"
                                onClick={onClose}
                            />
                        </div>

                        {/* User Terminals */}
                        {Array.from({ length: terminalCount }, (_, index) => {
                            const isActive = activeTerminal === index && !showBoltTerminal;
                            return (
                                <Terminal
                                    key={`user-${index}`}
                                    className={classNames('h-full overflow-hidden', {
                                        hidden: !isActive,
                                    })}
                                    ref={(ref) => {
                                        if (ref) {
                                            terminalRefs.current[index] = ref;
                                        }
                                    }}
                                    onTerminalReady={onTerminalReady}
                                    onTerminalResize={onTerminalResize}
                                    theme={theme}
                                />
                            );
                        })}

                        <Terminal
                            className={classNames('h-full overflow-hidden', {
                                hidden: !showBoltTerminal,
                            })}
                            ref={(ref) => {
                                if (ref) {
                                    terminalRefs.current[terminalCount] = ref;
                                }
                            }}
                            readonly={true}
                            theme={theme}
                            onTerminalReady={(terminal) => {
                                // Conectar o terminal ao workbench store
                                workbenchStore.setBoltTerminal(terminal);
                            }}
                            onTerminalResize={onTerminalResize}
                        />
                    </div>
                </div>
            );
        },
    ),
);
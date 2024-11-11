import { useState } from 'react';
import { toast } from 'react-toastify';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('usePromptEnhancement');

export function usePromptEnhancer() {
  const [enhancingPrompt, setEnhancingPrompt] = useState(false);
  const [promptEnhanced, setPromptEnhanced] = useState(false);

  const resetEnhancer = () => {
    setEnhancingPrompt(false);
    setPromptEnhanced(false);
  };

  const enhancePrompt = async (input: string, setInput: (value: string) => void) => {
    setEnhancingPrompt(true);
    setPromptEnhanced(false);

    const originalInput = input;
    let _input = '';
    let _error;

    try {
      const response = await fetch('/api/enhancer', {
        method: 'POST',
        body: JSON.stringify({ message: input }),
      });

      const reader = response.body?.getReader();

      if (!reader) return;

      const decoder = new TextDecoder();

      setInput('');

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        _input += decoder.decode(value);
        logger.trace('Set input', _input);
        setInput(_input);
      }

      if (_input.length === 0) {
        logger.warn('Empty response');
        toast.error('Prompt enhancement failed');
        setInput(input);
        return;
      }

      setPromptEnhanced(true);
      setTimeout(() => setInput(_input), 0);
    } catch (error) {
      _error = error;
      logger.error(error);
      setInput(originalInput);
      setPromptEnhanced(false);
    } finally {
      if (_error) logger.error(_error);

      setEnhancingPrompt(false);

      setTimeout(() => {
        setInput(_input);
      });
    }
  };

  return { enhancingPrompt, promptEnhanced, enhancePrompt, resetEnhancer };
}
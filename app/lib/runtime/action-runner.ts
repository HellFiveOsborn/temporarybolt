import { WebContainer } from '@webcontainer/api';
import { map, type MapStore } from 'nanostores';
import * as nodePath from 'node:path';
import type { BoltAction } from '~/types/actions';
import { createScopedLogger } from '~/utils/logger';
import { unreachable } from '~/utils/unreachable';
import type { ActionCallbackData } from './message-parser';

const logger = createScopedLogger('ActionRunner');
const portRegex = /(?:(?:listening|running|serving|started|available)(?:\s+(?:on|at))|\s*(?:http:\/\/)?(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1?\])|\s*(?:https?:\/\/)?(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,})(?::|\s+port\s+)?(\d+)(?:\/)?/gmi;

export type ActionStatus = 'pending' | 'running' | 'complete' | 'aborted' | 'failed';

// Adicionar interface para o output handler
export interface OutputHandler {
  write: (data: string) => void;
}

export type BaseActionState = BoltAction & {
  status: Exclude<ActionStatus, 'failed'>;
  abort: () => void;
  executed: boolean;
  abortSignal: AbortSignal;
};

export type FailedActionState = BoltAction &
  Omit<BaseActionState, 'status'> & {
    status: Extract<ActionStatus, 'failed'>;
    error: string;
  };

export type ActionState = BaseActionState | FailedActionState;

type BaseActionUpdate = Partial<Pick<BaseActionState, 'status' | 'abort' | 'executed'>>;

export type ActionStateUpdate =
  | BaseActionUpdate
  | (Omit<BaseActionUpdate, 'status'> & { status: 'failed'; error: string });

type ActionsMap = MapStore<Record<string, ActionState>>;

export class ActionRunner {
  #webcontainer: Promise<WebContainer>;
  #currentExecutionPromise: Promise<void> = Promise.resolve();
  #outputHandler?: OutputHandler;

  actions: ActionsMap = map({});

  constructor(webcontainerPromise: Promise<WebContainer>) {
    this.#webcontainer = webcontainerPromise;
  }

  // Adicionar método para configurar o output handler
  setOutputHandler(handler: OutputHandler) {
    this.#outputHandler = handler;
  }

  addAction(data: ActionCallbackData) {
    const { actionId } = data;

    const actions = this.actions.get();
    const action = actions[actionId];

    // action already added
    if (action) return;

    const abortController = new AbortController();

    this.actions.setKey(actionId, {
      ...data.action,
      status: 'pending',
      executed: false,
      abort: () => {
        abortController.abort();
        this.#updateAction(actionId, { status: 'aborted' });
      },
      abortSignal: abortController.signal,
    });

    this.#currentExecutionPromise.then(() => {
      this.#updateAction(actionId, { status: 'running' });
    });
  }

  async runAction(data: ActionCallbackData) {
    const { actionId } = data;
    const action = this.actions.get()[actionId];

    const webcontainer = await this.#webcontainer;

    if (!action) unreachable(`Action ${actionId} not found`);
    if (action.executed) return;

    let checkFileUpdate = {};
    try {
      if (action.type === 'file' && await webcontainer.fs.readFile(action?.filePath)) {
        checkFileUpdate = {
          update: true
        }
      }
    } catch (err) {

    }

    this.#updateAction(actionId, { ...action, ...data.action, ...checkFileUpdate, executed: true });

    this.#currentExecutionPromise = this.#currentExecutionPromise
      .then(() => {
        return this.#executeAction(actionId);
      })
      .catch((error) => {
        console.error('Action failed:', error);
      });
  }

  async #executeAction(actionId: string) {
    const action = this.actions.get()[actionId];

    this.#updateAction(actionId, { status: 'running' });

    try {
      switch (action.type) {
        case 'shell': {
          await this.#runShellAction(action, actionId);
          break;
        }
        case 'file': {
          await this.#runFileAction(action);
          break;
        }
      }

      this.#updateAction(actionId, { status: action.abortSignal.aborted ? 'aborted' : 'complete' });
    } catch (error) {
      this.#updateAction(actionId, { status: 'failed', error: 'Action failed' });

      // re-throw the error to be caught in the promise chain
      throw error;
    }
  }

  async #runShellAction(action: ActionState, actionId: string) {
    if (action.type !== 'shell') unreachable('Expected shell action');
    const webcontainer = await this.#webcontainer;
    const isNpmRun = action.content.includes('npm run') || action.content.includes('yarn run') || action.content.includes('pnpm run');

    function stripAnsi(str: string) {
      return str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
    }

    const process = await webcontainer.spawn('jsh', ['-c', action.content, '-y'], { // -y permite a execução sem confirmação
      env: { npm_config_yes: true },
    });

    action.abortSignal.addEventListener('abort', () => {
      process.kill();
    });

    let errorOutput = '';
    let needsConfirmation = false;
    let applicationRunning = false;

    // Modificar para usar o output handler, capturar erros e lidar com confirmações
    process.output.pipeTo(
      new WritableStream({
        write: async (data) => {
          if (this.#outputHandler) this.#outputHandler.write(data);

          // Capturar possíveis mensagens de erro
          if (data.toLowerCase().includes('error') || data.toLowerCase().includes('exception') || data.toLowerCase().includes('err!')) {
            errorOutput += data;
          }

          // Detectar se é necessária uma confirmação
          if (data.includes('y/N') || data.includes('Yes/no')) {
            needsConfirmation = true;

            // Esperar um curto período antes de enviar a resposta
            await new Promise(resolve => setTimeout(resolve, 500));

            // Enviar resposta automática (neste caso, 'n' para não)
            await process.input.getWriter().write('y\n');

            if (this.#outputHandler) this.#outputHandler.write('Automatic response: n\n');
          }

          if (isNpmRun) {
            const portMatch = stripAnsi(data).trim().match(portRegex);
            if (portMatch) {
              const port = portMatch[0];
              applicationRunning = true;
              this.#updateAction(actionId, { status: 'complete' });
              logger.debug(`Application detected running on ${port}`);
            } else if (data.includes('Compiled successfully') || data.includes('Build completed')) {
              applicationRunning = true;
              this.#updateAction(actionId, { status: 'complete' });
              logger.debug('Application build completed successfully');
            }
          }
        },
      }),
    );

    const exitCode = await process.exit;

    logger.debug(`Process terminated with code ${exitCode} | ${action.content}`);

    // Lidar com erros
    if (exitCode !== 0 || errorOutput) {
      const errorMessage = errorOutput || `Process exited with non-zero code: ${exitCode}`;
      logger.error('Shell action error:', errorMessage);

      // Atualizar o estado da ação com o erro
      this.#updateAction(actionId, {
        status: 'failed',
        error: errorMessage
      });

      if (this.#outputHandler) {
        this.#outputHandler.write(`\r\nError: ${errorMessage}\r\n`);
      }
    } else {
      // Se não houve erro, marcar como completo
      this.#updateAction(actionId, { status: 'complete' });
    }

    // Adicionar informação sobre confirmação automática, se aplicável
    if (needsConfirmation && this.#outputHandler) {
      this.#outputHandler.write('\r\nNote: An automatic confirmation was provided during this process.\r\n');
    }
  }

  async #runFileAction(action: ActionState) {
    if (action.type !== 'file') unreachable('Expected file action');

    const webcontainer = await this.#webcontainer;

    let folder = nodePath.dirname(action.filePath);

    // remove trailing slashes
    folder = folder.replace(/\/+$/g, '');

    if (folder !== '.') {
      try {
        await webcontainer.fs.mkdir(folder, { recursive: true });
        logger.debug('Created folder', folder);
      } catch (error) {
        logger.error('Failed to create folder\n\n', error);
      }
    }

    // console.log(action.content)

    try {
      await webcontainer.fs.writeFile(action.filePath, action.content.trim());
      logger.debug(`File written ${action.filePath}`);
    } catch (error) {
      logger.error('Failed to write file\n\n', error);
    }
  }

  #updateAction(id: string, newState: ActionStateUpdate) {
    const actions = this.actions.get();

    this.actions.setKey(id, { ...actions[id], ...newState });
  }
}

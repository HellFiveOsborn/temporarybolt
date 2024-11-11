import { memo, useState, useEffect, useCallback } from 'react';
import { Dialog, DialogTitle, DialogRoot } from './Dialog';
import { IconButton } from './IconButton';
import { useCookies } from 'react-cookie';
import { Switch } from './Switch';
import { db, deleteAll } from '~/lib/persistence';
import { toast } from 'react-toastify';

interface SettingsProps {
    className?: string;
}

type SettingsView = 'general' | 'editor' | 'models';

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

interface ModelResponse {
    model: string;
    providers: Provider[];
}

const Settings = memo(({ className }: SettingsProps) => {
    const [cookies, setCookies] = useCookies([
        'uid',
        'model',
        'enhancerModel',
        'autocompleteModel',
        'autocompleteEnabled'
    ]);
    const [open, setOpen] = useState(false);
    const [currentView, setCurrentView] = useState<SettingsView>('general');
    const [providers, setProviders] = useState<Provider[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentModel, setCurrentModel] = useState<string>('');
    const [enhancerModel, setEnhancerModel] = useState<string>('');
    const [autocompleteModel, setAutocompleteModel] = useState<string>('');

    // Check if autocomplete is enabled
    const [autocompleteEnabled, setAutocompleteEnabled] = useState(cookies.autocompleteEnabled == true);

    const [confirmDelete, setConfirmDelete] = useState(false);

    useEffect(() => {
        const fetchModels = async () => {
            try {
                const res = await fetch(`${process.env.BASE_URL || "http://localhost:5173"}/api/model/get`, {
                    method: "POST",
                    body: new URLSearchParams({ uid: cookies.uid }),
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                });

                const data = await res.json() as ModelResponse;
                setProviders(data.providers);
                setCurrentModel(data.model);
                // Set enhancer model default value
                setEnhancerModel(cookies.enhancerModel || '');
                setAutocompleteModel(cookies.autocompleteModel || '');
            } catch (error) {
                console.error('Error fetching models:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchModels();
    }, [cookies.uid, cookies.enhancerModel]);

    const handleDeleteAllChats = useCallback((event: React.UIEvent) => {
        event.preventDefault();
        setConfirmDelete(true);
    }, []);

    const confirmDeleteAllChats = useCallback(() => {
        deleteAll(db as IDBDatabase);
        setConfirmDelete(false);
        toast.success('All chats deleted');
        setTimeout(() => window.location.reload(), 1000);
    }, []);

    const cancelDeleteAllChats = useCallback(() => {
        setConfirmDelete(false);
    }, []);
    /**
     * Sets the current model to the given model id and updates the
     * corresponding cookie.
     * @param {string} modelId The id of the model to set.
     */
    const handleModelChange = async (modelId: string) => {
        try {
            await fetch(`${process.env.BASE_URL || "http://localhost:5173"}/api/model/set`, {
                method: "POST",
                body: new URLSearchParams({ model: modelId, uid: cookies.uid }),
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
            });
            setCurrentModel(modelId);
            setCookies("model", modelId, { path: '/' });
        } catch (error) {
            console.error('Error setting model:', error);
        }
    };

    const handleEnhancerModelChange = (modelId: string) => {
        setEnhancerModel(modelId);
        setCookies("enhancerModel", modelId, { path: '/' });
    };

    const handleAutocompleteModelChange = (modelId: string) => {
        setAutocompleteModel(modelId);
        setCookies("autocompleteModel", modelId, { path: '/' });
    };

    const handleAutocompleteToggle = (enabled: boolean) => {
        setAutocompleteEnabled(enabled);
        setCookies("autocompleteEnabled", enabled.toString(), { path: '/' });
    };

    const MenuButton = ({
        icon,
        label,
        view
    }: {
        icon: string;
        label: string;
        view: SettingsView
    }) => (
        <button
            className={`flex items-center gap-2 w-full px-4 py-2 rounded-lg text-sm ${currentView === view
                ? 'bg-bolt-elements-item-backgroundActive'
                : 'bg-transparent hover:bg-bolt-elements-item-backgroundActive'
                }`}
            onClick={() => setCurrentView(view)}
        >
            <span className={`${icon} text-lg`} />
            {label}
        </button>
    );

    const ModelSelect = ({
        label,
        value,
        onChange
    }: {
        label: string;
        value: string;
        onChange: (value: string) => void
    }) => (
        <div className="flex flex-row justify-between items-center text-sm w-full min-h-[35px]">
            <label className="text-bolt-elements-textSecondary">
                {label}
            </label>
            <select
                className="h-[35px] bg-bolt-elements-background-depth-3 text-bolt-elements-textSecondary px-4 rounded-lg focus:outline-none w-[50%]"
                value={value}
                onChange={(e) => onChange(e.target.value)}
            >
                <option value="">Select a model</option>
                {providers.map(provider => (
                    <optgroup key={provider.name} label={`${provider.name} Models`}>
                        {provider.models.map(model => (
                            <option key={model.id} value={`${provider.name}@${model.id}`}>
                                {model.name}
                                {model.vision ? ' 👁️' : ''}
                                {` (${model.contextWindow?.toLocaleString()} tokens)`}
                            </option>
                        ))}
                    </optgroup>
                ))}
            </select>
        </div>
    );

    const NoModelsMessage = () => (
        <div className="text-bolt-elements-textSecondary text-sm">
            No AI models configured. Please contact your administrator.
        </div>
    );

    return (
        <DialogRoot open={open} onOpenChange={setOpen}> {/* @ts-ignore */}
            <IconButton
                icon="i-ph:gear-six-duotone"
                onClick={() => setOpen(true)}
                className={`flex items-center gap-2 p-2 rounded-lg bg-transparent hover:bg-bolt-elements-item-backgroundHover text-bolt-elements-textSecondary ${className}`}
            >
                <span className="i-ph:gear-six-duotone text-lg"></span>
                Settings
            </IconButton>

            {open && (
                <Dialog
                    className="max-w-[700px] max-h-[85vh] w-[90vw]"
                    onClose={() => setOpen(false)}
                >
                    <DialogTitle className='!hidden'></DialogTitle>
                    <div className="text-bolt-elements-textPrimary text-md">
                        <div className="flex h-[400px]">
                            <aside className="bg-bolt-elements-background-depth-1 border-r border-bolt-elements-borderColor p-4 min-w-[25%] space-y-1.5">
                                <MenuButton
                                    icon="i-ph:gear-six"
                                    label="General"
                                    view="general"
                                />
                                <MenuButton
                                    icon="i-ph:code"
                                    label="Editor"
                                    view="editor"
                                />
                                <MenuButton
                                    icon="i-ph:brain"
                                    label="Models"
                                    view="models"
                                />
                            </aside>
                            <div className="flex-1 p-6">
                                <div>
                                    <h2 className="text-lg font-medium mb-4 capitalize">{currentView}</h2>
                                    {currentView === 'general' && (
                                        <div className="flex flex-col gap-4">
                                            <div className="flex flex-row justify-between items-center text-sm w-full min-h-[35px]">
                                                <span className="text-bolt-elements-textSecondary">Delete all chats</span>
                                                <button
                                                    className="inline-flex h-[35px] items-center justify-center rounded-lg px-4 text-sm leading-none focus:outline-none gap-2 disabled:cursor-not-allowed bg-bolt-elements-button-danger-background text-bolt-elements-button-danger-text enabled:hover:bg-bolt-elements-button-danger-backgroundHover"
                                                    onClick={handleDeleteAllChats}
                                                >
                                                    Delete all
                                                </button>
                                            </div>
                                            {confirmDelete && (
                                                <div className="flex flex-col justify-center gap-4 bg-bolt-elements-background-depth-2 p-4 rounded-lg absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/5 h-50 border border-bolt-elements-borderColor shadow-2xl">
                                                    <h3 className="text-lg font-medium">Delete all chats</h3>
                                                    <p className="text-bolt-elements-textSecondary">Are you sure you want to delete all chats? This action cannot be undone.</p>
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            className="inline-flex h-[35px] items-center justify-center rounded-lg px-4 text-sm leading-none focus:outline-none gap-2 bg-bolt-elements-button-secondary-background text-bolt-elements-button-secondary-text enabled:hover:bg-bolt-elements-button-secondary-backgroundHover"
                                                            onClick={cancelDeleteAllChats}
                                                        >
                                                            Cancel
                                                        </button>
                                                        <button
                                                            className="inline-flex h-[35px] items-center justify-center rounded-lg px-4 text-sm leading-none focus:outline-none gap-2 bg-bolt-elements-button-danger-background text-bolt-elements-button-danger-text enabled:hover:bg-bolt-elements-button-danger-backgroundHover"
                                                            onClick={confirmDeleteAllChats}
                                                        >
                                                            Confirm Delete
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {currentView === 'editor' && (
                                        <div className="flex flex-col gap-6">
                                            <div className="flex flex-row justify-between items-center text-sm w-full">
                                                <span className="text-bolt-elements-textSecondary">Enable Autocomplete</span>
                                                <Switch
                                                    checked={autocompleteEnabled}
                                                    onCheckedChange={handleAutocompleteToggle}
                                                />
                                            </div>
                                            {autocompleteEnabled && (
                                                <ModelSelect
                                                    label="Autocomplete Model"
                                                    value={autocompleteModel}
                                                    onChange={handleAutocompleteModelChange}
                                                />
                                            )}
                                        </div>
                                    )}

                                    {currentView === 'models' && (
                                        <div className="flex flex-col gap-6">
                                            {loading ? (
                                                <div className="text-sm text-bolt-elements-textSecondary">
                                                    Loading models...
                                                </div>
                                            ) : providers.length > 0 ? (
                                                <>
                                                    <ModelSelect
                                                        label="Select Model"
                                                        value={currentModel}
                                                        onChange={handleModelChange}
                                                    />
                                                    <ModelSelect
                                                        label="Enhancer Prompt Model"
                                                        value={enhancerModel}
                                                        onChange={handleEnhancerModelChange}
                                                    />
                                                </>
                                            ) : (
                                                <NoModelsMessage />
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </Dialog>
            )}
        </DialogRoot>
    );
});

export default Settings;
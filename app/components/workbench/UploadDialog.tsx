// app/components/workbench
import React, { useCallback, useState, useEffect } from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { Progress as ProgressBar } from '@radix-ui/react-progress';
import { Dialog, DialogRoot, DialogTitle, DialogDescription } from '../../components/ui/Dialog';
import { IconButton } from '../ui/IconButton';
import { workbenchStore } from '~/lib/stores/workbench';

interface UploadDialogProps {
    className?: string;
    disabled?: boolean;
}

const UploadDialog = ({ className, disabled = false }: UploadDialogProps) => {
    const [open, setOpen] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [folders, setFolders] = useState<string[]>(['/']);
    const [selectedFolder, setSelectedFolder] = useState('/');
    const [isDragging, setIsDragging] = useState(false);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        if (open) loadFolders();
    }, [open]);

    const loadFolders = useCallback(async () => {
        try {
            const result = await workbenchStore.getFolders();
            setFolders(result);
        } catch (error) {
            console.error('Error loading folders:', error);
        }
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);

        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) {
            setFile(droppedFile);
        }
    }, []);

    const handleFileSelect = (e: any) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) setFile(selectedFile);
    };

    const handleUpload = async () => {
        if (!file || !(await workbenchStore.getFolders()).length) return;

        setUploading(true);
        try {
            const filePath = `${selectedFolder}`.replace(/\/+/g, '/');
            await workbenchStore.uploadFile(file, filePath);
            setOpen(false);
            setFile(null);
        } catch (error) {
            console.error('Error uploading file:', error);
        } finally {
            setUploading(false);
        }
    };

    const handleClearFile = () => {
        setFile(null);
    };

    return (
        <DialogRoot open={open} onOpenChange={() => { setOpen(false); handleClearFile() }}>
            <IconButton
                icon="i-humbleicons:upload"
                title="Upload File"
                className="ml-auto"
                size="lg"
                disabled={disabled}
                onClick={() => setOpen(true)}
            />
            {open && (
                <Dialog className="w-[32rem]">
                    <DialogTitle>Upload File</DialogTitle>
                    <DialogDescription>
                        <div className="p-4 text-bolt-elements-textPrimary">
                            {!file ? (
                                <div
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                    className={`border-2 border-dashed border-bolt-elements-boderColor rounded-lg p-8 flex flex-col items-center justify-center ${isDragging ? 'border-blue-500 bg-blue-50' : ''} transition-all duration-200`}
                                >
                                    <div className="i-ph:upload h-12 w-12 text-gray-400 mb-4"></div>
                                    <p className="text-sm text-gray-600 mb-2">
                                        Drag and drop your file here, or
                                    </p>
                                    <label className="cursor-pointer text-blue-500 hover:text-blue-600">
                                        browse
                                        <input
                                            type="file"
                                            className="hidden"
                                            onChange={handleFileSelect}
                                        />
                                    </label>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex items-start space-x-4 p-4 border border-bolt-elements-boderColor transition-border rounded-lg relative">
                                        <div className="i-ph:file h-10 w-10 text-blue-500 flex-shrink-0"></div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-bolt-elements-textPrimary truncate">
                                                {file.name}
                                            </p>
                                            <p className="text-sm text-bolt-elements-textSecondary">
                                                {(file.size / 1024).toFixed(2)} KB
                                            </p>
                                        </div>
                                        {uploading && (
                                            <ProgressBar className="absolute top-0 left-0 w-full h-1 bg-blue-500" value={50} />
                                        )}
                                        <IconButton
                                            size='md'
                                            icon="i-ph:x"
                                            onClick={handleClearFile}
                                            className="text-bolt-elements-textPrimary hover:text-bolt-elements-textSecondary"
                                            disabled={uploading}
                                        ></IconButton>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-bolt-elements-textPrimary mb-1">
                                            Upload to folder
                                        </label>
                                        <select
                                            value={selectedFolder}
                                            onChange={(e) => setSelectedFolder(e.target.value)}
                                            className="w-full px-3 py-2 border border-bolt-elements-boderColor transition-border rounded-md text-sm"
                                        >
                                            {folders.map((folder) => (
                                                <option key={folder} value={folder}>
                                                    {folder}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="flex justify-end">
                                        <button
                                            onClick={handleUpload}
                                            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm w-full"
                                            disabled={uploading}
                                        >
                                            Upload
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </DialogDescription>
                </Dialog>
            )}
        </DialogRoot>
    );
};

export default UploadDialog;
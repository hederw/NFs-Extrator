import React, { useState, useCallback, useRef } from 'react';
import { UploadIcon } from './icons/UploadIcon';

interface FileUploaderProps {
  onFilesSelected: (files: FileList) => void;
  fileCount: number;
  compact?: boolean;
  allowMultiple?: boolean;
}

const FileUploader: React.FC<FileUploaderProps> = ({ onFilesSelected, fileCount, compact = false, allowMultiple = true }) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(e.target.files);
       // Reset the input value to allow selecting the same file again after clearing
      if(inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  const handleDragEvents = (e: React.DragEvent<HTMLDivElement>, dragState: boolean) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(dragState);
  };
  
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
      handleDragEvents(e, false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          onFilesSelected(e.dataTransfer.files);
          e.dataTransfer.clearData();
      }
  }, [onFilesSelected]);

  const triggerFileSelect = () => {
      inputRef.current?.click();
  }

  const baseClasses = "flex flex-col justify-center items-center w-full border-2 border-dashed rounded-lg cursor-pointer transition-colors";
  const compactClasses = "px-4 py-6 text-center";
  const fullClasses = "px-6 py-10";
  const draggingClasses = 'border-blue-400 bg-gray-700';
  const normalClasses = 'border-gray-600 bg-gray-700/50 hover:bg-gray-700';

  return (
    <div
      onDragEnter={(e) => handleDragEvents(e, true)}
      onDragLeave={(e) => handleDragEvents(e, false)}
      onDragOver={(e) => handleDragEvents(e, true)}
      onDrop={handleDrop}
      onClick={triggerFileSelect}
      className={`${baseClasses} ${compact ? compactClasses : fullClasses} ${isDragging ? draggingClasses : normalClasses}`}
    >
      <input ref={inputRef} id="dropzone-file" type="file" className="hidden" accept=".pdf" multiple={allowMultiple} onChange={handleFileChange} />
       <UploadIcon compact={compact} />
        <p className={`mb-2 text-sm text-gray-400 ${compact ? 'text-xs' : ''}`}>
            <span className="font-semibold">Clique para enviar</span> ou arraste
        </p>
       {!compact && <p className="text-xs text-gray-500">Arquivos PDF</p>}
       {fileCount > 0 && <span className="text-xs text-blue-300 mt-1">({fileCount} selecionado(s))</span>}
    </div>
  );
};

export default FileUploader;
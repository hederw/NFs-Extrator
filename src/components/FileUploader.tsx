import React, { useState, useCallback, useRef } from 'react';
import { UploadIcon } from './icons/UploadIcon';
import { FileIcon } from './icons/FileIcon'; // Assuming you'll create this icon

interface FileUploaderProps {
  onFilesSelected: (files: FileList) => void;
  onClear: () => void;
}

const FileUploader: React.FC<FileUploaderProps> = ({ onFilesSelected, onClear }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(e.target.files);
      setFileNames(Array.from(e.target.files).map((f: File) => f.name));
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
          setFileNames(Array.from(e.dataTransfer.files).map((f: File) => f.name));
          e.dataTransfer.clearData();
      }
  }, [onFilesSelected]);

  const handleClear = () => {
    setFileNames([]);
    onClear();
    if (inputRef.current) {
        inputRef.current.value = '';
    }
  };

  const triggerFileSelect = () => {
      inputRef.current?.click();
  }


  return (
    <div
      onDragEnter={(e) => handleDragEvents(e, true)}
      onDragLeave={(e) => handleDragEvents(e, false)}
      onDragOver={(e) => handleDragEvents(e, true)}
      onDrop={handleDrop}
      onClick={triggerFileSelect}
      className={`flex flex-col justify-center items-center w-full px-6 py-10 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
        isDragging ? 'border-blue-400 bg-gray-700' : 'border-gray-600 bg-gray-700/50 hover:bg-gray-700'
      }`}
    >
      <input ref={inputRef} id="dropzone-file" type="file" className="hidden" accept=".pdf" multiple onChange={handleFileChange} />
      {fileNames.length === 0 ? (
         <>
            <UploadIcon />
            <p className="mb-2 text-sm text-gray-400">
                <span className="font-semibold">Clique para enviar</span> ou arraste e solte
            </p>
            <p className="text-xs text-gray-500">Arquivos PDF</p>
         </>
      ) : (
        <div className="w-full text-sm text-gray-300" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-2">
                <h4 className="font-semibold text-lg">{fileNames.length} arquivo(s) selecionado(s)</h4>
                 <button
                    onClick={handleClear}
                    className="text-xs text-red-400 hover:text-white hover:bg-red-500 font-semibold py-1 px-2 rounded-md transition-colors flex items-center"
                    aria-label="Limpar arquivos selecionados"
                >
                    Limpar
                </button>
            </div>
            <div className="max-h-32 overflow-y-auto bg-gray-800/80 p-3 rounded-md space-y-2">
              {fileNames.map((name, index) => (
                <div key={index} className="flex items-center gap-2 bg-gray-900/50 p-2 rounded">
                    <FileIcon />
                    <span className="truncate flex-grow" title={name}>{name}</span>
                </div>
              ))}
            </div>
        </div>
      )}
    </div>
  );
};

export default FileUploader;
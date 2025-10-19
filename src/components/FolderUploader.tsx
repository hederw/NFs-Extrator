import React, { useState, useRef, useMemo } from 'react';
import { UploadIcon } from './icons/UploadIcon';
import { FileIcon } from './icons/FileIcon';
import { ExcelIcon } from './icons/ExcelIcon';

interface FolderUploaderProps {
  onFilesSelected: (files: FileList) => void;
  onClear: () => void;
}

const FolderUploader: React.FC<FolderUploaderProps> = ({ onFilesSelected, onClear }) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(e.target.files);
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  const handleClear = () => {
    setSelectedFiles([]);
    onClear();
    if (inputRef.current) {
        inputRef.current.value = '';
    }
  };

  const triggerFolderSelect = () => {
      inputRef.current?.click();
  }

  const { pdfs, excels, folderName } = useMemo(() => {
    if (selectedFiles.length === 0) {
        return { pdfs: [], excels: [], folderName: '' };
    }
    const pdfs = selectedFiles.filter(f => f.name.toLowerCase().endsWith('.pdf'));
    const excels = selectedFiles.filter(f => f.name.toLowerCase().match(/\.(xlsx|xls)$/));
    
    let folderName = 'Diretório';
    // All files from a directory selection share the same top-level directory in their path.
    if (selectedFiles[0]?.webkitRelativePath) {
        folderName = selectedFiles[0].webkitRelativePath.split('/')[0];
    } else {
        folderName = 'Arquivos Selecionados'
    }

    return { pdfs, excels, folderName };
  }, [selectedFiles]);

  return (
    <div
      onClick={triggerFolderSelect}
      className="flex flex-col justify-center items-center w-full p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors border-gray-600 bg-gray-700/50 hover:bg-gray-700 hover:border-blue-400"
    >
      <input 
        ref={inputRef} 
        type="file" 
        className="hidden" 
        onChange={handleFileChange}
        // These attributes enable folder selection
        webkitdirectory="" 
        mozdirectory=""
        directory=""
        multiple
      />
      {selectedFiles.length === 0 ? (
         <div className="text-center">
            <UploadIcon />
            <p className="mb-2 text-sm text-gray-400">
                <span className="font-semibold">Clique para selecionar uma pasta</span>
            </p>
            <p className="text-xs text-gray-500">O app irá buscar por arquivos PDF e XLS/XLSX</p>
         </div>
      ) : (
        <div className="w-full text-sm text-gray-300" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
                <h4 className="font-semibold text-lg truncate" title={folderName}>Pasta: {folderName}</h4>
                 <button
                    onClick={handleClear}
                    className="text-xs text-red-400 hover:text-white hover:bg-red-500 font-semibold py-1 px-2 rounded-md transition-colors flex items-center"
                    aria-label="Limpar pasta selecionada"
                >
                    Limpar
                </button>
            </div>
            <div className="bg-gray-800/80 p-3 rounded-md space-y-2 border border-gray-700">
                <div className="flex items-center gap-2 bg-gray-900/50 p-2 rounded">
                    <FileIcon />
                    <span className="truncate flex-grow">{pdfs.length} arquivo(s) PDF encontrado(s)</span>
                </div>
                <div className="flex items-center gap-2 bg-gray-900/50 p-2 rounded">
                    <ExcelIcon />
                    <span className="truncate flex-grow" title={excels.map(f => f.name).join(', ')}>
                        {excels.length > 0 ? `${excels.length} gabarito(s) XLS encontrado(s). Usando '${excels[0].name}'.` : `Nenhum gabarito XLS encontrado.`}
                    </span>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default FolderUploader;

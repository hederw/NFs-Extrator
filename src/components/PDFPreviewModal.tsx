import React, { useState, useEffect } from 'react';
import Spinner from './Spinner';

interface PDFPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: File | null;
}

const PDFPreviewModal: React.FC<PDFPreviewModalProps> = ({ isOpen, onClose, file }) => {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !file) {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
        setPdfUrl(null);
      }
      return;
    }

    setIsLoading(true);
    setError(null);
    
    const objectUrl = URL.createObjectURL(file);
    setPdfUrl(objectUrl);
    setIsLoading(false); // URL is created synchronously, so loading is very fast

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [isOpen, file]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <header className="flex justify-between items-center p-4 border-b border-gray-700 flex-shrink-0">
            <h2 className="text-xl font-bold text-blue-300 truncate" title={file?.name}>{file?.name || 'Visualizador de PDF'}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl font-bold" aria-label="Fechar">&times;</button>
        </header>
        <main className="flex-grow relative bg-gray-900">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-white"><Spinner /> <p className="mt-2">Carregando PDF...</p></div>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <div className="text-center text-red-400">
                <p className="font-semibold">Erro ao carregar o arquivo</p>
                <p className="text-sm mt-1">{error}</p>
              </div>
            </div>
          )}
          {pdfUrl && !error && (
            <embed
              src={pdfUrl}
              type="application/pdf"
              className={`w-full h-full border-0 transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
              title={`Visualizador de PDF para ${file?.name}`}
            />
          )}
        </main>
      </div>
    </div>
  );
};

export default PDFPreviewModal;
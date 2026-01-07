
import React, { useState, useCallback } from 'react';
import FolderUploader from '../FolderUploader';
import ResultsTable from '../ResultsTable';
import Spinner from '../Spinner';
import { extractInvoiceDataFromImage } from '../../services/geminiService';
import { useDailyCounter } from '../../hooks/useDailyCounter';
import { ExcelIcon } from '../icons/ExcelIcon';
import { DownloadIcon } from '../icons/DownloadIcon';
import type { Layout, ExtractionResult, InvoiceData, ValidationResult, GroundTruth } from '../../types';

declare const pdfjsLib: any;
declare const XLSX: any;
declare const JSZip: any;

interface BatchExtractTabProps {
    selectedLayout: Layout | undefined;
    onOpenLayoutModal: () => void;
    results: ExtractionResult[];
    setResults: React.Dispatch<React.SetStateAction<ExtractionResult[]>>;
    totalLiquidValue: number;
    hasSuccessfulResults: boolean;
    onExtractionComplete: () => void;
    files: File[];
    setFiles: React.Dispatch<React.SetStateAction<File[]>>;
    folderName: string;
    setFolderName: React.Dispatch<React.SetStateAction<string>>;
    validationStatus: Record<string, ValidationResult> | null;
    setValidationStatus: React.Dispatch<React.SetStateAction<Record<string, ValidationResult> | null>>;
    contasAPagar: GroundTruth;
    setContasAPagar: React.Dispatch<React.SetStateAction<GroundTruth>>;
    razaoLoja: GroundTruth;
    setRazaoLoja: React.Dispatch<React.SetStateAction<GroundTruth>>;
}

const BatchExtractTab: React.FC<BatchExtractTabProps> = ({
    selectedLayout,
    onOpenLayoutModal,
    results,
    setResults,
    totalLiquidValue,
    hasSuccessfulResults,
    onExtractionComplete,
    files,
    setFiles,
    folderName,
    setFolderName
}) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [dailyCount, incrementDailyCount] = useDailyCounter();

    const convertPdfToImage = async (file: File): Promise<string> => {
        const fileBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: fileBuffer }).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        if (!context) throw new Error('Canvas context error');
        await page.render({ canvasContext: context, viewport: viewport }).promise;
        return canvas.toDataURL('image/png').split(',')[1];
    };

    const handleExtract = useCallback(async () => {
        if (files.length === 0) return;
        setIsProcessing(true);
        setProgress(0);
        
        const initialResults: ExtractionResult[] = files.map(file => ({
            id: `${file.name}-${Date.now()}`,
            file,
            status: 'processing',
        }));
        setResults(initialResults);

        for (let i = 0; i < files.length; i++) {
            const result = initialResults[i];
            try {
                const base64 = await convertPdfToImage(result.file);
                const data = await extractInvoiceDataFromImage(base64, selectedLayout?.prompt);
                setResults(prev => prev.map(r => r.id === result.id ? { ...r, status: 'success', data } : r));
                incrementDailyCount();
            } catch (error: any) {
                setResults(prev => prev.map(r => r.id === result.id ? { ...r, status: 'error', error: error.message } : r));
            } finally {
                setProgress(i + 1);
            }
        }
        setIsProcessing(false);
        onExtractionComplete();
    }, [files, selectedLayout, incrementDailyCount, setResults, onExtractionComplete]);

    const handleFolderSelection = (fileList: FileList) => {
        const allFiles = Array.from(fileList);
        const pdfs = allFiles.filter(f => f.name.toLowerCase().endsWith('.pdf'));
        setFiles(pdfs);
    };

    return (
        <div className="flex flex-col gap-8 animate-fade-in">
            <section className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-xl">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="space-y-4">
                        <h2 className="text-xl font-bold text-blue-400">1. Configurar IA</h2>
                        <button onClick={onOpenLayoutModal} className="w-full text-left p-4 bg-gray-700 hover:bg-gray-600 rounded-lg border border-gray-600 transition-colors">
                            <p className="text-xs text-gray-400 uppercase font-bold">Layout Selecionado</p>
                            <p className="text-blue-300 font-semibold truncate">{selectedLayout?.name || 'Selecione um layout...'}</p>
                        </button>
                        <button 
                            onClick={handleExtract}
                            disabled={isProcessing || files.length === 0}
                            className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-bold rounded-lg shadow-lg transition-all flex items-center justify-center gap-2"
                        >
                            {isProcessing ? <><Spinner /> {progress}/{files.length}</> : 'Iniciar Processamento'}
                        </button>
                    </div>

                    <div className="md:col-span-2 space-y-4">
                        <h2 className="text-xl font-bold text-blue-400">2. Upload de Arquivos</h2>
                        <FolderUploader 
                            onFilesSelected={handleFolderSelection} 
                            onClear={() => { setFiles([]); setResults([]); }} 
                            onFolderNameDetected={setFolderName} 
                        />
                    </div>
                </div>
            </section>

            {results.length > 0 && (
                <section className="bg-gray-800 rounded-xl border border-gray-700 shadow-xl overflow-hidden">
                    <div className="p-6 border-b border-gray-700 flex justify-between items-center">
                        <h2 className="text-xl font-bold text-blue-400">3. Dados Extraídos</h2>
                        <div className="flex gap-3">
                            <span className="text-sm bg-gray-900 px-3 py-1 rounded-full text-gray-400">Total: {totalLiquidValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                        </div>
                    </div>
                    <ResultsTable results={results} setResults={setResults} />
                </section>
            )}
        </div>
    );
};

export default BatchExtractTab;

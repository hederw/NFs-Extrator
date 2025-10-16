import React, { useState, useCallback, useMemo } from 'react';
import FileUploader from '../FileUploader';
import ResultsTable from '../ResultsTable';
import { CogIcon } from '../icons/CogIcon';
import { ExcelIcon } from '../icons/ExcelIcon';
import { DownloadIcon } from '../icons/DownloadIcon';
import { InformationCircleIcon } from '../icons/InformationCircleIcon';
import Spinner from '../Spinner';
import { extractInvoiceDataFromImage } from '../../services/geminiService';
import type { Layout, ExtractionResult } from '../../types';

// Declare pdfjsLib, XLSX, and JSZip from global scope (CDN)
declare const pdfjsLib: any;
declare const XLSX: any;
declare const JSZip: any;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface BatchExtractTabProps {
    layouts: Layout[];
    selectedLayout: Layout | undefined;
    onOpenLayoutModal: () => void;
    results: ExtractionResult[];
    setResults: React.Dispatch<React.SetStateAction<ExtractionResult[]>>;
    onFilePreview: (file: File) => void;
    totalLiquidValue: number;
    hasSuccessfulResults: boolean;
}

const BatchExtractTab: React.FC<BatchExtractTabProps> = ({
    layouts,
    selectedLayout,
    onOpenLayoutModal,
    results,
    setResults,
    onFilePreview,
    totalLiquidValue,
    hasSuccessfulResults
}) => {
    const [files, setFiles] = useState<File[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [apiCallCount, setApiCallCount] = useState(0);

    const convertPdfToImage = async (file: File): Promise<string> => {
        const fileBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: fileBuffer }).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        if (!context) {
            throw new Error('Não foi possível obter o contexto do canvas.');
        }

        await page.render({ canvasContext: context, viewport: viewport }).promise;
        return canvas.toDataURL('image/png').split(',')[1];
    };

     const handleExtract = useCallback(async () => {
        if (files.length === 0 || !selectedLayout) {
            alert('Por favor, selecione arquivos e um layout.');
            return;
        }

        setIsProcessing(true);
        setApiCallCount(0);
        const initialResults: ExtractionResult[] = files.map(file => ({
            id: `${file.name}-${Date.now()}`,
            file,
            status: 'pending',
        }));
        setResults(initialResults);

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            setResults(current => current.map((r, index) => index === i ? { ...r, status: 'processing' } : r));
            setApiCallCount(prev => prev + 1);

            try {
                const base64Image = await convertPdfToImage(file);
                const data = await extractInvoiceDataFromImage(base64Image, selectedLayout.prompt);
                setResults(current => current.map((r, index) => index === i ? { ...r, status: 'success', data } : r));
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
                setResults(current => current.map((r, index) => index === i ? { ...r, status: 'error', error: errorMessage } : r));
            }
            
            if (i < files.length - 1) {
                await delay(6000);
            }
        }

        setIsProcessing(false);
    }, [files, selectedLayout, setResults]);

    const handleExportExcel = () => {
        const successfulResults = results.filter(r => r.status === 'success' && r.data);
        if (successfulResults.length === 0) {
            alert('Não há dados para exportar.');
            return;
        }
        const worksheetData = successfulResults.map(r => ({
            'Nome do Arquivo': r.file.name,
            'Prestador': r.data!.prestador,
            'Número da Nota': r.data!.numeroNota,
            'Data de Emissão': r.data!.dataEmissao,
            'Valor Líquido': r.data!.valorLiquido,
        }));
        const worksheet = XLSX.utils.json_to_sheet(worksheetData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Notas Fiscais');
        XLSX.writeFile(workbook, 'Extracao_Notas_Fiscais.xlsx');
    };

    const handleDownloadRenamed = async () => {
        const successfulResults = results.filter(r => r.status === 'success' && r.data);
        if (successfulResults.length === 0) {
            alert('Não há arquivos para baixar.');
            return;
        }
        const zip = new JSZip();
        for (const result of successfulResults) {
            const newFileName = `NF ${result.data!.numeroNota} OK.pdf`;
            zip.file(newFileName, result.file);
        }
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(zipBlob);
        link.download = 'PDFs_Renomeados.zip';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

     const handleFilesSelected = (selectedFiles: FileList) => {
        setFiles(Array.from(selectedFiles));
        setResults([]);
        setApiCallCount(0);
    };

    const handleClearFiles = () => {
        setFiles([]);
        setResults([]);
        setApiCallCount(0);
    };

    const selectedLayoutName = selectedLayout?.name || "Nenhum layout selecionado";

    return (
        <div className="flex flex-col gap-8">
            <section className="bg-gray-800 p-6 rounded-lg shadow-lg flex flex-col gap-6">
                <div className="flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl font-semibold mb-3 text-blue-300">1. Configuração</h2>
                        <button
                            onClick={onOpenLayoutModal}
                            className="w-full md:w-auto flex items-center justify-center gap-3 px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-lg font-semibold transition-colors"
                        >
                            <CogIcon />
                            <span>Layout: <span className="font-bold text-blue-300">{selectedLayoutName}</span></span>
                        </button>
                    </div>
                     <div 
                       className="bg-gray-800 p-3 rounded-lg flex items-center gap-3 text-sm border border-gray-700"
                       title="As chamadas à API são contadas por arquivo processado na sessão atual. A cota oficial está no seu painel do Google AI Studio."
                    >
                        <InformationCircleIcon />
                        <span>
                            Chamadas à API (sessão): <span className="font-bold text-lg text-blue-300">{apiCallCount}</span>
                        </span>
                    </div>
                </div>

                <div>
                    <h2 className="text-2xl font-semibold mb-3 text-blue-300">2. Upload de Arquivos</h2>
                    <FileUploader onFilesSelected={handleFilesSelected} onClear={handleClearFiles} />
                </div>

                <div>
                    <button
                        onClick={handleExtract}
                        disabled={isProcessing || files.length === 0 || !selectedLayout}
                        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-all text-lg flex items-center justify-center gap-2"
                    >
                        {isProcessing ? <><Spinner /> Processando {apiCallCount} de {files.length}...</> : 'Iniciar Extração em Lote'}
                    </button>
                </div>
            </section>

            <section className="bg-gray-800 p-6 rounded-lg shadow-lg">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-semibold text-blue-300">Resultados da Extração</h2>
                    {hasSuccessfulResults && (
                        <div className="flex gap-2">
                            <button onClick={handleExportExcel} className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-sm font-medium py-2 px-3 rounded-lg transition-colors">
                                <ExcelIcon /> Exportar Excel
                            </button>
                            <button onClick={handleDownloadRenamed} className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-sm font-medium py-2 px-3 rounded-lg transition-colors">
                                <DownloadIcon /> Baixar PDFs
                            </button>
                        </div>
                    )}
                </div>
                <ResultsTable results={results} onFileClick={onFilePreview} />
                {hasSuccessfulResults && (
                    <div className="mt-4 pt-4 border-t border-gray-700 flex justify-end items-center gap-4">
                        <span className="text-gray-400 font-semibold">Valor Líquido Total:</span>
                        <span className="text-xl font-bold text-green-400">
                            {totalLiquidValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                    </div>
                )}
            </section>
        </div>
    );
};

export default BatchExtractTab;

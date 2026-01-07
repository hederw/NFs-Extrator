
import { useState, useMemo, useCallback, useEffect } from 'react';
import useLocalStorage from './hooks/useLocalStorage';
import LayoutModal from './components/LayoutModal';
import BatchExtractTab from './components/tabs/BatchExtractTab';
import CreateLayoutTab from './components/tabs/CreateLayoutTab';
import SavedExtractionsTab from './components/tabs/SavedExtractionsTab';
import DetailedExtractTab from './components/tabs/DetailedExtractTab';
import Spinner from './components/Spinner';
import { extractInvoiceDataFromImage } from './services/geminiService';
import { useDailyCounter } from './hooks/useDailyCounter';
import type { Layout, ExtractionResult, SavedExtractionItem, StoredExtractionResult, GroundTruth, ValidationResult, GlobalProcessingState } from './types';

declare const pdfjsLib: any;

const defaultLayouts: Layout[] = [
    {
        id: 'default-1',
        name: 'Layout Padrão Gemini',
        prompt: 'Extraia o nome do prestador, número da nota, data de emissão e o valor líquido total.',
    },
];

type ActiveTab = 'batch' | 'detailed' | 'create' | 'saved';

const initialGroundTruth: GroundTruth = { file: null, data: [], status: 'idle', message: 'Aguardando arquivo...' };

function App() {
    const [layouts, setLayouts] = useLocalStorage<Layout[]>('invoice-layouts', defaultLayouts);
    const [selectedLayoutId, setSelectedLayoutId] = useState<string>(layouts[0]?.id || '');
    const [isLayoutModalOpen, setIsLayoutModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<ActiveTab>('batch');
    const [savedExtractions, setSavedExtractions] = useLocalStorage<SavedExtractionItem[]>('saved-extractions', []);
    
    // Estados Compartilhados
    const [results, setResults] = useState<ExtractionResult[]>([]);
    const [files, setFiles] = useState<File[]>([]);
    const [folderName, setFolderName] = useState('');
    const [globalProcessing, setGlobalProcessing] = useState<GlobalProcessingState>({
        isActive: false,
        current: 0,
        total: 0,
        filename: ''
    });

    const [dailyCount, incrementDailyCount] = useDailyCounter();
    const [validationStatus, setValidationStatus] = useState<Record<string, ValidationResult> | null>(null);
    const [contasAPagar, setContasAPagar] = useState<GroundTruth>(initialGroundTruth);
    const [razaoLoja, setRazaoLoja] = useState<GroundTruth>(initialGroundTruth);

    // Utilitários de PDF
    const countPdfPages = async (file: File): Promise<number> => {
        try {
            const fileBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: fileBuffer }).promise;
            return pdf.numPages;
        } catch (e) { return 1; }
    };

    const convertPdfPageToImage = async (file: File, pageNum: number): Promise<string> => {
        const fileBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: fileBuffer }).promise;
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        if (!context) throw new Error('Erro no contexto do Canvas');
        await page.render({ canvasContext: context, viewport: viewport }).promise;
        return canvas.toDataURL('image/png').split(',')[1];
    };

    // Lógica de Processamento Global
    const startGlobalExtraction = useCallback(async (filesToProcess: File[], layoutPrompt: string, extractAll: boolean) => {
        if (filesToProcess.length === 0 || globalProcessing.isActive) return;

        setGlobalProcessing({ isActive: true, current: 0, total: 0, filename: 'Preparando arquivos...' });
        setResults([]);

        const tasks: { file: File; page: number; totalPages: number }[] = [];
        for (const file of filesToProcess) {
            const totalPages = await countPdfPages(file);
            if (extractAll) {
                for (let p = 1; p <= totalPages; p++) {
                    tasks.push({ file, page: p, totalPages });
                }
            } else {
                tasks.push({ file, page: 1, totalPages });
            }
        }

        setGlobalProcessing(prev => ({ ...prev, total: tasks.length }));

        const initialResults: ExtractionResult[] = tasks.map(task => ({
            id: `${task.file.name}-p${task.page}-${Date.now()}-${Math.random()}`,
            file: task.file,
            pageNumber: task.page,
            totalPages: task.totalPages,
            status: 'processing',
        }));
        
        setResults(initialResults);
        
        for (let i = 0; i < tasks.length; i++) {
            const task = tasks[i];
            const currentId = initialResults[i].id;
            setGlobalProcessing(prev => ({ ...prev, current: i + 1, filename: task.file.name }));
            
            try {
                const base64 = await convertPdfPageToImage(task.file, task.page);
                const data = await extractInvoiceDataFromImage(base64, layoutPrompt);
                incrementDailyCount();
                setResults(current => current.map(r => r.id === currentId ? { ...r, status: 'success', data } : r));
            } catch (error: any) {
                setResults(current => current.map(r => r.id === currentId ? { ...r, status: 'error', error: error.message } : r));
            }
        }

        setGlobalProcessing(prev => ({ ...prev, isActive: false, filename: 'Concluído!' }));
        
        // Auto-save no histórico ao finalizar
        const currentFolderName = folderName;
        setTimeout(() => handleAutoSaveExtraction(currentFolderName), 500);
    }, [folderName, globalProcessing.isActive, incrementDailyCount]);

    const handleAutoSaveExtraction = (name: string) => {
        setResults(prevResults => {
            const hasSuccess = prevResults.some(r => r.status === 'success');
            if (!hasSuccess) return prevResults;

            const total = prevResults
                .filter(r => r.status === 'success' && r.data && 'valorLiquido' in r.data)
                .reduce((sum, r) => sum + (r.data as any).valorLiquido, 0);

            const storedResults: StoredExtractionResult[] = prevResults.map(r => ({
                id: r.id,
                fileName: r.file.name,
                pageNumber: r.pageNumber,
                status: r.status,
                data: r.data as any,
                error: r.error,
            }));
            
            const newSavedExtraction: SavedExtractionItem = {
                id: `ext-${Date.now()}`,
                name: name ? `Extração: ${name}` : `Lote de ${new Date().toLocaleString('pt-BR')}`,
                timestamp: new Date().toISOString(),
                results: storedResults,
                totalLiquidValue: total,
            };

            setSavedExtractions(prev => [newSavedExtraction, ...prev].slice(0, 20));
            return prevResults;
        });
    };

    const handleLayoutSave = (layout: Omit<Layout, 'id'>, makeActive: boolean = false) => {
        const newLayout = { ...layout, id: `layout-${Date.now()}` };
        setLayouts(prev => [...prev, newLayout]);
        if(makeActive) setSelectedLayoutId(newLayout.id);
        setIsLayoutModalOpen(false);
    };
    
    const handleLayoutSelect = (id: string) => {
        setSelectedLayoutId(id);
        setIsLayoutModalOpen(false);
    }
    
    const handleLayoutDelete = (id: string) => {
        if (window.confirm("Excluir este layout?")) {
            setLayouts(prev => {
                const newLayouts = prev.filter(l => l.id !== id);
                if (selectedLayoutId === id) setSelectedLayoutId(newLayouts[0]?.id || '');
                return newLayouts;
            });
        }
    }

    const totalLiquidValue = useMemo(() => {
        return results
            .filter(r => r.status === 'success' && r.data && 'valorLiquido' in r.data)
            .reduce((sum, r) => sum + (r.data as any).valorLiquido, 0);
    }, [results]);
    
    const selectedLayout = layouts.find(l => l.id === selectedLayoutId);

    return (
        <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-6 lg:p-8 font-sans pb-24">
            <div className="max-w-7xl mx-auto">
                <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">Extrator Fiscal</h1>
                        <p className="text-gray-400 mt-2">Extração inteligente com IA Google Gemini 3 Flash.</p>
                    </div>
                </header>

                <main>
                    <div className="mb-6 border-b border-gray-700">
                        <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
                            {(['batch', 'detailed', 'create', 'saved'] as const).map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`${
                                        activeTab === tab
                                            ? 'border-blue-400 text-blue-300'
                                            : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'
                                    } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm md:text-lg transition-colors`}
                                >
                                    {tab === 'batch' && 'Extração em Lote'}
                                    {tab === 'detailed' && 'Detalhamento Técnico'}
                                    {tab === 'create' && 'Treinar Layout IA'}
                                    {tab === 'saved' && 'Histórico'}
                                </button>
                            ))}
                        </nav>
                    </div>

                    <div className="min-h-[400px]">
                        {activeTab === 'batch' && (
                            <BatchExtractTab 
                                selectedLayout={selectedLayout}
                                onOpenLayoutModal={() => setIsLayoutModalOpen(true)}
                                results={results}
                                setResults={setResults}
                                totalLiquidValue={totalLiquidValue}
                                hasSuccessfulResults={results.some(r => r.status === 'success')}
                                onExtractionComplete={() => {}} // Lógica movida para o startGlobalExtraction
                                files={files}
                                setFiles={setFiles}
                                folderName={folderName}
                                setFolderName={setFolderName}
                                validationStatus={validationStatus}
                                setValidationStatus={setValidationStatus}
                                contasAPagar={contasAPagar}
                                setContasAPagar={setContasAPagar}
                                razaoLoja={razaoLoja}
                                setRazaoLoja={setRazaoLoja}
                                onStartExtraction={(extractAll) => startGlobalExtraction(files, selectedLayout?.prompt || '', extractAll)}
                                isProcessingGlobal={globalProcessing.isActive}
                            />
                        )}
                        {activeTab === 'detailed' && <DetailedExtractTab />}
                        {activeTab === 'create' && (
                           <CreateLayoutTab 
                                onLayoutGenerated={(layout) => {
                                    handleLayoutSave(layout, true);
                                    setActiveTab('batch'); 
                                }}
                           />
                        )}
                        {activeTab === 'saved' && (
                            <SavedExtractionsTab 
                                savedExtractions={savedExtractions}
                                setSavedExtractions={setSavedExtractions}
                            />
                        )}
                    </div>
                </main>
            </div>
            
            {/* Widget de Progresso Global */}
            {(globalProcessing.isActive || (globalProcessing.current > 0 && globalProcessing.current === globalProcessing.total)) && (
                <div className="fixed bottom-6 right-6 w-80 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl p-4 animate-fade-in z-[60] overflow-hidden">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                            {globalProcessing.isActive ? 'Processando em 2º plano' : 'Processamento Concluído'}
                        </span>
                        {globalProcessing.isActive ? <Spinner /> : <span className="text-green-400">✓</span>}
                    </div>
                    <p className="text-sm font-semibold truncate mb-3" title={globalProcessing.filename}>
                        {globalProcessing.filename}
                    </p>
                    <div className="w-full bg-gray-900 rounded-full h-2 mb-2">
                        <div 
                            className="bg-blue-500 h-full transition-all duration-500"
                            style={{ width: `${(globalProcessing.current / globalProcessing.total) * 100}%` }}
                        />
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-500">
                        <span>{globalProcessing.current} de {globalProcessing.total} arquivos</span>
                        <span>{Math.round((globalProcessing.current / globalProcessing.total) * 100)}%</span>
                    </div>
                    {!globalProcessing.isActive && (
                        <button 
                            onClick={() => {
                                setActiveTab('batch');
                                setGlobalProcessing(prev => ({ ...prev, current: 0 }));
                            }}
                            className="mt-3 w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-colors"
                        >
                            Ver Resultados
                        </button>
                    )}
                </div>
            )}

            <LayoutModal
                isOpen={isLayoutModalOpen}
                onClose={() => setIsLayoutModalOpen(false)}
                onSave={handleLayoutSave}
                layouts={layouts}
                selectedLayoutId={selectedLayoutId}
                onSelectLayout={handleLayoutSelect}
                onDeleteLayout={handleLayoutDelete}
            />
        </div>
    );
}

export default App;

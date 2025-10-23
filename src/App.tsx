import { useState, useMemo } from 'react';
import useLocalStorage from './hooks/useLocalStorage';
import LayoutModal from './components/LayoutModal';
import BatchExtractTab from './components/tabs/BatchExtractTab';
import CreateLayoutTab from './components/tabs/CreateLayoutTab';
import SavedExtractionsTab from './components/tabs/SavedExtractionsTab';
import type { Layout, ExtractionResult, SavedExtractionItem, StoredExtractionResult, GroundTruth, ValidationResult } from './types';

const defaultLayouts: Layout[] = [
    {
        id: 'default-1',
        name: 'Layout Padrão (Exemplo)',
        prompt: 'O nome do prestador está no topo. O número da nota fiscal é rotulado como "NFS-e". O valor líquido é "Valor Total dos Serviços". A data de emissão é "Data e Hora de Emissão".',
    },
];

type ActiveTab = 'batch' | 'create' | 'saved';

const initialGroundTruth: GroundTruth = { file: null, data: [], status: 'idle', message: 'Aguardando arquivo...' };

function App() {
    const [layouts, setLayouts] = useLocalStorage<Layout[]>('invoice-layouts', defaultLayouts);
    const [selectedLayoutId, setSelectedLayoutId] = useState<string>(layouts[0]?.id || '');
    const [isLayoutModalOpen, setIsLayoutModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<ActiveTab>('batch');
    const [savedExtractions, setSavedExtractions] = useLocalStorage<SavedExtractionItem[]>('saved-extractions', []);
    
    // State lifted from BatchExtractTab to persist across tab changes
    const [results, setResults] = useState<ExtractionResult[]>([]);
    const [files, setFiles] = useState<File[]>([]);
    const [folderName, setFolderName] = useState('');
    const [validationStatus, setValidationStatus] = useState<Record<string, ValidationResult> | null>(null);
    const [contasAPagar, setContasAPagar] = useState<GroundTruth>(initialGroundTruth);
    const [razaoLoja, setRazaoLoja] = useState<GroundTruth>(initialGroundTruth);


    const handleLayoutSave = (layout: Omit<Layout, 'id'>, makeActive: boolean = false) => {
        const newLayout = { ...layout, id: `layout-${Date.now()}` };
        setLayouts(prev => [...prev, newLayout]);
        if(makeActive) {
            setSelectedLayoutId(newLayout.id);
        }
        setIsLayoutModalOpen(false); // Fechar o modal após salvar
    };
    
    const handleLayoutSelect = (id: string) => {
        setSelectedLayoutId(id);
        // Não fechar o modal aqui, permite que o usuário veja a seleção
    }
    
    const handleLayoutDelete = (id: string) => {
        if (window.confirm("Tem certeza que deseja excluir este layout?")) {
            setLayouts(prev => {
                const newLayouts = prev.filter(l => l.id !== id);
                // Se o layout deletado era o selecionado, seleciona o primeiro da lista
                if (selectedLayoutId === id) {
                    setSelectedLayoutId(newLayouts[0]?.id || '');
                }
                return newLayouts;
            });
        }
    }

    const hasSuccessfulResults = results.some(r => r.status === 'success');

    const totalLiquidValue = useMemo(() => {
        return results
            .filter(r => r.status === 'success' && r.data?.valorLiquido)
            .reduce((sum, r) => sum + r.data!.valorLiquido, 0);
    }, [results]);
    
    const selectedLayout = layouts.find(l => l.id === selectedLayoutId);
    
    const handleAutoSaveExtraction = (currentFolderName: string) => {
        if (!hasSuccessfulResults) return;

        const storedResults: StoredExtractionResult[] = results.map(r => ({
            id: r.id,
            fileName: r.file.name,
            status: r.status,
            data: r.data,
            error: r.error,
        }));
        
        const extractionName = currentFolderName 
            ? `Extração da pasta: ${currentFolderName}` 
            : `Extração de ${new Date().toLocaleString('pt-BR')}`;

        const newSavedExtraction: SavedExtractionItem = {
            id: `ext-${Date.now()}`,
            name: extractionName,
            timestamp: new Date().toISOString(),
            results: storedResults,
            totalLiquidValue: totalLiquidValue,
        };

        setSavedExtractions(prev => [newSavedExtraction, ...prev].slice(0, 20));
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-6 lg:p-8 font-sans">
            <div className="max-w-7xl mx-auto">
                <header className="mb-8">
                    <h1 className="text-4xl font-bold text-blue-400">Extrator de Notas Fiscais</h1>
                    <p className="text-gray-400 mt-2">Use IA, processe em lote, valide resultados e consulte o histórico.</p>
                </header>

                <main>
                    {/* Abas de Navegação */}
                    <div className="mb-6 border-b border-gray-700">
                        <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
                            <button
                                onClick={() => setActiveTab('batch')}
                                className={`${
                                    activeTab === 'batch'
                                        ? 'border-blue-400 text-blue-300'
                                        : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'
                                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-lg transition-colors`}
                            >
                                Extração e Validação
                            </button>
                            <button
                                onClick={() => setActiveTab('create')}
                                className={`${
                                    activeTab === 'create'
                                        ? 'border-blue-400 text-blue-300'
                                        : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'
                                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-lg transition-colors`}
                            >
                                Criar Layout com IA
                            </button>
                             <button
                                onClick={() => setActiveTab('saved')}
                                className={`${
                                    activeTab === 'saved'
                                        ? 'border-blue-400 text-blue-300'
                                        : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'
                                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-lg transition-colors`}
                            >
                                Extrações Salvas
                            </button>
                        </nav>
                    </div>

                    {/* Conteúdo das Abas */}
                    <div >
                        {activeTab === 'batch' && (
                            <BatchExtractTab 
                                selectedLayout={selectedLayout}
                                onOpenLayoutModal={() => setIsLayoutModalOpen(true)}
                                results={results}
                                setResults={setResults}
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
                                totalLiquidValue={totalLiquidValue}
                                hasSuccessfulResults={hasSuccessfulResults}
                                onExtractionComplete={() => handleAutoSaveExtraction(folderName)}
                            />
                        )}
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
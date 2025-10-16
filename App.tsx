import React, { useState, useCallback, useMemo } from 'react';
import useLocalStorage from './hooks/useLocalStorage';
import ResultsTable from './components/ResultsTable';
import PDFPreviewModal from './components/PDFPreviewModal';
import LayoutModal from './components/LayoutModal';
import BatchExtractTab from './components/tabs/BatchExtractTab';
import CreateLayoutTab from './components/tabs/CreateLayoutTab';
import type { Layout, ExtractionResult } from './types';

const defaultLayouts: Layout[] = [
    {
        id: 'default-1',
        name: 'Layout Padrão (Exemplo)',
        prompt: 'O nome do prestador está no topo. O número da nota fiscal é rotulado como "NFS-e". O valor líquido é "Valor Total dos Serviços". A data de emissão é "Data e Hora de Emissão".',
    },
];

type ActiveTab = 'batch' | 'create';

function App() {
    const [layouts, setLayouts] = useLocalStorage<Layout[]>('invoice-layouts', defaultLayouts);
    const [selectedLayoutId, setSelectedLayoutId] = useState<string>(layouts[0]?.id || '');
    const [isLayoutModalOpen, setIsLayoutModalOpen] = useState(false);
    const [results, setResults] = useState<ExtractionResult[]>([]);
    const [selectedFileForPreview, setSelectedFileForPreview] = useState<File | null>(null);
    const [activeTab, setActiveTab] = useState<ActiveTab>('batch');

    const handleLayoutSave = (layout: Omit<Layout, 'id'>, makeActive: boolean = false) => {
        const newLayout = { ...layout, id: `layout-${Date.now()}` };
        setLayouts(prev => [...prev, newLayout]);
        if(makeActive) {
            setSelectedLayoutId(newLayout.id);
        }
    };
    
    const handleLayoutSelect = (id: string) => {
        setSelectedLayoutId(id);
        setIsLayoutModalOpen(false);
    }
    
    const handleFilePreview = (file: File) => {
        setSelectedFileForPreview(file);
    };

    const handleClosePreview = () => {
        setSelectedFileForPreview(null);
    };

    const hasSuccessfulResults = results.some(r => r.status === 'success');

    const totalLiquidValue = useMemo(() => {
        return results
            .filter(r => r.status === 'success' && r.data?.valorLiquido)
            .reduce((sum, r) => sum + r.data!.valorLiquido, 0);
    }, [results]);
    
    const selectedLayout = layouts.find(l => l.id === selectedLayoutId);

    return (
        <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-6 lg:p-8 font-sans">
            <div className="max-w-7xl mx-auto">
                <header className="mb-8">
                    <h1 className="text-4xl font-bold text-blue-400">Extrator de Notas Fiscais Híbrido</h1>
                    <p className="text-gray-400 mt-2">Use IA para aprender layouts e processe arquivos em lote com precisão.</p>
                </header>

                <main>
                    {/* Abas de Navegação */}
                    <div className="mb-6 border-b border-gray-700">
                        <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                            <button
                                onClick={() => setActiveTab('batch')}
                                className={`${
                                    activeTab === 'batch'
                                        ? 'border-blue-400 text-blue-300'
                                        : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'
                                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-lg transition-colors`}
                            >
                                Extração em Lote
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
                        </nav>
                    </div>

                    {/* Conteúdo das Abas */}
                    <div >
                        {activeTab === 'batch' && (
                            <BatchExtractTab 
                                layouts={layouts}
                                selectedLayout={selectedLayout}
                                onOpenLayoutModal={() => setIsLayoutModalOpen(true)}
                                results={results}
                                setResults={setResults}
                                onFilePreview={handleFilePreview}
                                totalLiquidValue={totalLiquidValue}
                                hasSuccessfulResults={hasSuccessfulResults}
                            />
                        )}
                        {activeTab === 'create' && (
                           <CreateLayoutTab 
                                onLayoutGenerated={(layout) => {
                                    handleLayoutSave(layout, true);
                                    // Mudar para a aba de lote para que o usuário possa usar o novo layout imediatamente
                                    setActiveTab('batch'); 
                                }}
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
            />

            <PDFPreviewModal
                isOpen={!!selectedFileForPreview}
                onClose={handleClosePreview}
                file={selectedFileForPreview}
            />
        </div>
    );
}

export default App;
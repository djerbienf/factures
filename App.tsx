
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ClientManager from './components/ClientManager';
import InvoiceGenerator from './components/InvoiceGenerator';
import InvoiceHistory from './components/InvoiceHistory';
import Settings from './components/Settings';
import { ViewState } from './types';
import { storageService } from './services/storageService';
import { TrendingUp, Users, FileCheck } from 'lucide-react';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalInvoices: 0,
    totalClients: 0,
    totalRevenue: 0
  });

  // Refresh stats whenever view changes to dashboard
  useEffect(() => {
    if (currentView === 'dashboard') {
      const invoices = storageService.getInvoices();
      const clients = storageService.getClients();
      
      // Calcul du CA (sommaire simple, ignore la conversion de devise pour l'instant et somme tout)
      const revenue = invoices.reduce((acc, inv) => {
        const subtotal = inv.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
        const applyTva = inv.tvaApplicable !== false;
        let total = applyTva ? subtotal * (1 + inv.tvaRate/100) : subtotal;
        if (inv.timbreFiscal) {
          total += 1.000;
        }
        return acc + total;
      }, 0);

      setStats({
        totalInvoices: invoices.length,
        totalClients: clients.length,
        totalRevenue: revenue
      });
    }
  }, [currentView]);

  const handleViewChange = (view: ViewState) => {
    if (view === 'create-invoice') {
      // If manually clicking Create Invoice from sidebar, ensure we reset edit mode
      setEditingInvoiceId(null);
    }
    setCurrentView(view);
  };

  const handleEditInvoice = (id: string) => {
    setEditingInvoiceId(id);
    setCurrentView('create-invoice');
  };

  const handleInvoiceSaved = () => {
    setEditingInvoiceId(null);
    setCurrentView('history');
  };

  const renderView = () => {
    switch (currentView) {
      case 'clients':
        return <ClientManager />;
      case 'create-invoice':
        return (
          <InvoiceGenerator 
            onSaved={handleInvoiceSaved} 
            editingInvoiceId={editingInvoiceId} 
          />
        );
      case 'history':
        return <InvoiceHistory onEdit={handleEditInvoice} />;
      case 'settings':
        return <Settings />;
      case 'dashboard':
      default:
        // Pour l'affichage global, on utilise la devise de l'entreprise par défaut
        const defaultCompany = storageService.getDefaultCompany();
        const symbol = defaultCompany.currency === 'EUR' ? '€' : 'DT';
        const decimals = defaultCompany.currency === 'EUR' ? 2 : 3;
        
        return (
          <div className="max-w-5xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-800">Tableau de Bord</h1>
              <p className="text-gray-500 mt-1">Bienvenue sur FactuPro.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center gap-4">
                <div className="p-4 bg-blue-50 text-blue-600 rounded-full">
                  <FileCheck size={28} />
                </div>
                <div>
                  <p className="text-sm text-gray-500 font-medium">Documents Générés</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalInvoices}</p>
                </div>
              </div>
              
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center gap-4">
                <div className="p-4 bg-purple-50 text-purple-600 rounded-full">
                  <Users size={28} />
                </div>
                <div>
                  <p className="text-sm text-gray-500 font-medium">Clients Totaux</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalClients}</p>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center gap-4">
                <div className="p-4 bg-green-50 text-green-600 rounded-full">
                  <TrendingUp size={28} />
                </div>
                <div>
                  <p className="text-sm text-gray-500 font-medium">Volume Global (Est.)</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalRevenue.toFixed(decimals)} {symbol}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-8 text-white shadow-lg">
                  <h3 className="text-xl font-bold mb-4">Actions Rapides</h3>
                  <div className="space-y-3">
                    <button 
                      onClick={() => handleViewChange('create-invoice')}
                      className="w-full bg-white/10 hover:bg-white/20 text-left px-4 py-3 rounded-lg transition-colors flex items-center gap-2"
                    >
                      <span>+ Créer un document (Facture/Devis)</span>
                    </button>
                    <button 
                      onClick={() => handleViewChange('clients')}
                      className="w-full bg-white/10 hover:bg-white/20 text-left px-4 py-3 rounded-lg transition-colors flex items-center gap-2"
                    >
                      <span>+ Ajouter un nouveau client</span>
                    </button>
                  </div>
               </div>

               <div className="bg-white rounded-xl border border-gray-200 p-8">
                 <h3 className="text-lg font-bold text-gray-800 mb-4">État du système</h3>
                 <div className="space-y-4">
                   <div className="flex justify-between items-center pb-4 border-b border-gray-100">
                     <span className="text-gray-600">Stockage Local</span>
                     <span className="text-green-600 font-medium bg-green-50 px-3 py-1 rounded-full text-xs">Actif</span>
                   </div>
                   <div className="flex justify-between items-center pb-4 border-b border-gray-100">
                     <span className="text-gray-600">Module PDF</span>
                     <span className="text-green-600 font-medium bg-green-50 px-3 py-1 rounded-full text-xs">Prêt</span>
                   </div>
                   <div className="text-sm text-gray-400 mt-4">
                     Toutes vos données sont stockées localement dans votre navigateur. Pensez à exporter vos factures régulièrement.
                   </div>
                 </div>
               </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar currentView={currentView} onChangeView={handleViewChange} />
      <main className="flex-1 ml-64 p-8 transition-all">
        {renderView()}
      </main>
    </div>
  );
};

export default App;

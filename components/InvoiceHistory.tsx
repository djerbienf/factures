
import React, { useEffect, useState, useRef } from 'react';
import { Download, Trash2, FileText, Pencil, Search, FileDown, Copy, FileCode, FileUp, Plus } from 'lucide-react';
import { Invoice } from '../types';
import { storageService } from '../services/storageService';
import { generateInvoicePDF } from '../services/pdfService';
import { generateInvoiceDOCX } from '../services/docxService';

interface InvoiceHistoryProps {
  onEdit: (id: string) => void;
}

const InvoiceHistory: React.FC<InvoiceHistoryProps> = ({ onEdit }) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'facture' | 'devis'>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setInvoices(storageService.getInvoices());
  }, []);

  const handleDownloadPDF = (invoice: Invoice) => {
    generateInvoicePDF(invoice);
  };

  const handleDownloadDOCX = async (invoice: Invoice) => {
    await generateInvoiceDOCX(invoice);
  };

  const handleDownloadJSON = (invoice: Invoice) => {
    storageService.exportInvoiceJSON(invoice);
  };

  const handleDuplicate = (id: string) => {
    const duplicated = storageService.duplicateInvoice(id);
    if (duplicated) {
      setInvoices(storageService.getInvoices());
      onEdit(duplicated.id);
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        const imported = storageService.importInvoiceData(parsed);

        const updated = storageService.getInvoices();
        setInvoices(updated);

        if (window.confirm(`Facture "${imported.number}" importée avec succès ! Souhaitez-vous l'ouvrir immédiatement pour l'éditer ?`)) {
          onEdit(imported.id);
        }
      } catch (err: any) {
        console.error("Import error:", err);
        alert(err.message || "Impossible de lire le fichier. Assurez-vous d'importer un fichier .json valide.");
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  const handleDelete = (id: string, number: string) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer le document ${number} de l'historique ?`)) {
      const updated = invoices.filter(inv => inv.id !== id);
      setInvoices(updated);
      storageService.saveInvoices(updated);
    }
  };

  const getTypeLabel = (type: string) => {
    if (type === 'devis') {
      return <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 text-xs rounded-full font-semibold">Devis</span>;
    }
    return <span className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 text-xs rounded-full font-semibold">Facture</span>;
  };

  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = 
      inv.number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.clientSnap?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || inv.type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Hidden File Input for JSON import */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleImportFile} 
        accept=".json" 
        className="hidden" 
      />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Historique des Documents</h2>
          <p className="text-sm text-gray-500 mt-1">Consultez, modifiez, téléchargez, dupliquez et importez vos factures et devis.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors shadow-xs"
            title="Importer un fichier de facture JSON existant"
          >
            <FileUp size={16} className="text-blue-600" />
            <span>Importer une facture (.json)</span>
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Rechercher par n° ou client..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Filtrer :</span>
          <button
            onClick={() => setTypeFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              typeFilter === 'all' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Tous ({invoices.length})
          </button>
          <button
            onClick={() => setTypeFilter('facture')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              typeFilter === 'facture' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Factures
          </button>
          <button
            onClick={() => setTypeFilter('devis')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              typeFilter === 'devis' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Devis
          </button>
        </div>
      </div>
      
      {filteredInvoices.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 border-dashed p-12 text-center">
          <FileText size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">Aucun document trouvé</h3>
          <p className="text-gray-500 mt-1">
            {searchTerm || typeFilter !== 'all'
              ? 'Essayez de modifier votre recherche ou vos filtres.'
              : 'Créez votre première facture ou devis pour le voir apparaître ici.'}
          </p>
        </div>
      ) : (
        <div className="bg-white shadow-sm rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">N° Document</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Client</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Montant Total</th>
                  <th className="px-5 py-3.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions & Téléchargement</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredInvoices.map((invoice) => {
                  // Safe calculations
                  const subtotal = (invoice.items || []).reduce((acc, item) => acc + (Number(item?.quantity || 0) * Number(item?.unitPrice || 0)), 0);
                  const applyTva = invoice.tvaApplicable !== false;
                  let total = applyTva ? subtotal * (1 + (invoice.tvaRate || 0)/100) : subtotal;
                  if (invoice.timbreFiscal) {
                    total += 1.000;
                  }
                  
                  // Determine currency formatting
                  const currency = invoice.currency || invoice.companySnap?.currency || 'TND';
                  const symbol = currency === 'EUR' ? '€' : 'DT';
                  const decimals = currency === 'EUR' ? 2 : 3;
                  
                  return (
                    <tr key={invoice.id} className="hover:bg-blue-50/40 transition-colors">
                      <td className="px-5 py-4 whitespace-nowrap">
                        {getTypeLabel(invoice.type || 'facture')}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                        {invoice.number}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-800">
                        <div className="font-medium">{invoice.clientSnap?.name || 'Client sans nom'}</div>
                        {invoice.clientSnap?.mf && (
                          <div className="text-xs text-gray-400 font-mono">MF : {invoice.clientSnap.mf}</div>
                        )}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-500">
                        {invoice.date}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-bold font-mono">
                        {total.toFixed(decimals)} {symbol}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-center text-sm font-medium">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Edit Action Button */}
                          <button
                            onClick={() => onEdit(invoice.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800 border border-blue-200 rounded-lg text-xs font-semibold transition-colors shadow-xs"
                            title="Modifier ce document dans l'éditeur"
                          >
                            <Pencil size={13} />
                            <span>Éditer</span>
                          </button>

                          {/* Duplicate & Edit Button */}
                          <button
                            onClick={() => handleDuplicate(invoice.id)}
                            className="inline-flex items-center gap-1 px-2 py-1.5 bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 rounded-lg text-xs font-semibold transition-colors"
                            title="Dupliquer et éditer une copie"
                          >
                            <Copy size={13} />
                            <span>Copier</span>
                          </button>

                          {/* JSON Download Button */}
                          <button
                            onClick={() => handleDownloadJSON(invoice)}
                            className="inline-flex items-center gap-1 px-2 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-xs font-semibold transition-colors"
                            title="Télécharger le fichier de données (.json) pour réutilisation ou modification ultérieure"
                          >
                            <FileCode size={13} />
                            <span>JSON</span>
                          </button>

                          {/* PDF Download Button */}
                          <button
                            onClick={() => handleDownloadPDF(invoice)}
                            className="inline-flex items-center gap-1 px-2 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded-lg text-xs font-semibold transition-colors"
                            title="Télécharger en PDF"
                          >
                            <Download size={13} />
                            <span>PDF</span>
                          </button>

                          {/* Word Download Button */}
                          <button
                            onClick={() => handleDownloadDOCX(invoice)}
                            className="inline-flex items-center gap-1 px-2 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-lg text-xs font-semibold transition-colors"
                            title="Télécharger en Word (DOCX)"
                          >
                            <FileDown size={13} />
                            <span>Word</span>
                          </button>

                          {/* Delete Button */}
                          <button
                            onClick={() => handleDelete(invoice.id, invoice.number)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-1"
                            title="Supprimer"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceHistory;

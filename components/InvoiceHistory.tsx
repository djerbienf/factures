
import React, { useEffect, useState } from 'react';
import { Download, Trash2, FileText, Pencil } from 'lucide-react';
import { Invoice } from '../types';
import { storageService } from '../services/storageService';
import { generateInvoicePDF } from '../services/pdfService';

interface InvoiceHistoryProps {
  onEdit: (id: string) => void;
}

const InvoiceHistory: React.FC<InvoiceHistoryProps> = ({ onEdit }) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  useEffect(() => {
    setInvoices(storageService.getInvoices());
  }, []);

  const handleDownload = (invoice: Invoice) => {
    generateInvoicePDF(invoice);
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer ce document de l'historique ?")) {
      const updated = invoices.filter(inv => inv.id !== id);
      setInvoices(updated);
      storageService.saveInvoices(updated);
    }
  };

  const getTypeLabel = (type: string) => {
    if (type === 'devis') return <span className="px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded font-medium">Devis</span>;
    return <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded font-medium">Facture</span>;
  };

  return (
    <div className="max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Historique des Documents</h2>
      
      {invoices.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 border-dashed p-12 text-center">
          <FileText size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">Aucun document</h3>
          <p className="text-gray-500">Créez votre première facture ou devis pour le voir apparaître ici.</p>
        </div>
      ) : (
        <div className="bg-white shadow-sm rounded-xl border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Numéro</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Montant</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {invoices.map((invoice) => {
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
                  <tr key={invoice.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getTypeLabel(invoice.type || 'facture')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-700">
                      {invoice.number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {invoice.clientSnap?.name || 'Client Inconnu'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {invoice.date}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-semibold">
                      {total.toFixed(decimals)} {symbol}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                      <div className="flex justify-center gap-3">
                        <button
                          onClick={() => onEdit(invoice.id)}
                          className="text-gray-600 hover:text-blue-600 transition-colors"
                          title="Éditer"
                        >
                          <Pencil size={18} />
                        </button>
                        <button
                          onClick={() => handleDownload(invoice)}
                          className="text-gray-600 hover:text-blue-600 transition-colors"
                          title="Télécharger PDF"
                        >
                          <Download size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(invoice.id)}
                          className="text-gray-400 hover:text-red-600 transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default InvoiceHistory;

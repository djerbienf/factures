
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, FileText, Download, CheckSquare, Square, Building2, Coins, Stamp } from 'lucide-react';
import { Client, Invoice, InvoiceItem, Company } from '../types';
import { storageService } from '../services/storageService';
import { generateInvoicePDF } from '../services/pdfService';
import { generateInvoiceDOCX } from '../services/docxService';

// Interface locale pour permettre la saisie de chaînes avec virgules
interface EditableInvoiceItem {
  id: string;
  description: string;
  unit: string;
  quantity: number | string;
  unitPrice: number | string;
}

// Helper pour parser les nombres (accepte "12.5" et "12,5")
const parseNumber = (value: number | string): number => {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  // Remplace la virgule par un point et convertit
  const cleanValue = value.replace(/,/g, '.');
  const num = parseFloat(cleanValue);
  return isNaN(num) ? 0 : num;
};

interface InvoiceGeneratorProps {
  onSaved: () => void;
  editingInvoiceId?: string | null;
}

const InvoiceGenerator: React.FC<InvoiceGeneratorProps> = ({ onSaved, editingInvoiceId }) => {
  // Data Sources
  const [clients, setClients] = useState<Client[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  
  // Selections
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  
  // Computed Company Data
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
  
  // Document Settings
  const [docType, setDocType] = useState<'facture' | 'devis'>('facture');
  const [tvaApplicable, setTvaApplicable] = useState(true);
  const [timbreFiscal, setTimbreFiscal] = useState(false); // État pour le timbre
  const [currency, setCurrency] = useState<'TND' | 'EUR'>('TND'); // État indépendant pour la devise
  
  const [items, setItems] = useState<EditableInvoiceItem[]>([
    { id: '1', description: '', unit: 'U', quantity: 1, unitPrice: 0 }
  ]);
  const [tvaRate, setTvaRate] = useState(19);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');

  // Helpers pour la devise
  const currencySymbol = currency === 'EUR' ? '€' : 'DT';
  const decimals = currency === 'EUR' ? 2 : 3;
  const step = currency === 'EUR' ? "0.01" : "0.001";

  // Load Initial Data
  useEffect(() => {
    const loadedClients = storageService.getClients();
    const loadedCompanies = storageService.getCompanies();
    
    setClients(loadedClients);
    setCompanies(loadedCompanies);

    if (editingInvoiceId) {
      const invoices = storageService.getInvoices();
      const invoiceToEdit = invoices.find(inv => inv.id === editingInvoiceId);
      
      if (invoiceToEdit) {
        setDocType(invoiceToEdit.type || 'facture');
        setTvaApplicable(invoiceToEdit.tvaApplicable !== false);
        setTimbreFiscal(invoiceToEdit.timbreFiscal || false); // Chargement du timbre
        setCurrency(invoiceToEdit.currency || 'TND');
        setSelectedClientId(invoiceToEdit.clientId);
        
        const companyId = invoiceToEdit.companySnap?.id;
        if (companyId && loadedCompanies.some(c => c.id === companyId)) {
            setSelectedCompanyId(companyId);
        } else {
             if (loadedCompanies.length > 0) setSelectedCompanyId(loadedCompanies[0].id);
        }

        setInvoiceNumber(invoiceToEdit.number);
        setInvoiceDate(invoiceToEdit.date);
        setDueDate(invoiceToEdit.dueDate);
        
        // Sécurisation du chargement des items (gestion des nulls éventuels)
        const safeItems = (invoiceToEdit.items || []).map(item => ({
            ...item, 
            unit: item.unit || 'U',
            // On s'assure que quantity/price ne sont jamais null pour les inputs
            quantity: item.quantity ?? 0, 
            unitPrice: item.unitPrice ?? 0
        }));
        setItems(safeItems);

        setTvaRate(invoiceToEdit.tvaRate);
        setNotes(invoiceToEdit.notes || '');
      }
    } else {
      // Mode Création
      const defaultCompany = loadedCompanies.find(c => c.isDefault) || loadedCompanies[0];
      if (defaultCompany) {
        setSelectedCompanyId(defaultCompany.id);
        setCurrency(defaultCompany.currency || 'TND');
      }

      const existingInvoices = storageService.getInvoices();
      const nextNum = existingInvoices.length + 1;
      const year = new Date().getFullYear();
      setInvoiceNumber(`${year}-${String(nextNum).padStart(4, '0')}`);
    }
  }, [editingInvoiceId]);

  // Update Current Company Object when Selection Changes
  useEffect(() => {
    if (selectedCompanyId) {
        const comp = companies.find(c => c.id === selectedCompanyId);
        setCurrentCompany(comp || null);
        if (!editingInvoiceId && comp && comp.currency) {
            setCurrency(comp.currency);
        }
    }
  }, [selectedCompanyId, companies, editingInvoiceId]);

  const addItem = () => {
    setItems([...items, { id: Date.now().toString(), description: '', unit: 'U', quantity: 1, unitPrice: 0 }]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id));
    }
  };

  const updateItem = (id: string, field: keyof EditableInvoiceItem, value: any) => {
    setItems(items.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => {
        const qty = parseNumber(item.quantity);
        const price = parseNumber(item.unitPrice);
        return sum + (qty * price);
    }, 0);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    let total = subtotal;
    
    if (tvaApplicable) {
      total += subtotal * (tvaRate / 100);
    }
    
    if (timbreFiscal) {
      total += 1.000; // Ajout fixe de 1.000
    }
    
    return total;
  };

  const handleSave = async (format: 'pdf' | 'docx' | 'none') => {
    // 1. Validation de base
    if (!selectedClientId) {
      alert('Veuillez sélectionner un client.');
      return;
    }
    if (!currentCompany) {
        alert('Veuillez sélectionner une entreprise émettrice.');
        return;
    }

    // 2. Vérification existence client
    const selectedClient = clients.find(c => c.id === selectedClientId);
    if (!selectedClient) {
      alert("Erreur critique : Le client sélectionné est introuvable dans la base (peut-être a-t-il été supprimé ?). Veuillez sélectionner un client existant.");
      return;
    }

    // 3. Préparation des données
    try {
      // Conversion stricte des inputs (nettoyage virgules)
      const strictItems: InvoiceItem[] = items.map(item => ({
        id: item.id,
        description: item.description,
        unit: item.unit,
        quantity: parseNumber(item.quantity),
        unitPrice: parseNumber(item.unitPrice)
      }));

      const invoiceData: Invoice = {
        id: editingInvoiceId || Date.now().toString(),
        type: docType,
        number: invoiceNumber,
        date: invoiceDate,
        dueDate: dueDate,
        clientId: selectedClientId,
        clientSnap: selectedClient,
        companySnap: currentCompany,
        items: strictItems,
        tvaApplicable: tvaApplicable,
        tvaRate: tvaRate,
        timbreFiscal: timbreFiscal, // Sauvegarde de l'état du timbre
        notes: notes,
        status: 'en_attente',
        currency: currency
      };

      // 4. Sauvegarde
      let invoices = storageService.getInvoices();
      
      if (editingInvoiceId) {
        invoices = invoices.map(inv => inv.id === editingInvoiceId ? invoiceData : inv);
      } else {
        invoices = [invoiceData, ...invoices];
      }
      
      storageService.saveInvoices(invoices);

      // 5. Génération (optionnelle)
      if (format === 'pdf') {
        try {
          generateInvoicePDF(invoiceData);
        } catch (pdfError) {
          console.error("Erreur génération PDF:", pdfError);
          alert("Erreur lors de la génération du PDF.");
        }
      } else if (format === 'docx') {
        try {
            await generateInvoiceDOCX(invoiceData);
        } catch (docxError) {
            console.error("Erreur génération Word:", docxError);
            alert("Erreur lors de la génération du fichier Word.");
        }
      }

      // 6. Finalisation
      onSaved();

    } catch (error) {
      console.error("Erreur lors de la sauvegarde :", error);
      alert("Une erreur est survenue lors de la sauvegarde.");
    }
  };

  if (companies.length === 0) {
      return <div className="p-8 text-center">Veuillez d'abord ajouter une entreprise dans les Paramètres.</div>;
  }

  return (
    <div className="max-w-5xl mx-auto pb-20">
      {/* Actions Toolbar */}
      <div className="flex justify-between items-center mb-6 sticky top-0 z-10 bg-gray-50/90 backdrop-blur py-4">
        <h2 className="text-2xl font-bold text-gray-800">
          {editingInvoiceId ? 'Modifier' : 'Nouveau Document'}
        </h2>
        <div className="flex gap-3">
          {/* Nouveau Bouton WORD */}
          <button
            onClick={() => handleSave('docx')}
            className="flex items-center gap-2 px-4 py-2 text-white bg-blue-800 hover:bg-blue-900 rounded-lg transition-colors shadow-sm"
          >
            <FileText size={18} /> {editingInvoiceId ? 'MAJ & Word' : 'Sauvegarder & Word'}
          </button>
          
          {/* Bouton PDF */}
          <button
            onClick={() => handleSave('pdf')}
            className="flex items-center gap-2 px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-sm"
          >
            <Download size={18} /> {editingInvoiceId ? 'MAJ & PDF' : 'Sauvegarder & PDF'}
          </button>
        </div>
      </div>

      {/* SELECTEUR ENTREPRISE */}
      <div className="mb-6 bg-white p-4 rounded-lg shadow-sm border border-blue-100 flex items-center gap-4">
         <div className="p-2 bg-blue-50 text-blue-600 rounded">
            <Building2 size={24} />
         </div>
         <div className="flex-1">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Entreprise Émettrice</label>
            <select 
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                className="w-full md:w-1/2 p-2 border border-gray-300 rounded bg-white focus:ring-2 focus:ring-blue-500 outline-none font-medium"
            >
                {companies.map(c => (
                    <option key={c.id} value={c.id}>
                        {c.name} {c.isDefault ? '(Défaut)' : ''}
                    </option>
                ))}
            </select>
         </div>
      </div>

      {/* Document Controls (Type, Devise, Fiscalité) */}
      <div className="bg-white rounded-t-sm shadow-sm border border-gray-200 border-b-0 p-6 flex flex-wrap gap-6 items-center bg-gray-50">
        
        {/* Type Select */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Type :</span>
          <div className="flex bg-white rounded-lg p-1 border border-gray-200">
            <button
              onClick={() => setDocType('facture')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                docType === 'facture' 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Facture
            </button>
            <button
              onClick={() => setDocType('devis')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                docType === 'devis' 
                  ? 'bg-slate-600 text-white shadow-sm' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Devis
            </button>
          </div>
        </div>

        {/* Currency Select */}
        <div className="flex items-center gap-3 border-l border-gray-200 pl-6">
          <span className="text-sm font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-1">
             <Coins size={16} /> Devise :
          </span>
          <div className="flex bg-white rounded-lg p-1 border border-gray-200">
            <button
              onClick={() => setCurrency('TND')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                currency === 'TND' 
                  ? 'bg-emerald-600 text-white shadow-sm' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              TND (DT)
            </button>
            <button
              onClick={() => setCurrency('EUR')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                currency === 'EUR' 
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              EUR (€)
            </button>
          </div>
        </div>

        {/* TVA Toggle */}
        <div className="flex items-center gap-3 border-l border-gray-200 pl-6">
          <span className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Fiscalité :</span>
          <button
             onClick={() => setTvaApplicable(!tvaApplicable)}
             className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors ${
               tvaApplicable 
                 ? 'bg-blue-50 border-blue-200 text-blue-700' 
                 : 'bg-orange-50 border-orange-200 text-orange-700'
             }`}
          >
             {tvaApplicable ? <CheckSquare size={18} /> : <Square size={18} />}
             <span className="text-sm font-medium">
                {tvaApplicable ? 'Avec TVA' : 'Sans TVA'}
             </span>
          </button>
        </div>

        {/* Timbre Fiscal Toggle */}
        <div className="flex items-center gap-3 border-l border-gray-200 pl-6">
          <span className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Timbre :</span>
          <button
             onClick={() => setTimbreFiscal(!timbreFiscal)}
             className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors ${
               timbreFiscal 
                 ? 'bg-purple-50 border-purple-200 text-purple-700' 
                 : 'bg-gray-50 border-gray-200 text-gray-700'
             }`}
          >
             {timbreFiscal ? <CheckSquare size={18} /> : <Square size={18} />}
             <span className="text-sm font-medium">
                {timbreFiscal ? 'Timbre (+1.000)' : 'Sans Timbre'}
             </span>
          </button>
        </div>
      </div>

      {/* Paper Document Container */}
      <div className="bg-white rounded-b-sm shadow-lg border border-gray-200 p-10 min-h-[29.7cm] relative">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start mb-12 gap-8">
          
          {/* Entreprise */}
          <div className="w-full md:w-1/2">
             {currentCompany ? (
                 <div className="border-l-4 border-blue-600 pl-4 py-1 transition-all">
                    <h3 className="text-xl font-bold text-gray-900 uppercase tracking-wide">{currentCompany.name}</h3>
                    <div className="text-sm text-gray-500 mt-2 space-y-1">
                    <p>{currentCompany.address}</p>
                    <p>MF: {currentCompany.mf}</p>
                    {currentCompany.phone && <p>Tél: {currentCompany.phone}</p>}
                    {currentCompany.email && <p>{currentCompany.email}</p>}
                    </div>
                </div>
             ) : (
                 <p className="text-red-500">Veuillez sélectionner une entreprise</p>
             )}
          </div>

          {/* Facture Infos */}
          <div className="w-full md:w-1/3 text-right">
            <h1 className={`text-4xl font-bold mb-4 tracking-widest ${docType === 'devis' ? 'text-slate-300' : 'text-gray-200'}`}>
              {docType === 'devis' ? 'DEVIS' : 'FACTURE'}
            </h1>
            <div className="space-y-2">
              <div className="flex items-center justify-end gap-3">
                <label className="text-sm font-medium text-gray-600">N°</label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-32 p-1 text-right border-b border-gray-300 focus:border-blue-500 outline-none font-bold text-gray-800"
                />
              </div>
              <div className="flex items-center justify-end gap-3">
                <label className="text-sm font-medium text-gray-600">Date</label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-32 p-1 text-right border-b border-gray-300 focus:border-blue-500 outline-none text-gray-700"
                />
              </div>
              <div className="flex items-center justify-end gap-3">
                <label className="text-sm font-medium text-gray-600">
                  {docType === 'devis' ? 'Validité' : 'Échéance'}
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-32 p-1 text-right border-b border-gray-300 focus:border-blue-500 outline-none text-gray-700"
                />
              </div>
            </div>
          </div>
        </div>

        <hr className="border-blue-600 mb-8" />

        {/* Client Section */}
        <div className="flex justify-end mb-12">
          <div className="w-full md:w-1/2 lg:w-1/3 bg-gray-50 p-4 rounded border border-gray-100">
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">
               {docType === 'devis' ? 'Devis pour' : 'Facturé à'}
            </label>
            <select
              className="w-full p-2 border border-gray-300 rounded bg-white focus:ring-1 focus:ring-blue-500 outline-none text-sm mb-2"
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
            >
              <option value="">-- Sélectionner un client --</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>
                    {client.name || 'Client sans nom'}
                </option>
              ))}
            </select>
            
            {selectedClientId && (
              <div className="text-sm text-gray-700 mt-2 pl-1">
                <p className="font-bold">{clients.find(c => c.id === selectedClientId)?.name}</p>
                <p className="text-gray-500">{clients.find(c => c.id === selectedClientId)?.address}</p>
                <p className="text-gray-500 text-xs mt-1">
                    {clients.find(c => c.id === selectedClientId)?.mf && `MF: ${clients.find(c => c.id === selectedClientId)?.mf}`}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Items Table */}
        <div className="mb-8">
          <table className="w-full">
            <thead className="bg-gray-100 text-gray-600 uppercase text-xs tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left w-[42%]">Désignation</th>
                <th className="px-2 py-3 text-center w-[8%]">U</th>
                <th className="px-2 py-3 text-center w-[10%]">Qté</th>
                <th className="px-4 py-3 text-center w-[20%]">Prix Unit. {tvaApplicable ? 'HT' : ''} ({currencySymbol})</th>
                <th className="px-4 py-3 text-center w-[20%]">Total {tvaApplicable ? 'HT' : ''} ({currencySymbol})</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => (
                <tr key={item.id} className="group hover:bg-blue-50/30 transition-colors">
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                      placeholder="Description"
                      className="w-full bg-transparent border-none focus:ring-0 p-1 text-gray-800 placeholder-gray-300"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="text"
                      value={item.unit}
                      onChange={(e) => updateItem(item.id, 'unit', e.target.value)}
                      className="w-full bg-transparent border-none focus:ring-0 p-1 text-center text-gray-600"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="text" // Changé en text pour permettre la virgule
                      value={item.quantity}
                      onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                      className="w-full bg-transparent border-none focus:ring-0 p-1 text-center text-gray-800 font-medium"
                      placeholder="0"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="text" // Changé en text pour permettre la virgule
                      value={item.unitPrice}
                      onChange={(e) => updateItem(item.id, 'unitPrice', e.target.value)}
                      className="w-full bg-transparent border-none focus:ring-0 p-1 text-right text-gray-800"
                      placeholder="0.000"
                    />
                  </td>
                  <td className="px-4 py-2 text-right font-medium text-gray-800">
                    {(parseNumber(item.quantity) * parseNumber(item.unitPrice)).toFixed(decimals)}
                  </td>
                  <td className="text-center">
                    <button
                      onClick={() => removeItem(item.id)}
                      className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                      disabled={items.length === 1}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            onClick={addItem}
            className="mt-4 flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium text-sm px-4 py-2 hover:bg-blue-50 rounded transition-colors"
          >
            <Plus size={16} /> Ajouter une ligne
          </button>
        </div>

        {/* Totals & Notes */}
        <div className="flex flex-col md:flex-row justify-between items-start gap-12 mt-12 border-t border-gray-100 pt-8">
          <div className="w-full md:w-1/2">
            <label className="block text-sm font-medium text-gray-500 mb-2">Notes / Conditions</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Conditions de paiement, références bancaires, etc."
              className="w-full p-3 bg-gray-50 border border-gray-100 rounded text-sm text-gray-600 h-24 resize-none focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>
          
          <div className="w-full md:w-1/3 space-y-4">
             {tvaApplicable ? (
               <>
                 <div className="flex justify-between text-sm text-gray-600">
                    <span>Total HT</span>
                    <span className="font-medium">{calculateSubtotal().toFixed(decimals)} {currencySymbol}</span>
                 </div>
                 
                 <div className="flex justify-between items-center text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <span>TVA</span>
                      <input 
                        type="number" 
                        value={tvaRate} 
                        onChange={(e) => setTvaRate(Number(e.target.value))}
                        className="w-12 p-1 text-center border border-gray-200 rounded bg-white text-xs"
                      />
                      <span>%</span>
                    </div>
                    <span className="font-medium">{(calculateSubtotal() * (tvaRate / 100)).toFixed(decimals)} {currencySymbol}</span>
                 </div>

                 {/* Contrôle du Timbre Fiscal */}
                 <div className="flex justify-between items-center text-sm text-gray-600">
                    <label className="flex items-center gap-2 cursor-pointer hover:text-gray-800">
                      <input 
                        type="checkbox" 
                        checked={timbreFiscal} 
                        onChange={(e) => setTimbreFiscal(e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <Stamp size={16} />
                      <span>Timbre Fiscal (+1.000)</span>
                    </label>
                    <span className="font-medium">{timbreFiscal ? (1).toFixed(decimals) : (0).toFixed(decimals)} {currencySymbol}</span>
                 </div>

                 <div className="flex justify-between text-lg font-bold text-gray-900 border-t border-gray-200 pt-4">
                   <span>Total TTC</span>
                   <span className="text-blue-600">{calculateTotal().toFixed(decimals)} {currencySymbol}</span>
                 </div>
               </>
             ) : (
               <>
                 <div className="flex justify-between text-sm text-gray-600">
                    <span>Total Net</span>
                    <span className="font-medium">{calculateSubtotal().toFixed(decimals)} {currencySymbol}</span>
                 </div>

                 {/* Contrôle du Timbre Fiscal */}
                 <div className="flex justify-between items-center text-sm text-gray-600">
                    <label className="flex items-center gap-2 cursor-pointer hover:text-gray-800">
                      <input 
                        type="checkbox" 
                        checked={timbreFiscal} 
                        onChange={(e) => setTimbreFiscal(e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <Stamp size={16} />
                      <span>Timbre Fiscal (+1.000)</span>
                    </label>
                    <span className="font-medium">{timbreFiscal ? (1).toFixed(decimals) : (0).toFixed(decimals)} {currencySymbol}</span>
                 </div>

                 <div className="flex justify-between text-lg font-bold text-gray-900 border-t border-gray-200 pt-4">
                    <span>Net à Payer</span>
                    <span className="text-blue-600">{calculateTotal().toFixed(decimals)} {currencySymbol}</span>
                 </div>
               </>
             )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default InvoiceGenerator;

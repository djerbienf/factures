
import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, FileText, Download, CheckSquare, Square, Building2, Coins, Stamp, FileCode, Upload, FileUp, Sparkles } from 'lucide-react';
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
  const [importNotification, setImportNotification] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleDownloadJSON = () => {
    const selectedClient = clients.find(c => c.id === selectedClientId);
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
      number: invoiceNumber || 'BROUILLON',
      date: invoiceDate,
      dueDate: dueDate,
      clientId: selectedClientId,
      clientSnap: selectedClient || { id: selectedClientId || 'client', name: 'Client', mf: '', address: '' },
      companySnap: currentCompany || companies[0],
      items: strictItems,
      tvaApplicable: tvaApplicable,
      tvaRate: tvaRate,
      timbreFiscal: timbreFiscal,
      notes: notes,
      status: 'en_attente',
      currency: currency
    };

    storageService.exportInvoiceJSON(invoiceData);
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

        // Refresh clients and companies list
        const updatedClients = storageService.getClients();
        const updatedCompanies = storageService.getCompanies();
        setClients(updatedClients);
        setCompanies(updatedCompanies);

        // Fill form
        setDocType(imported.type || 'facture');
        setInvoiceNumber(imported.number);
        setInvoiceDate(imported.date);
        setDueDate(imported.dueDate || '');
        setSelectedClientId(imported.clientId);
        if (imported.companySnap?.id) {
          setSelectedCompanyId(imported.companySnap.id);
        }
        setItems(imported.items.map(it => ({
          ...it,
          quantity: it.quantity ?? 1,
          unitPrice: it.unitPrice ?? 0
        })));
        setTvaApplicable(imported.tvaApplicable !== false);
        setTvaRate(imported.tvaRate ?? 19);
        setTimbreFiscal(Boolean(imported.timbreFiscal));
        setCurrency(imported.currency || 'TND');
        setNotes(imported.notes || '');

        setImportNotification(`Facture "${imported.number}" importée et chargée avec succès pour modification !`);
        setTimeout(() => setImportNotification(null), 5000);
      } catch (err: any) {
        console.error("Import error:", err);
        alert(err.message || "Impossible de lire le fichier de facture. Vérifiez qu'il s'agit d'un fichier .json valide.");
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  const handleSave = async (format: 'pdf' | 'docx' | 'none') => {
    // 1. Basic validation
    if (!selectedClientId) {
      alert('Veuillez sélectionner un client avant d\'enregistrer.');
      return;
    }
    if (!currentCompany) {
      alert('Veuillez sélectionner une entreprise émettrice.');
      return;
    }

    // 2. Verify client existence
    const selectedClient = clients.find(c => c.id === selectedClientId);
    if (!selectedClient) {
      alert("Erreur : Le client sélectionné est introuvable. Veuillez choisir un client actif.");
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

      // 5. Document Generation
      if (format === 'pdf') {
        try {
          generateInvoicePDF(invoiceData);
        } catch (pdfError) {
          console.error("PDF generation error:", pdfError);
          alert("Erreur lors de la génération du document PDF.");
        }
      } else if (format === 'docx') {
        try {
            await generateInvoiceDOCX(invoiceData);
        } catch (docxError) {
            console.error("Word generation error:", docxError);
            alert("Erreur lors de la génération du document Word (.docx).");
        }
      }

      // 6. Complete
      onSaved();

    } catch (error) {
      console.error("Save error:", error);
      alert("Une erreur est survenue lors de l'enregistrement du document.");
    }
  };

  if (companies.length === 0) {
      return (
        <div className="p-12 text-center bg-white rounded-xl border border-gray-200 shadow-xs max-w-xl mx-auto mt-10">
          <Building2 className="mx-auto text-gray-400 mb-3" size={44} />
          <h3 className="text-lg font-bold text-gray-800">Aucune entreprise émettrice configurée</h3>
          <p className="text-sm text-gray-500 mt-1">Veuillez configurer au moins une entreprise émettrice dans les Paramètres avant de créer des documents.</p>
        </div>
      );
  }

  return (
    <div className="max-w-5xl mx-auto pb-20">
      {/* Hidden File Input for JSON import */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleImportFile} 
        accept=".json" 
        className="hidden" 
      />

      {/* Import Notification Banner */}
      {importNotification && (
        <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-center justify-between text-emerald-900 text-sm animate-fadeIn">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-emerald-600" />
            <span className="font-medium">{importNotification}</span>
          </div>
          <button 
            onClick={() => setImportNotification(null)}
            className="text-xs text-emerald-700 hover:text-emerald-900 font-bold ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* Edit Mode Banner */}
      {editingInvoiceId && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-center justify-between text-amber-900 text-sm">
          <div className="flex items-center gap-2">
            <span className="font-semibold px-2 py-0.5 bg-amber-200 text-amber-800 rounded text-xs uppercase tracking-wide">Mode Modification</span>
            <span>Modification du document <strong>#{invoiceNumber}</strong>. Les modifications mettront à jour ce document.</span>
          </div>
          <button 
            onClick={onSaved}
            className="text-xs text-amber-700 hover:text-amber-900 font-medium underline"
          >
            Annuler la modification
          </button>
        </div>
      )}

      {/* Actions Toolbar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 sticky top-0 z-10 bg-gray-50/90 backdrop-blur py-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">
            {editingInvoiceId ? 'Modifier le Document' : 'Nouveau Document'}
          </h2>
          <p className="text-gray-500 text-xs mt-0.5">Configuration des articles, export et import de facture</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Import JSON Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-2 text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 rounded-lg transition-colors shadow-xs text-xs font-semibold"
            title="Importer et éditer une facture depuis un fichier JSON"
          >
            <FileUp size={16} className="text-blue-600" />
            <span>Importer (.json)</span>
          </button>

          {/* Download JSON Button */}
          <button
            type="button"
            onClick={handleDownloadJSON}
            className="flex items-center gap-1.5 px-3 py-2 text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 rounded-lg transition-colors shadow-xs text-xs font-semibold"
            title="Télécharger le fichier de données (.json) de cette facture pour sauvegarde ou réédition future"
          >
            <FileCode size={16} className="text-emerald-600" />
            <span>Télécharger (.json)</span>
          </button>

          {/* Word Button */}
          <button
            onClick={() => handleSave('docx')}
            className="flex items-center gap-1.5 px-3.5 py-2 text-white bg-blue-800 hover:bg-blue-900 rounded-lg transition-colors shadow-xs text-xs font-semibold"
          >
            <FileText size={16} /> {editingInvoiceId ? 'Mettre à jour & Word' : 'Sauvegarder & Word (.docx)'}
          </button>
          
          {/* PDF Button */}
          <button
            onClick={() => handleSave('pdf')}
            className="flex items-center gap-1.5 px-3.5 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-xs text-xs font-semibold"
          >
            <Download size={16} /> {editingInvoiceId ? 'Mettre à jour & PDF' : 'Sauvegarder & PDF'}
          </button>
        </div>
      </div>

      {/* ISSUING COMPANY SELECTOR */}
      <div className="mb-6 bg-white p-4 rounded-lg shadow-xs border border-blue-100 flex items-center gap-4">
         <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
            <Building2 size={22} />
         </div>
         <div className="flex-1">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Entreprise Émettrice</label>
            <select 
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                className="w-full md:w-1/2 p-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none font-medium text-sm"
            >
                {companies.map(c => (
                    <option key={c.id} value={c.id}>
                        {c.name} {c.isDefault ? '(Par Défaut)' : ''}
                    </option>
                ))}
            </select>
         </div>
      </div>

      {/* Document Controls (Type, Currency, Taxes) */}
      <div className="bg-white rounded-t-lg shadow-xs border border-gray-200 border-b-0 p-5 flex flex-wrap gap-6 items-center bg-gray-50">
        
        {/* Type Select */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">Type :</span>
          <div className="flex bg-white rounded-lg p-1 border border-gray-200">
            <button
              onClick={() => setDocType('facture')}
              className={`px-3.5 py-1 rounded-md text-xs font-semibold transition-all ${
                docType === 'facture' 
                  ? 'bg-blue-600 text-white shadow-xs' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Facture
            </button>
            <button
              onClick={() => setDocType('devis')}
              className={`px-3.5 py-1 rounded-md text-xs font-semibold transition-all ${
                docType === 'devis' 
                  ? 'bg-slate-700 text-white shadow-xs' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Devis
            </button>
          </div>
        </div>

        {/* Currency Select */}
        <div className="flex items-center gap-3 border-l border-gray-200 pl-6">
          <span className="text-xs font-bold text-gray-600 uppercase tracking-wide flex items-center gap-1">
             <Coins size={15} /> Devise :
          </span>
          <div className="flex bg-white rounded-lg p-1 border border-gray-200">
            <button
              onClick={() => setCurrency('TND')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                currency === 'TND' 
                  ? 'bg-emerald-600 text-white shadow-xs' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              TND (DT)
            </button>
            <button
              onClick={() => setCurrency('EUR')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                currency === 'EUR' 
                  ? 'bg-indigo-600 text-white shadow-xs' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              EUR (€)
            </button>
          </div>
        </div>

        {/* TVA Toggle */}
        <div className="flex items-center gap-3 border-l border-gray-200 pl-6">
          <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">Fiscalité :</span>
          <button
             onClick={() => setTvaApplicable(!tvaApplicable)}
             className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-semibold transition-colors ${
               tvaApplicable 
                 ? 'bg-blue-50 border-blue-200 text-blue-700' 
                 : 'bg-orange-50 border-orange-200 text-orange-700'
             }`}
          >
             {tvaApplicable ? <CheckSquare size={16} /> : <Square size={16} />}
             <span>
                {tvaApplicable ? 'Avec TVA' : 'Sans TVA'}
             </span>
          </button>
        </div>

        {/* Timbre Fiscal Toggle */}
        <div className="flex items-center gap-3 border-l border-gray-200 pl-6">
          <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">Timbre :</span>
          <button
             onClick={() => setTimbreFiscal(!timbreFiscal)}
             className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-semibold transition-colors ${
               timbreFiscal 
                 ? 'bg-purple-50 border-purple-200 text-purple-700' 
                 : 'bg-gray-100 border-gray-200 text-gray-600'
             }`}
          >
             {timbreFiscal ? <CheckSquare size={16} /> : <Square size={16} />}
             <span>
                {timbreFiscal ? 'Timbre Fiscal (+1.000)' : 'Sans Timbre'}
             </span>
          </button>
        </div>
      </div>

      {/* Paper Document Container */}
      <div className="bg-white rounded-b-lg shadow-md border border-gray-200 p-10 min-h-[29.7cm] relative">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start mb-12 gap-8">
          
          {/* Company */}
          <div className="w-full md:w-1/2">
             {currentCompany ? (
                 <div className="border-l-4 border-blue-600 pl-4 py-1 transition-all">
                    <h3 className="text-xl font-bold text-gray-900 uppercase tracking-wide">{currentCompany.name}</h3>
                    <div className="text-sm text-gray-500 mt-2 space-y-1">
                    <p>{currentCompany.address}</p>
                    <p>MF : {currentCompany.mf}</p>
                    {currentCompany.phone && <p>Tél : {currentCompany.phone}</p>}
                    {currentCompany.email && <p>{currentCompany.email}</p>}
                    </div>
                </div>
             ) : (
                 <p className="text-red-500 text-sm font-medium">Veuillez sélectionner une entreprise émettrice ci-dessus</p>
             )}
          </div>

          {/* Document Meta Infos */}
          <div className="w-full md:w-1/3 text-right">
            <h1 className={`text-4xl font-extrabold mb-4 tracking-widest ${docType === 'devis' ? 'text-slate-300' : 'text-gray-200'}`}>
              {docType === 'devis' ? 'DEVIS' : 'FACTURE'}
            </h1>
            <div className="space-y-2">
              <div className="flex items-center justify-end gap-3">
                <label className="text-xs font-bold text-gray-600 uppercase">N° Doc</label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-36 p-1 text-right border-b border-gray-300 focus:border-blue-500 outline-none font-bold text-gray-800 font-mono text-sm"
                />
              </div>
              <div className="flex items-center justify-end gap-3">
                <label className="text-xs font-bold text-gray-600 uppercase">Date</label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-36 p-1 text-right border-b border-gray-300 focus:border-blue-500 outline-none text-gray-700 text-sm"
                />
              </div>
              <div className="flex items-center justify-end gap-3">
                <label className="text-xs font-bold text-gray-600 uppercase">
                  {docType === 'devis' ? 'Validité' : 'Échéance'}
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-36 p-1 text-right border-b border-gray-300 focus:border-blue-500 outline-none text-gray-700 text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        <hr className="border-blue-600 mb-8" />

        {/* Client Section */}
        <div className="flex justify-end mb-12">
          <div className="w-full md:w-1/2 lg:w-1/3 bg-gray-50 p-4 rounded-xl border border-gray-200">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
               {docType === 'devis' ? 'Devis pour' : 'Facturé à'}
            </label>
            <select
              className="w-full p-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none text-sm mb-2 font-medium"
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
              <div className="text-xs text-gray-700 mt-2 pl-1 space-y-0.5">
                <p className="font-bold text-sm text-gray-900">{clients.find(c => c.id === selectedClientId)?.name}</p>
                <p className="text-gray-600">{clients.find(c => c.id === selectedClientId)?.address}</p>
                {clients.find(c => c.id === selectedClientId)?.mf && (
                  <p className="text-gray-500 font-mono">MF : {clients.find(c => c.id === selectedClientId)?.mf}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Items Table */}
        <div className="mb-8">
          <table className="w-full">
            <thead className="bg-gray-100 text-gray-600 uppercase text-xs tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left w-[42%] font-bold">Désignation</th>
                <th className="px-2 py-3 text-center w-[8%] font-bold">Unité</th>
                <th className="px-2 py-3 text-center w-[10%] font-bold">Qté</th>
                <th className="px-4 py-3 text-center w-[20%] font-bold">Prix Unit. {tvaApplicable ? 'HT' : 'Net'} ({currencySymbol})</th>
                <th className="px-4 py-3 text-center w-[20%] font-bold">Total {tvaApplicable ? 'HT' : 'Net'} ({currencySymbol})</th>
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
                      placeholder="Désignation de la prestation ou du produit"
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
            className="mt-4 flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium text-sm px-4 py-2 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <Plus size={16} /> Ajouter une ligne
          </button>
        </div>

        {/* Totals & Notes */}
        <div className="flex flex-col md:flex-row justify-between items-start gap-12 mt-12 border-t border-gray-100 pt-8">
          <div className="w-full md:w-1/2">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Conditions & Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Conditions de paiement, références bancaires (IBAN/RIB), mentions légales..."
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 h-28 resize-none focus:ring-2 focus:ring-blue-500 outline-none"
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
                      <span>Taux TVA</span>
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

                 {/* Tax Stamp Control */}
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

                 {/* Tax Stamp Control */}
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

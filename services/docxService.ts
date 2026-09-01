
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType, Header } from "docx";
import { Invoice } from '../types';

export const generateInvoiceDOCX = async (invoice: Invoice) => {
  const company = invoice.companySnap;
  const client = invoice.clientSnap;
  const currency = invoice.currency || company.currency || 'TND';
  const currencySymbol = currency === 'EUR' ? '€' : 'DT';
  const decimals = currency === 'EUR' ? 2 : 3;

  const docTypeLabel = invoice.type === 'devis' ? 'DEVIS' : 'FACTURE';
  
  // Calculs
  const subtotal = invoice.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const tvaAmount = invoice.tvaApplicable ? subtotal * (invoice.tvaRate / 100) : 0;
  const timbreAmount = invoice.timbreFiscal ? 1.000 : 0;
  const total = subtotal + tvaAmount + timbreAmount;

  // --- Styles des bordures (transparent pour mise en page) ---
  const noBorder = {
    style: BorderStyle.NONE,
    size: 0,
    color: "auto",
  };

  // --- 1. En-tête (Tableau 2 colonnes : Gauche=Entreprise, Droite=Infos Facture) ---
  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideVertical: noBorder, insideHorizontal: noBorder },
    rows: [
      new TableRow({
        children: [
          // Colonne Gauche : Infos Entreprise
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                children: [new TextRun({ text: (company.name || '').toUpperCase(), bold: true, size: 28, color: "2E86C1" })],
              }),
              new Paragraph({ text: company.address || "" }),
              new Paragraph({ text: company.mf ? `MF: ${company.mf}` : "" }),
              new Paragraph({ text: company.phone ? `Tél: ${company.phone}` : "" }),
              new Paragraph({ text: company.email || "" }),
            ],
          }),
          // Colonne Droite : Infos Facture
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            verticalAlign: AlignmentType.TOP,
            children: [
                new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [new TextRun({ text: docTypeLabel, bold: true, size: 36, color: "555555" })],
                }),
                new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [new TextRun({ text: `N° ${invoice.number}`, bold: true, size: 24 })],
                }),
                new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    text: `Date : ${invoice.date}`,
                }),
            ],
          }),
        ],
      }),
    ],
  });

  // --- 2. Infos Client ---
  const clientSection = [
    new Paragraph({ text: "" }), // Spacer
    new Paragraph({ text: "" }), // Spacer
    new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideVertical: noBorder, insideHorizontal: noBorder },
        rows: [
            new TableRow({
                children: [
                    new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: [] }), // Vide à gauche
                    new TableCell({
                        width: { size: 50, type: WidthType.PERCENTAGE },
                        children: [
                            new Paragraph({ text: invoice.type === 'devis' ? "Devis pour :" : "Facturé à :", color: "666666" }),
                            ...(client.name && client.name.trim().toLowerCase() !== 'client sans nom' ? [
                                new Paragraph({
                                    children: [new TextRun({ text: client.name.trim(), bold: true, size: 24 })],
                                })
                            ] : []),
                            new Paragraph({ text: client.address || "" }),
                            new Paragraph({ text: client.mf ? `MF: ${client.mf}` : "" }),
                        ]
                    })
                ]
            })
        ]
    }),
    new Paragraph({ text: "" }), // Spacer
  ];

  // --- 3. Tableau des Articles ---
  const tableHeaderColor = "F5F5F5";
  const headerTextSize = 20;

  const itemRows = invoice.items.map(item => {
    const itemTotal = item.quantity * item.unitPrice;
    return new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ text: item.description })] }),
        new TableCell({ children: [new Paragraph({ text: item.unit, alignment: AlignmentType.CENTER })] }),
        new TableCell({ children: [new Paragraph({ text: item.quantity.toString(), alignment: AlignmentType.CENTER })] }),
        new TableCell({ children: [new Paragraph({ text: item.unitPrice.toFixed(decimals), alignment: AlignmentType.RIGHT })] }),
        new TableCell({ children: [new Paragraph({ text: itemTotal.toFixed(decimals), alignment: AlignmentType.RIGHT })] }),
      ],
    });
  });

  const itemsTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      // Header Row
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({ shading: { fill: tableHeaderColor }, children: [new Paragraph({ children: [new TextRun({ text: "Désignation", bold: true, size: headerTextSize })] })] }),
          new TableCell({ shading: { fill: tableHeaderColor }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Unité", bold: true, size: headerTextSize })] })] }),
          new TableCell({ shading: { fill: tableHeaderColor }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Qté", bold: true, size: headerTextSize })] })] }),
          new TableCell({ shading: { fill: tableHeaderColor }, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `P.U. (${currencySymbol})`, bold: true, size: headerTextSize })] })] }),
          new TableCell({ shading: { fill: tableHeaderColor }, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `Total (${currencySymbol})`, bold: true, size: headerTextSize })] })] }),
        ],
      }),
      ...itemRows
    ],
  });

  // --- 4. Totaux ---
  const totalsRows = [];

  if (invoice.tvaApplicable) {
    totalsRows.push(
      new TableRow({
        children: [
            new TableCell({ borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder }, children: [new Paragraph({ text: "Total HT", alignment: AlignmentType.RIGHT, bold: true })] }),
            new TableCell({ borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder }, children: [new Paragraph({ text: `${subtotal.toFixed(decimals)} ${currencySymbol}`, alignment: AlignmentType.RIGHT })] }),
        ]
      })
    );
    totalsRows.push(
        new TableRow({
          children: [
              new TableCell({ borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder }, children: [new Paragraph({ text: `TVA (${invoice.tvaRate}%)`, alignment: AlignmentType.RIGHT, bold: true })] }),
              new TableCell({ borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder }, children: [new Paragraph({ text: `${tvaAmount.toFixed(decimals)} ${currencySymbol}`, alignment: AlignmentType.RIGHT })] }),
          ]
        })
    );
    if (invoice.timbreFiscal) {
        totalsRows.push(
            new TableRow({
              children: [
                  new TableCell({ borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder }, children: [new Paragraph({ text: "Timbre Fiscal", alignment: AlignmentType.RIGHT, bold: true })] }),
                  new TableCell({ borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder }, children: [new Paragraph({ text: `1.000 ${currencySymbol}`, alignment: AlignmentType.RIGHT })] }),
              ]
            })
        );
    }
  }

  // Ligne Total TTC
  totalsRows.push(
    new TableRow({
        children: [
            new TableCell({ 
                shading: { fill: "EBF5FB" },
                borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder },
                children: [new Paragraph({ text: invoice.tvaApplicable ? "Total TTC" : "Net à payer", alignment: AlignmentType.RIGHT, bold: true, size: 24, color: "2E86C1" })] 
            }),
            new TableCell({ 
                shading: { fill: "EBF5FB" },
                borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder },
                children: [new Paragraph({ text: `${total.toFixed(decimals)} ${currencySymbol}`, alignment: AlignmentType.RIGHT, bold: true, size: 24, color: "2E86C1" })] 
            }),
        ]
      })
  );

  const totalsTable = new Table({
      width: { size: 40, type: WidthType.PERCENTAGE },
      alignment: AlignmentType.RIGHT,
      borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideVertical: noBorder, insideHorizontal: noBorder },
      rows: totalsRows
  });

  // --- 5. Notes ---
  const notesSection = invoice.notes ? [
      new Paragraph({ text: "" }),
      new Paragraph({ text: "Notes / Conditions :", bold: true, color: "666666" }),
      new Paragraph({ text: invoice.notes })
  ] : [];

  // --- Assemblage ---
  const doc = new Document({
    sections: [
      {
        children: [
          headerTable,
          ...clientSection,
          itemsTable,
          new Paragraph({ text: "" }), // Spacer
          totalsTable,
          ...notesSection
        ],
      },
    ],
  });

  // Génération du Blob et téléchargement
  const blob = await Packer.toBlob(doc);
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const safeName = company.name.replace(/[^a-z0-9]/gi, '_').toUpperCase();
  link.download = `${safeName}_${invoice.number}.docx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

import PDFDocument from 'pdfkit';

export interface PrescriptionPdfData {
  patientName: string;
  patientDateOfBirth: string;
  prescriberName: string | null;
  medicationName: string;
  dosage: string | null;
  doseAmount: number | null;
  doseUnit: string | null;
  form: string | null;
  quantityPerDose: number | null;
  frequency: string | null;
  timesPerDay: number | null;
  timesOfDay: string[];
  foodInstruction: string | null;
  startDate: string;
  endDate: string | null;
  refillsAllowed: number | null;
  refillsUsed: number;
  instructions: string | null;
  prescribingNotes: string | null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function field(doc: PDFKit.PDFDocument, label: string, value: string) {
  doc.font('Helvetica-Bold').fontSize(10).text(label, { continued: true });
  doc.font('Helvetica').fontSize(10).text(`  ${value}`);
  doc.moveDown(0.4);
}

export function renderPrescriptionPdf(data: PrescriptionPdfData): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const chunks: Buffer[] = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks as unknown as Uint8Array[])));
    doc.on('error', reject);
  });

  doc.font('Helvetica-Bold').fontSize(18).text('SFLBiotrack', { align: 'left' });
  doc.font('Helvetica').fontSize(11).fillColor('#666').text('Prescription', { align: 'left' });
  doc.fillColor('#000');
  doc.moveDown(1);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#ccc').stroke();
  doc.moveDown(1);

  field(doc, 'Patient:', data.patientName);
  field(doc, 'Date of birth:', formatDate(data.patientDateOfBirth));
  field(doc, 'Prescribed by:', data.prescriberName ?? '—');
  doc.moveDown(0.5);

  doc.font('Helvetica-Bold').fontSize(13).text(data.medicationName);
  doc.moveDown(0.3);

  const doseLine = data.doseAmount && data.doseUnit
    ? `${data.doseAmount} ${data.doseUnit}`
    : data.dosage ?? '—';
  field(doc, 'Dose:', doseLine);
  if (data.form) field(doc, 'Form:', data.form.charAt(0) + data.form.slice(1).toLowerCase());
  if (data.quantityPerDose) field(doc, 'Quantity per dose:', String(data.quantityPerDose));

  const frequencyLine = data.timesPerDay && data.frequency
    ? `${data.frequency} (${data.timesPerDay}x per day)`
    : data.frequency ?? 'Not yet scheduled';
  field(doc, 'Frequency:', frequencyLine);

  if (data.timesOfDay.length > 0) field(doc, 'Times of day:', data.timesOfDay.join(', '));
  if (data.foodInstruction) {
    const label = { WITH_FOOD: 'With food', WITHOUT_FOOD: 'Without food', EITHER: 'With or without food' }[data.foodInstruction] ?? data.foodInstruction;
    field(doc, 'Meal timing:', label);
  }

  field(doc, 'Start date:', formatDate(data.startDate));
  field(doc, 'End date:', data.endDate ? formatDate(data.endDate) : 'Ongoing');

  if (data.refillsAllowed !== null) {
    field(doc, 'Refills:', `${data.refillsUsed} used of ${data.refillsAllowed} allowed`);
  }

  if (data.instructions) {
    doc.moveDown(0.3);
    field(doc, 'Instructions:', data.instructions);
  }
  if (data.prescribingNotes) {
    field(doc, 'Notes:', data.prescribingNotes);
  }

  doc.moveDown(1.5);
  doc.font('Helvetica').fontSize(8).fillColor('#999')
    .text(`Generated on ${new Date().toLocaleString('en-US')}`, { align: 'left' });

  doc.end();

  return done;
}

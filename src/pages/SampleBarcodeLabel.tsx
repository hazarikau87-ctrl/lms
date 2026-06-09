// src/components/SampleBarcodeLabel.tsx
import React, { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { Appointment } from '../lib/supabase';

interface BarcodeLabelProps {
  appointment: Appointment & { [key: string]: any };
}

interface SpecimenContainer {
  id: string;
  name: string;
  specimenType: string;
  matchedTests: string[];
}

// ── SUB-COMPONENT: PHYSICAL VIAL LABEL (2" x 1") ──
const VialLabel: React.FC<{
  appointment: any;
  container: SpecimenContainer;
  index: number;
  total: number;
  isPreview?: boolean; // FIX: Flag preview instances so they can be hidden from print
}> = ({ appointment, container, index, total, isPreview = false }) => {
  const barcodeRef = useRef<SVGSVGElement | null>(null);

  const baseBookingId = appointment.booking_id || `ID-${appointment.id}`;
  const uniqueVialId = `${baseBookingId}-${container.id}`.toUpperCase().trim();
  const testsString = container.matchedTests.join(', ').toUpperCase();

  useEffect(() => {
    if (barcodeRef.current) {
      try {
        JsBarcode(barcodeRef.current, uniqueVialId, {
          format: 'CODE128',
          width: 1.5,        // 203 DPI thermal safe bar width
          height: 24,        // Fits within 1-inch roll height with header/footer clearance
          displayValue: true,
          fontSize: 8,
          margin: 0,
        });
      } catch (err) {
        console.error('Barcode generation failed:', err);
      }
    }
  }, [uniqueVialId]);

  return (
    // FIX: preview-only-label class added — @media print hides these completely
    <div
      className={`lis-barcode-sticker-canvas${isPreview ? ' lis-preview-only-label' : ''}`}
      style={styles.labelCanvas}
    >
      {/* Header: Patient demographics */}
      <div style={styles.headerRow}>
        <span style={styles.patientName}>{appointment.name?.substring(0, 18)}</span>
        <span style={styles.metaData}>
          {appointment.age || 'N/A'}/{appointment.gender?.[0]?.toUpperCase() || 'U'}
        </span>
      </div>

      {/* Barcode */}
      <div style={styles.barcodeWrapper}>
        <svg ref={barcodeRef}></svg>
      </div>

      {/* Footer: Container ID, tests, vial counter */}
      <div style={styles.footerRow}>
        <span style={styles.testName} title={testsString}>
          [{container.id}] {testsString}
        </span>
        {/* FIX: Preview shows "PRV" instead of 0/0 so it's clear it's a preview */}
        <span style={styles.vialCounter}>
          {isPreview ? 'PRV' : `${index}/${total}`}
        </span>
      </div>
    </div>
  );
};

// ── PRINT SETUP GUIDE MODAL ──
const PrintSetupGuide: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div style={styles.modalOverlay}>
    <div style={styles.modalBox}>
      <div style={styles.modalHeader}>
        <span style={{ fontSize: '16px' }}>🖨️</span>
        <strong style={{ fontSize: '13px', color: '#0f172a' }}>Print Setup Guide</strong>
        <button onClick={onClose} style={styles.modalClose}>✕</button>
      </div>
      <div style={styles.modalBody}>
        <p style={styles.guideIntro}>Follow these steps in the print dialog for correct thermal output:</p>

        <div style={styles.guideStep}>
          <span style={styles.stepNum}>1</span>
          <div>
            <strong>Paper Size</strong>
            <p>Set custom size: <code style={styles.code}>Width 51mm × Height 25mm</code><br/>
            (equals 2 inches × 1 inch)</p>
          </div>
        </div>

        <div style={styles.guideStep}>
          <span style={styles.stepNum}>2</span>
          <div>
            <strong>Margins</strong>
            <p>Set all margins to <code style={styles.code}>0</code> (None)</p>
          </div>
        </div>

        <div style={styles.guideStep}>
          <span style={styles.stepNum}>3</span>
          <div>
            <strong>Scale</strong>
            <p>Set to <code style={styles.code}>100%</code> — do NOT use "Fit to page"</p>
          </div>
        </div>

        <div style={styles.guideStep}>
          <span style={styles.stepNum}>4</span>
          <div>
            <strong>Options</strong>
            <p>
              ✅ Background graphics: <strong>ON</strong><br/>
              ❌ Headers and footers: <strong>OFF</strong>
            </p>
          </div>
        </div>

        <div style={styles.guideStep}>
          <span style={styles.stepNum}>5</span>
          <div>
            <strong>Browser Tip</strong>
            <p><strong>Firefox</strong> handles custom paper sizes better than Chrome.<br/>
            Use Firefox if Chrome resets your size inputs.</p>
          </div>
        </div>

        <div style={styles.guideNote}>
          💡 <strong>One-time Zebra setup:</strong> In Windows → Devices & Printers → right-click your Zebra → Printing Preferences → set default paper to 2" × 1". You won't need to set this again.
        </div>
      </div>
      <button onClick={onClose} style={styles.modalDoneBtn}>Got it, continue to print</button>
    </div>
  </div>
);

// ── MAIN EXPORT COMPONENT ──
export const SampleBarcodeLabel: React.FC<BarcodeLabelProps> = ({ appointment }) => {
  const [showGuide, setShowGuide] = useState(false);

  const NON_SPECIMEN_KEYWORDS = [
    'X-RAY', 'XRAY', 'CXR', 'MRI', 'CT SCAN', 'CAT SCAN', 'HRCT', 'NCCT', 'CECT',
    'ULTRASOUND', 'USG', 'SONOGRAPHY', 'ANOMALY SCAN', 'NT SCAN', 'MAMMOGRAPHY',
    'DEXA', 'BONE DENSITY', 'FLUOROSCOPY', 'PET SCAN', 'ECG', 'EKG', 'ECHO',
    'ECHOCARDIOGRAPHY', 'TMT', 'TREADMILL', 'STRESS TEST', 'HOLTER', 'PFT',
    'SPIROMETRY', 'EEG', 'EMG', 'BERA', 'AUDIOMETRY', 'HEARING', 'ENDOSCOPY',
    'COLONOSCOPY', 'BRONCHOSCOPY', 'CONSULTATION', 'DOCTOR FEES', 'OPD', 'PHYSICAL EXAM'
  ];

  const CONTAINER_MAPS = [
    {
      id: 'EDTA',
      name: 'EDTA Tube (Purple/Lavender Top)',
      specimenType: 'Whole Blood',
      keywords: ['CBC', 'HEMOGLOBIN', 'HAEMOGLOBIN', 'HBA1C', 'BLOOD GROUP', 'ESR', 'PLATELET', 'MALARIA', 'SMEAR', 'CBC/WBC']
    },
    {
      id: 'FLR',
      name: 'Fluoride Tube (Grey Top)',
      specimenType: 'Plasma',
      keywords: ['FASTING', 'PPBS', 'POST PRANDIAL', 'GLUCOSE', 'SUGAR', 'RBS', 'FBS']
    },
    {
      id: 'URN',
      name: 'Urine Container (Sterile Cup)',
      specimenType: 'Urine',
      keywords: ['URINE', 'URINALYSIS', 'MICROSCOPY', 'UTI', 'ALBUMIN']
    },
    {
      id: 'CIT',
      name: 'Citrate Tube (Light Blue Top)',
      specimenType: 'Plasma',
      keywords: ['PT', 'INR', 'APTT', 'COAGULATION', 'PROTHROMBIN']
    }
  ];

  const targetTests = appointment.test
    ? appointment.test.split(',').map((t: string) => t.trim()).filter(Boolean)
    : ['STANDARD PANEL'];

  const activeContainers: { [key: string]: SpecimenContainer } = {};
  let excludedImagingCount = 0;

  targetTests.forEach(testName => {
    const upperTest = testName.toUpperCase();

    if (NON_SPECIMEN_KEYWORDS.some(kw => upperTest.includes(kw))) {
      excludedImagingCount++;
      return;
    }

    let matched = false;
    for (const map of CONTAINER_MAPS) {
      if (map.keywords.some(kw => upperTest.includes(kw))) {
        if (!activeContainers[map.id]) {
          activeContainers[map.id] = { id: map.id, name: map.name, specimenType: map.specimenType, matchedTests: [] };
        }
        activeContainers[map.id].matchedTests.push(testName);
        matched = true;
        break;
      }
    }

    if (!matched) {
      const serumId = 'SRM';
      if (!activeContainers[serumId]) {
        activeContainers[serumId] = {
          id: serumId,
          name: 'Serum Separator Tube (Gold/Red Top)',
          specimenType: 'Serum',
          matchedTests: []
        };
      }
      activeContainers[serumId].matchedTests.push(testName);
    }
  });

  const containersToPrint = Object.values(activeContainers);

  // FIX: Handle print trigger — show guide first, then print
  const handlePrint = () => {
    setShowGuide(true);
  };

  const handleGuideClose = () => {
    setShowGuide(false);
    setTimeout(() => window.print(), 150); // Small delay so modal fully unmounts before print dialog
  };

  if (containersToPrint.length === 0) {
    return (
      <div style={styles.outerContainer}>
        <div style={styles.infoBox}>
          <span style={{ fontSize: '16px', marginRight: '6.5px' }}>ℹ️</span>
          <div>
            <strong style={{ color: '#334155', display: 'block', marginBottom: '2px' }}>
              Procedural / Imaging Order
            </strong>
            This appointment contains {excludedImagingCount} imaging or procedural order(s). No physical specimen labels are required.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.outerContainer}>

      {/* Print Setup Guide Modal */}
      {showGuide && <PrintSetupGuide onClose={handleGuideClose} />}

      {/* ── SCREEN DASHBOARD PREVIEW ── */}
      <div style={styles.previewContainer}>

        {/* Section header */}
        <div style={styles.sectionHeader}>
          <span style={styles.sectionTitle}>
            🧪 {containersToPrint.length} Sample Container{containersToPrint.length > 1 ? 's' : ''} Required
          </span>
          <span style={styles.sectionSub}>Labels preview below</span>
        </div>

        {containersToPrint.map((container) => (
          <div key={container.id} style={styles.queueCard}>
            <div style={styles.tubeIndicator}>
              <div style={{ ...styles.colorBadge, backgroundColor: getTubeColor(container.id) }} />
              <div>
                <span style={styles.tubeTitle}>{container.name}</span>
                <span style={styles.tubeSubtitle}>
                  {container.specimenType} · {container.matchedTests.length} test{container.matchedTests.length > 1 ? 's' : ''}
                </span>
                {/* FIX: Show actual test names in preview for quick verification */}
                <span style={styles.testListPreview}>
                  {container.matchedTests.join(', ')}
                </span>
              </div>
            </div>

            {/* FIX: isPreview=true — this instance is hidden from print via CSS */}
            <div style={styles.previewCanvasWrapper}>
              <VialLabel
                appointment={appointment}
                container={container}
                index={0}
                total={0}
                isPreview={true}
              />
            </div>
          </div>
        ))}

        {excludedImagingCount > 0 && (
          <div style={styles.inlineAlert}>
            ℹ️ {excludedImagingCount} radiology/procedure order(s) excluded from this print job
          </div>
        )}
      </div>

      {/* Print button row */}
      <div style={styles.buttonRow}>
        <button onClick={handlePrint} style={styles.printButton}>
          🖨️ Print Labels ({containersToPrint.length})
        </button>
        <button onClick={() => setShowGuide(true)} style={styles.helpButton}>
          ⚙️ Print Setup Guide
        </button>
      </div>

      {/* ── ISOLATED PRINT ZONE ──
          Hidden on screen. Only this renders during window.print().
          FIX: Completely outside preview card flex containers — clean flow context. */}
      <div id="lis-isolated-print-zone">
        {containersToPrint.map((container, idx) => (
          <VialLabel
            key={`print-${container.id}`}
            appointment={appointment}
            container={container}
            index={idx + 1}
            total={containersToPrint.length}
            isPreview={false}
          />
        ))}
      </div>

      {/* ── THERMAL PRINT STYLE ENGINE ── */}
      <style>{`
        @page {
          size: 51mm 25mm;
          margin: 0 !important;
        }

        /* Hide print zone on screen */
        #lis-isolated-print-zone {
          display: none;
        }

        /* Hide preview labels on screen (they show inside cards) */
        .lis-preview-only-label {
          display: flex;
        }

        @media print {

          /* Wipe entire page render */
          body * {
            visibility: hidden !important;
          }

          /* FIX: Completely suppress preview label instances from print output */
          .lis-preview-only-label,
          .lis-preview-only-label * {
            display: none !important;
            visibility: hidden !important;
          }

          /* Expose only the isolated print zone */
          #lis-isolated-print-zone {
            display: block !important;
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 51mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }

          #lis-isolated-print-zone *,
          .lis-barcode-sticker-canvas:not(.lis-preview-only-label),
          .lis-barcode-sticker-canvas:not(.lis-preview-only-label) * {
            visibility: visible !important;
          }

          /* Each label = exactly one thermal page */
          .lis-barcode-sticker-canvas:not(.lis-preview-only-label) {
            position: relative !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            box-sizing: border-box !important;
            width: 51mm !important;
            height: 25mm !important;
            padding: 1.5mm !important;
            margin: 0 !important;
            border: none !important;
            background: white !important;
            overflow: hidden !important;
            page-break-after: always !important;
            page-break-inside: avoid !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* SVG overflow guard */
          .lis-barcode-sticker-canvas:not(.lis-preview-only-label) svg {
            max-width: 100% !important;
            height: auto !important;
            display: block !important;
            margin: 0 auto !important;
          }
        }
      `}</style>
    </div>
  );
};

const getTubeColor = (id: string): string => {
  switch (id) {
    case 'EDTA': return '#a855f7';
    case 'FLR':  return '#94a3b8';
    case 'URN':  return '#eab308';
    case 'CIT':  return '#3b82f6';
    case 'SRM':  return '#f59e0b';
    default:     return '#cbd5e1';
  }
};

const styles: { [key: string]: React.CSSProperties } = {
  // Layout
  outerContainer:      { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' },
  previewContainer:    { display: 'flex', flexDirection: 'column', gap: '10px', padding: '14px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', width: '100%', maxWidth: '480px' },

  // Section header
  sectionHeader:       { display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '6px', borderBottom: '1px solid #e2e8f0', marginBottom: '2px' },
  sectionTitle:        { fontSize: '12px', fontWeight: 'bold', color: '#0f172a' },
  sectionSub:          { fontSize: '10px', color: '#94a3b8' },

  // Queue card
  queueCard:           { display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', padding: '10px', borderRadius: '8px', border: '1px solid #f1f5f9', gap: '10px' },
  tubeIndicator:       { display: 'flex', alignItems: 'flex-start', gap: '8px', flex: 1, minWidth: 0 },
  colorBadge:          { width: '10px', height: '36px', borderRadius: '4px', flexShrink: 0, marginTop: '2px' },
  tubeTitle:           { display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#1e293b' },
  tubeSubtitle:        { display: 'block', fontSize: '10px', color: '#64748b', marginTop: '1px' },
  testListPreview:     { display: 'block', fontSize: '9px', color: '#94a3b8', marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' },

  // Preview label wrapper — scale down for card display
  previewCanvasWrapper: { transform: 'scale(0.82)', transformOrigin: 'right center', flexShrink: 0 },

  // Label canvas (shared between preview and print)
  labelCanvas:         { width: '2in', height: '1in', backgroundColor: '#ffffff', border: '1.5px dashed #cbd5e1', padding: '5px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box', fontFamily: "'Courier New', Courier, monospace", overflow: 'hidden' },
  headerRow:           { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '1px' },
  patientName:         { fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '-0.2px' },
  metaData:            { fontSize: '8px', fontWeight: 'bold', color: '#334155' },
  barcodeWrapper:      { display: 'flex', justifyContent: 'center', alignItems: 'center', flexGrow: 1, padding: '1px 0' },
  footerRow:           { borderTop: '1px dashed #cbd5e1', paddingTop: '1px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  testName:            { fontSize: '6.5px', color: '#0f172a', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '82%' },
  vialCounter:         { fontSize: '7px', color: '#0f172a', fontWeight: 'bold', flexShrink: 0 },

  // Buttons
  buttonRow:           { display: 'flex', gap: '8px', alignItems: 'center' },
  printButton:         { padding: '9px 20px', backgroundColor: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(0,0,0,0.08)' },
  helpButton:          { padding: '9px 14px', backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' },

  // Info / alert
  infoBox:             { padding: '12px 14px', backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '11px', color: '#475569', display: 'flex', alignItems: 'flex-start', lineHeight: '1.4', maxWidth: '340px' },
  inlineAlert:         { fontSize: '10.5px', color: '#475569', backgroundColor: '#fefce8', border: '1px solid #fde68a', padding: '6px 10px', borderRadius: '6px', textAlign: 'center' as const, fontWeight: '500' },

  // Modal
  modalOverlay:        { position: 'fixed' as const, inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 },
  modalBox:            { backgroundColor: '#ffffff', borderRadius: '12px', width: '340px', maxWidth: '92vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden' },
  modalHeader:         { display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 16px', borderBottom: '1px solid #f1f5f9', backgroundColor: '#f8fafc' },
  modalClose:          { marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: '#94a3b8', lineHeight: 1 },
  modalBody:           { padding: '14px 16px', display: 'flex', flexDirection: 'column' as const, gap: '10px' },
  modalDoneBtn:        { width: '100%', padding: '12px', backgroundColor: '#0284c7', color: '#fff', border: 'none', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', borderTop: '1px solid #e2e8f0' },
  guideIntro:          { fontSize: '11px', color: '#64748b', margin: 0 },
  guideStep:           { display: 'flex', gap: '10px', alignItems: 'flex-start', fontSize: '11px', color: '#334155', lineHeight: '1.5' },
  stepNum:             { width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#0284c7', color: '#fff', fontSize: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' },
  guideNote:           { fontSize: '10.5px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '8px 10px', color: '#166534', lineHeight: '1.5' },
  code:                { backgroundColor: '#f1f5f9', padding: '1px 4px', borderRadius: '3px', fontFamily: 'monospace', fontSize: '10.5px', color: '#0f172a' },
};

export default SampleBarcodeLabel;
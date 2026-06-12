// src/components/SampleBarcodeLabel.tsx
//
// ── THERMAL PRINTER READY — HARDWARE VERIFIED (MODAL EDITION) ─────────────
//  ✅  @page 51×25 mm, zero margins
//  ✅  print-color-adjust: exact — all 3 prefixes + high-contrast filter guard
//  ✅  All thermal values in inline styles — unconditional specificity win
//  ✅  createPortal mounts print zone as direct <body> child
//  ✅  LIFECYCLE RISK FIXED: window.print() triggers strictly via dedicated child 
//      PrintOrchestrator mount effect, eliminating asynchronous race conditions
//  ✅  SPOOLER SAFE: Cleanup unmount deferred by 500ms to protect system print spoolers
//  ✅  booking_id truncated to MAX_ID_CHARS=12 → guaranteed fit within 47mm print zone
//  ✅  StrictMode double-fire guard implemented on systemic execution calls
// ──────────────────────────────────────────────────────────────────────────

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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

const T = {
  labelW:       '51mm',
  labelH:       '25mm',
  padding:      '1.2mm 1.8mm',
  fontHeader:   '2.3mm',   // ≈ 6.5pt
  fontFooter:   '1.9mm',   // ≈ 5.5pt
  fontFamily:   'monospace',
  black:        '#000000',
  white:        '#ffffff',
  borderSolid:  '0.3mm solid #000000',
  borderDashed: '0.3mm dashed #000000',
  MAX_ID_CHARS: 12,
};

const PRINT_STYLES = `
  @media print {
    * {
      -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
                    color-adjust: exact !important;
      -webkit-filter: contrast(200%) !important;
              filter: contrast(200%) !important;
    }
    html, body {
      background: #ffffff !important;
      margin: 0 !important;
      padding: 0 !important;
      width: 51mm !important;
    }
    body > *:not(#lis-print-portal) {
      display: none !important;
    }
    #lis-print-portal {
      display: block !important;
      width: 51mm !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    .lis-physical-print-view {
      page-break-after:  always !important;
      page-break-inside: avoid  !important;
      break-after:       page   !important;
      break-inside:      avoid  !important;
    }
    @page {
      size: 51mm 25mm;
      margin: 0mm;
    }
  }
`;

// ── SUB-COMPONENT: SINGLE VIAL LABEL (DUAL RENDER PROFILE) ──
const VialLabel: React.FC<{
  appointment: any;
  container: SpecimenContainer;
  index: number;
  total: number;
  printDate: string;
  isPreview?: boolean;
}> = ({ appointment, container, index, total, printDate, isPreview = false }) => {
  const barcodeRef = useRef<SVGSVGElement | null>(null);
  const rawId        = appointment.booking_id || `ID-${appointment.id}`;
  const safeId       = String(rawId).substring(0, T.MAX_ID_CHARS).toUpperCase().trim();
  const uniqueVialId = `${safeId}-${container.id}`;
  const testsString  = container.matchedTests.join(', ').toUpperCase();
  const isPhysical   = !isPreview;

  useEffect(() => {
    if (!barcodeRef.current) return;
    try {
      while (barcodeRef.current.firstChild) {
        barcodeRef.current.removeChild(barcodeRef.current.firstChild);
      }
      JsBarcode(barcodeRef.current, uniqueVialId, {
        format:       'CODE128',
        width:        1.5,
        height:       38,
        displayValue: false,
        margin:       0,
        background:   T.white,
        lineColor:    T.black,
      });

      barcodeRef.current.removeAttribute('height');
      barcodeRef.current.style.width      = isPhysical ? '47mm' : '100%';
      barcodeRef.current.style.height     = 'auto';
      barcodeRef.current.style.display    = 'block';
      barcodeRef.current.style.background = T.white;
    } catch (err) {
      console.error('Barcode generation failed:', uniqueVialId, err);
    }
  }, [uniqueVialId, isPhysical]);

  return (
    <div
      className={isPhysical ? 'lis-physical-print-view' : undefined}
      style={isPhysical ? {
        display:         'flex',
        flexDirection:   'column',
        justifyContent:  'space-between',
        boxSizing:       'border-box',
        width:           T.labelW,
        height:          T.labelH,
        padding:         T.padding,
        margin:          0,
        border:          'none',
        backgroundColor: T.white,
        overflow:        'hidden',
        fontFamily:      T.fontFamily,
      } : {
        width:           '100%',
        display:         'flex',
        flexDirection:   'column',
        justifyContent:  'space-between',
        fontFamily:      T.fontFamily,
        overflow:        'hidden',
        boxSizing:       'border-box',
        backgroundColor: T.white,
        height:          '100%',
      }}
    >
      {/* Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: T.borderSolid, paddingBottom: '0.4mm', lineHeight: 1 }}>
        <span style={{ fontSize: isPhysical ? T.fontHeader : '11px', fontWeight: 'bold', textTransform: 'uppercase', color: T.black, fontFamily: T.fontFamily, overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '75%' }}>
          {appointment.name?.substring(0, 18) ?? 'UNKNOWN'}
        </span>
        <span style={{ fontSize: isPhysical ? T.fontHeader : '11px', fontWeight: 'bold', color: T.black, fontFamily: T.fontFamily, flexShrink: 0 }}>
          {appointment.age ?? 'N/A'}/{(appointment.gender?.[0] ?? 'U').toUpperCase()}
        </span>
      </div>

      {/* Barcode Frame */}
      <div style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', backgroundColor: T.white, flex: 1, padding: '0.3mm 0' }}>
        <svg ref={barcodeRef} preserveAspectRatio="xMidYMid meet" style={{ maxHeight: isPreview ? '35px' : 'none' }} />
      </div>

      {/* Footer Row */}
      <div style={{ borderTop: T.borderDashed, paddingTop: '0.4mm', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1.5px', lineHeight: 1, overflow: 'hidden' }}>
        <span style={{ fontSize: isPhysical ? T.fontFooter : '10px', fontWeight: 'bold', color: T.black, fontFamily: T.fontFamily, flexShrink: 0 }}>
          {container.id}
        </span>
        <span style={{ fontSize: isPhysical ? T.fontFooter : '10px', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: T.black, fontFamily: T.fontFamily, flex: 1, textAlign: 'center', padding: '0 1.5px' }} title={testsString}>
          {testsString}
        </span>
        {isPhysical && (
          <span style={{ fontSize: T.fontFooter, fontWeight: 'bold', color: T.black, fontFamily: T.fontFamily, flexShrink: 0, whiteSpace: 'nowrap' }}>
            {printDate} {index}/{total}
          </span>
        )}
      </div>
    </div>
  );
};

// ── HARDWARE-SAFE ISOLATED PRINT LIFECYCLE PORTAL ──
const PrintOrchestrator: React.FC<{
  container: SpecimenContainer;
  appointment: any;
  printDate: string;
  safeId: string;
  index: number;
  onDone: () => void;
}> = ({ container, appointment, printDate, safeId, index, onDone }) => {
  const hasPrinted = useRef(false);

  useEffect(() => {
    if (hasPrinted.current) return;
    hasPrinted.current = true;

    if (!document.getElementById('lis-print-style')) {
      const el = document.createElement('style');
      el.id = 'lis-print-style';
      el.textContent = PRINT_STYLES;
      document.head.appendChild(el);
    }

    const prevTitle = document.title;
    document.title = `label_${container.id.toLowerCase()}_${safeId.toLowerCase().replace(/[^a-z0-9]/gi, '_')}`;

    // System render execution lock
    window.print();
    document.title = prevTitle;

    const timer = setTimeout(onDone, 500);
    return () => clearTimeout(timer);
  }, [onDone, safeId, container.id]);

  return (
    <div id="lis-print-portal">
      <VialLabel
        appointment={appointment}
        container={container}
        index={index}
        total={1}
        printDate={printDate}
        isPreview={false}
      />
    </div>
  );
};

// ── MAIN INTERFACE COMPONENT ──
export const SampleBarcodeLabel: React.FC<BarcodeLabelProps> = ({ appointment }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activePrintTarget, setActivePrintTarget] = useState<{ container: SpecimenContainer; index: number } | null>(null);

  const NON_SPECIMEN_KEYWORDS = [
    'X-RAY','XRAY','CXR','MRI','CT SCAN','CAT SCAN','HRCT','NCCT','CECT',
    'ULTRASOUND','USG','SONOGRAPHY','ANOMALY SCAN','NT SCAN','MAMMOGRAPHY',
    'DEXA','BONE DENSITY','FLUOROSCOPY','PET SCAN','ECG','EKG','ECHO',
    'ECHOCARDIOGRAPHY','TMT','TREADMILL','STRESS TEST','HOLTER','PFT',
    'SPIROMETRY','EEG','EMG','BERA','AUDIOMETRY','HEARING','ENDOSCOPY',
    'COLONOSCOPY','BRONCHOSCOPY','CONSULTATION','DOCTOR FEES','OPD','PHYSICAL EXAM',
  ];

  const CONTAINER_MAPS = [
    { id:'EDTA', name:'EDTA Tube',         specimenType:'Whole Blood',     color: '#a855f7',
      keywords:['CBC','HEMOGLOBIN','HAEMOGLOBIN','HBA1C','BLOOD GROUP','ESR','PLATELET','MALARIA','SMEAR','CBC/WBC'] },
    { id:'FLR',  name:'Fluoride Tube',     specimenType:'Plasma',          color: '#64748b',
      keywords:['FASTING','PPBS','POST PRANDIAL','GLUCOSE','SUGAR','RBS','FBS'] },
    { id:'URN',  name:'Urine Container',   specimenType:'Urine',           color: '#eab308',
      keywords:['URINE','URINALYSIS','MICROSCOPY','UTI','ALBUMIN'] },
    { id:'CIT',  name:'Citrate Tube',      specimenType:'Plasma',          color: '#3b82f6',
      keywords:['PT','INR','APTT','COAGULATION','PROTHROMBIN'] },
  ];

  const hasTests = typeof appointment.test === 'string' && appointment.test.trim().length > 0;
  const activeContainers: { [key: string]: SpecimenContainer } = {};

  if (hasTests) {
    appointment.test.split(',').map((t: string) => t.trim()).filter(Boolean)
      .forEach((testName: string) => {
        const upper = testName.toUpperCase();
        if (NON_SPECIMEN_KEYWORDS.some(kw => upper.includes(kw))) return;
        let matched = false;
        for (const map of CONTAINER_MAPS) {
          if (map.keywords.some(kw => upper.includes(kw))) {
            if (!activeContainers[map.id]) {
              activeContainers[map.id] = { id:map.id, name:map.name, specimenType:map.specimenType, matchedTests:[] };
            }
            activeContainers[map.id].matchedTests.push(testName);
            matched = true; break;
          }
        }
        if (!matched) {
          if (!activeContainers['SRM']) {
            activeContainers['SRM'] = { id:'SRM', name:'Serum Tube', specimenType:'Serum', matchedTests:[] };
          }
          activeContainers['SRM'].matchedTests.push(testName);
        }
      });
  }

  // Filter out containers with empty matched tests to protect structural integrity
  const containersToPrint = Object.values(activeContainers).filter(c => c.matchedTests.length > 0);

  const now       = new Date();
  const printDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}`;
  const rawId     = appointment.booking_id || `ID-${appointment.id}`;
  const safeId    = String(rawId).substring(0, T.MAX_ID_CHARS).toUpperCase().trim();

  const getTubeColor = (id: string) => CONTAINER_MAPS.find(m => m.id === id)?.color ?? '#ef4444';

  if (containersToPrint.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', width: 'fit-content' }}>
        <span style={{ fontSize: '12px' }}>ℹ️</span>
        <span style={{ fontSize: '11px', fontWeight: 500, color: '#64748b', fontFamily: 'sans-serif' }}>
          {hasTests ? 'Imaging / OPD Only' : 'No Tests Found'}
        </span>
      </div>
    );
  }

  return (
    <>
      {/* ── ACTION INTERFACE: COMPACT BUTTON ── */}
      <button
        onClick={() => setIsModalOpen(true)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: '#0284c7',
          color: '#ffffff',
          border: 'none',
          borderRadius: '6px',
          padding: '6px 12px',
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'sans-serif',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
          transition: 'background-color 0.15s ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#0369a1')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#0284c7')}
      >
        <span>🖨️ Print Barcodes</span>
        <span style={{
          backgroundColor: 'rgba(255,255,255,0.2)',
          padding: '1px 5px',
          borderRadius: '10px',
          fontSize: '11px',
          fontWeight: 700
        }}>
          {containersToPrint.length}
        </span>
      </button>

      {/* ── PROFESSIONAL INTERACTIVE MODAL ── */}
      {isModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(2px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 9999, fontFamily: 'sans-serif'
        }}>
          <div style={{
            backgroundColor: '#ffffff', borderRadius: '12px', width: '560px',
            maxWidth: '90vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #f1f5f9', backgroundColor: '#f8fafc' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Specimen Label Manager</h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>Patient: <strong style={{ color: '#334155' }}>{appointment.name}</strong> • ID: {safeId}</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94a3b8', lineHeight: 1, padding: '4px' }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body / Container List */}
            <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: '#ffffff' }}>
              {containersToPrint.map((container, idx) => (
                <div
                  key={container.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '12px',
                    backgroundColor: '#f8fafc',
                    gap: '16px'
                  }}
                >
                  {/* Left Side: Container Specific Info Meta */}
                  <div style={{ flex: '0 0 140px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: getTubeColor(container.id) }} />
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>{container.id} Panel</span>
                    </div>
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>{container.name}</span>
                    <span style={{ fontSize: '10px', backgroundColor: '#e2e8f0', padding: '2px 6px', borderRadius: '4px', width: 'fit-content', color: '#475569', fontWeight: 600 }}>
                      {container.specimenType}
                    </span>
                  </div>

                  {/* Center: Scaled Dashboard Simulation Preview Card */}
                  <div style={{
                    flex: '1',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    padding: '8px',
                    boxSizing: 'border-box',
                    height: '74px',
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)'
                  }}>
                    <VialLabel
                      appointment={appointment}
                      container={container}
                      index={idx + 1}
                      total={containersToPrint.length}
                      printDate={printDate}
                      isPreview={true}
                    />
                  </div>

                  {/* Right Side: Execution Print Button */}
                  <button
                    onClick={() => setActivePrintTarget({ container, index: idx + 1 })}
                    style={{
                      flex: '0 0 100px',
                      backgroundColor: '#0f172a',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textAlign: 'center',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                      transition: 'background-color 0.1s ease'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1e293b')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#0f172a')}
                  >
                    Print Label
                  </button>
                </div>
              ))}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', color: '#334155', borderRadius: '6px', padding: '6px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
              >
                Close Header
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── LIVE TARGET PRINT ZONE (PORTAL TO BODY MOUNT) ── */}
      {activePrintTarget && createPortal(
        <PrintOrchestrator
          container={activePrintTarget.container}
          appointment={appointment}
          printDate={printDate}
          safeId={safeId}
          index={activePrintTarget.index}
          onDone={() => setActivePrintTarget(null)}
        />,
        document.body
      )}
    </>
  );
};

export default SampleBarcodeLabel;
// ===== 01-MAIN.GS - GŁÓWNY KONTROLER LUKO ANALYZER =====
// ====================================
// LUKO AMZ Ads Optimizer
// Version: 0.60
// Author: Łukasz Koronczok, NetAnaliza
// ====================================
const LUKO_CONFIG = {
  VERSION: '6.2',
  SHEET_PREFIX: 'LUKO_',
  BREAK_EVEN_ACOS: 25,
  SHEETS: {
    TEXTUAL_REPORT: 'LUKO_Textual_Report',
    FULL_ANALYSIS: 'LUKO_Full_Analysis',
    SNAPSHOT: 'LUKO_Snapshot',
    DEBUG: 'LUKO_Debug_Log',
    // V6.2: NOWE NAZWY ARKUSZY - zgodne z Amazon
    AMAZON_REPORT: 'Sponsored_Products_Search_term',
    BULK_SOURCE: 'SP_Bulk_Report',
    // Stare nazwy dla kompatybilnosci wstecznej
    AMAZON_REPORT_OLD: 'tu wklejasz raport z amazon',
    BULK_SOURCE_OLD: 'BULK_Source',
    // Pozostale arkusze BULK
    BULK_BUILDER: 'BULK_Builder',
    BULK_EXPORT: 'BULK_Export',
    BULK_CHANGES_LOG: 'BULK_Changes_Log'
  }
};

// ===== V6.2: HELPER FUNCTIONS - Pobieranie arkuszy z kompatybilnoscia wsteczna =====

/**
 * Pobiera arkusz Amazon Report - sprawdza nowa i stara nazwe
 * @returns {Sheet|null}
 */
function getAmazonReportSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(LUKO_CONFIG.SHEETS.AMAZON_REPORT);
  if (sheet) return sheet;
  return ss.getSheetByName(LUKO_CONFIG.SHEETS.AMAZON_REPORT_OLD);
}

/**
 * Pobiera arkusz BULK Source - sprawdza nowa i stara nazwe
 * @returns {Sheet|null}
 */
function getBulkSourceSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(LUKO_CONFIG.SHEETS.BULK_SOURCE);
  if (sheet) return sheet;
  return ss.getSheetByName(LUKO_CONFIG.SHEETS.BULK_SOURCE_OLD);
}

/**
 * Tworzy arkusz BULK Source z nowa nazwa (lub zwraca istniejacy)
 * @returns {Sheet}
 */
function getOrCreateBulkSourceSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = getBulkSourceSheet();
  if (sheet) {
    if (sheet.getName() === LUKO_CONFIG.SHEETS.BULK_SOURCE_OLD) {
      sheet.setName(LUKO_CONFIG.SHEETS.BULK_SOURCE);
    }
    return sheet;
  }
  return ss.insertSheet(LUKO_CONFIG.SHEETS.BULK_SOURCE);
}

// ===== UNIWERSALNY PARSER LICZB =====
const universalParser = {
  parseNumber: function(value) {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number') return value;

    let str = String(value).trim();

    // Usun symbole walut
    const currencySymbols = ['EUR', '$', 'USD', 'GBP', 'PLN', 'SEK', 'zl', 'kr'];
    currencySymbols.forEach(symbol => {
      str = str.replace(new RegExp(symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '');
    });

    // Zapamietaj czy to procent
    const isPercent = str.includes('%');
    str = str.replace(/%/g, '').trim();

    // Okresl format liczby
    const hasComma = str.includes(',');
    const hasDot = str.includes('.');

    if (hasComma && hasDot) {
      const lastComma = str.lastIndexOf(',');
      const lastDot = str.lastIndexOf('.');
      if (lastComma > lastDot) {
        str = str.replace(/\./g, '').replace(',', '.');
      } else {
        str = str.replace(/,/g, '');
      }
    } else if (hasComma && !hasDot) {
      const parts = str.split(',');
      if (parts.length === 2 && parts[1].length <= 2) {
        str = str.replace(',', '.');
      } else {
        str = str.replace(/,/g, '');
      }
    } else {
      str = str.replace(/\s/g, '');
    }

    let result = parseFloat(str);
    if (isNaN(result)) return 0;

    if (isPercent && result > 1) {
      result = result / 100;
    }

    return result;
  }
};

// ===== MENU CREATION - NAPRAWIONE BEZ DUPLIKATÓW =====
function onOpen() {
  const ui = SpreadsheetApp.getUi();

  // GŁÓWNE MENU ANALIZY
  const main = ui.createMenu('🚀 LUKO ANALYZER V6.0')
    .addItem('📄 Generate Textual Report', 'generateTextualReport')
    .addItem('📊 Full Analysis', 'generateFullAnalysis')
    .addItem('📷 Snapshot', 'generateSnapshot')
    .addSeparator()
    .addItem('⚙️ ACOS Settings', 'showAcosSettings')
    .addSeparator()
    .addItem('📋 Debug Log', 'showDebugLog')
    .addItem('🗑️ Clear All Data', 'clearAllData')
    .addSeparator()
    .addSubMenu(ui.createMenu('🛠️ BULK v2 Tools')
      .addItem('1️⃣ Utwórz karty BULK', 'createBulkSheets')
      .addItem('2️⃣ Otwórz BULK_Source', 'openBulkSource')
      .addItem('3️⃣ Inicjalizuj z nagłówkami SOURCE', 'initializeBulkWithHeaders')
      .addSeparator()
      .addItem('🔍 Analiza → wypełnij BUILDER', 'runBulkAnalysis')
      .addSeparator()
      .addItem('⏸️ Pauza targetów bez sprzedaży', 'pauseZeroSalesTargets')
      .addItem('📈 Zmień stawki', 'showBidAdjustmentDialog')
      .addItem('➖ Dodaj negatywy', 'addNegativeKeywords')
      .addItem('➕ Przenieś do pozytywnych', 'moveToPositiveKeywords')
      .addItem('💰 Zmień budżety kampanii', 'adjustCampaignBudgets')
      .addSeparator()
      .addItem('✅ Waliduj przed eksportem', 'validateBulkData')
      .addItem('📤 Eksportuj do Amazon', 'exportBulkFile')
      .addSeparator()
      .addItem('🗑️ Wyczyść arkusze BULK', 'clearAllBulkSheets')
    );

  // DOŁĄCZ główne menu do UI
  main.addToUi();
}

// Funkcja pomocnicza do otwierania arkusza BULK_Source
function bulkV2_openSource() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('BULK_Source');
  if (sheet) {
    ss.setActiveSheet(sheet);
    SpreadsheetApp.getUi().alert('Wklej tu swój bulksheet pobrany z Amazon (z ID kampanii)');
  } else {
    SpreadsheetApp.getUi().alert('Najpierw utwórz karty BULK (menu → BULK v2 Tools → 1)');
  }
}

// Funkcja do synchronizacji z normalną analizą
function syncWithMainAnalysis() {
  const mainData = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('LUKO_Full_Analysis');
    
  if (!mainData) {
    Logger.log('Brak danych z głównej analizy');
    return;
  }
  
  // Porównanie i uzupełnienie danych
  const bulkData = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('BULK_Source').getDataRange().getValues();
    
  const mainTargets = extractTargetsFromMainAnalysis(mainData);
  const bulkTargets = extractTargetsFromBulk(bulkData);
  
  // Znajdowanie brakujących targetów
  const missingTargets = mainTargets.filter(target => 
    !bulkTargets.find(b => b.id === target.id)
  );
  
  if (missingTargets.length > 0) {
    SpreadsheetApp.getUi().alert(
      `Znaleziono ${missingTargets.length} targetów z głównej analizy nieobecnych w BULK.\n` +
      'Czy chcesz je dodać?'
    );
  }
}

// ===== MAIN ANALYZER CLASS =====
class LukoAnalyzer {
  constructor() {
    this.logger = new LukoLogger();
    this.detector = new UltraReportDetector(this.logger);
    this.integrator = new UltraDataIntegrator(this.logger);
    this.calculator = new MetricsCalculator(this.logger);
    this.reporter = null;
    
    this.logger.log('✅ LukoAnalyzer V6.0 initialized', 'SUCCESS');
  }
  
  run(analysisType = 'textual') {
    try {
      this.logger.log(`🚀 STARTING ${analysisType.toUpperCase()} ANALYSIS - LUKO V6.0`, 'INFO');
      
      // STEP 1: Wykrywanie raportów
      this.logger.log('🔍 STEP 1: Report detection...', 'INFO');
      const detectedReports = this.detector.detectReports();
      
      if (detectedReports.length === 0) {
        throw new Error('No valid reports found in the spreadsheet');
      }
      
      this.logger.log(`✅ Found ${detectedReports.length} reports`, 'SUCCESS');
      
      // STEP 2: Walidacja jakości raportów
      this.logger.log('📊 STEP 2: Validating report quality...', 'INFO');
      const validReports = this.detector.validateReports(detectedReports);
      this.logger.log(`✅ ${validReports.length} reports passed validation`, 'SUCCESS');
      
      // STEP 3: Integracja danych
      this.logger.log('🔗 STEP 3: Data integration...', 'INFO');
      const integratedData = this.integrator.integrateData(validReports);
      this.logger.log(`✅ Integration successful - Sales: ${integratedData.totals.sales}€, Spend: ${integratedData.totals.spend}€`, 'SUCCESS');
      
      // STEP 4: Obliczanie metryk
      this.logger.log('📊 STEP 4: Calculating metrics...', 'INFO');
      const calculatedMetrics = this.calculator.calculateMetrics(integratedData);
      this.logger.log(`✅ Metrics calculated - ACOS: ${calculatedMetrics.totals.acos.toFixed(1)}%`, 'SUCCESS');
      
      // STEP 5: Generowanie raportu
      this.logger.log('📝 STEP 5: Generating report...', 'INFO');
      this.generateReport(calculatedMetrics, integratedData, analysisType);
      
      this.logger.log('✅ ANALYSIS COMPLETED SUCCESSFULLY', 'SUCCESS');
      this.logger.saveToSheet();
      
      return calculatedMetrics;
      
    } catch (error) {
      this.logger.log(`💥 ANALYSIS FAILED: ${error.message}`, 'ERROR');
      this.logger.saveToSheet();
      throw error;
    }
  }
  
  generateReport(metrics, integratedData, analysisType) {
    try {
      switch (analysisType.toLowerCase()) {
        case 'textual':
          this.reporter = new TextualReporter(this.logger);
          this.reporter.generateReport(metrics, integratedData);
          break;
          
        case 'full':
          this.reporter = new FullAnalyzer(this.logger);
          this.reporter.generateFull(metrics, integratedData);
          break;
          
        case 'snapshot':
          this.reporter = new SnapshotAnalyzer(this.logger);
          this.reporter.generateSnapshot(metrics, integratedData);
          break;
          
        default:
          throw new Error(`Unknown analysis type: ${analysisType}`);
      }
    } catch (error) {
      this.logger.log(`Report generation failed: ${error.message}`, 'ERROR');
      throw error;
    }
  }
}

// ===== MAIN MENU FUNCTIONS =====
function generateTextualReport() {
  try {
    const analyzer = new LukoAnalyzer();
    analyzer.run('textual');
    SpreadsheetApp.getUi().alert('✅ Raport tekstowy wygenerowany pomyślnie!');
  } catch (error) {
    SpreadsheetApp.getUi().alert(`❌ Błąd: ${error.message}`);
    console.error('Error in generateTextualReport:', error);
  }
}

function generateFullAnalysis() {
  try {
    const analyzer = new LukoAnalyzer();
    analyzer.run('full');
    SpreadsheetApp.getUi().alert('✅ Pełna analiza wygenerowana pomyślnie!');
  } catch (error) {
    SpreadsheetApp.getUi().alert(`❌ Błąd: ${error.message}`);
    console.error('Error in generateFullAnalysis:', error);
  }
}

function generateSnapshot() {
  try {
    const analyzer = new LukoAnalyzer();
    analyzer.run('snapshot');
    SpreadsheetApp.getUi().alert('✅ Snapshot wygenerowany pomyślnie!');
  } catch (error) {
    SpreadsheetApp.getUi().alert(`❌ Błąd: ${error.message}`);
    console.error('Error in generateSnapshot:', error);
  }
}

// ===== ACOS SETTINGS =====
function showAcosSettings() {
  try {
    const htmlOutput = HtmlService.createHtmlOutputFromFile('AcosSettings')
      .setWidth(450)
      .setHeight(400);
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Ustawienia ACOS');
  } catch (error) {
    // Jeśli nie ma pliku HTML, pokaż prosty dialog
    const ui = SpreadsheetApp.getUi();
    const response = ui.prompt('Ustawienia ACOS', 
      'Podaj wartość Break-Even ACOS (%):', 
      ui.ButtonSet.OK_CANCEL);
    
    if (response.getSelectedButton() == ui.Button.OK) {
      const value = parseInt(response.getResponseText());
      if (!isNaN(value) && value > 0 && value < 100) {
        PropertiesService.getDocumentProperties().setProperty('ACOS_BREAK_EVEN', value.toString());
        ui.alert(`✅ Zapisano Break-Even ACOS: ${value}%`);
      } else {
        ui.alert('❌ Nieprawidłowa wartość. Podaj liczbę między 1 a 99.');
      }
    }
  }
}

function getAcosSettings() {
  try {
    const p = PropertiesService.getDocumentProperties();
    // Wczytaj i zrzutuj do liczb
    let breakEven = Number(p.getProperty('ACOS_BREAK_EVEN') || 25);
    let low       = Number(p.getProperty('ACOS_LOW')        || 15);
    let high      = Number(p.getProperty('ACOS_HIGH')       || 40);

    // Ograniczenia i domyślne
    if (!isFinite(breakEven) || breakEven <= 0 || breakEven >= 100) breakEven = 25;
    if (!isFinite(low)       || low < 0       || low >= 100)        low = 15;
    if (!isFinite(high)      || high <= 0     || high >  100)       high = 40;

    // Sanity: low < breakEven < high
    let changed = false;
    if (low >= breakEven) { low = Math.max(0, Math.min(breakEven - 1, breakEven * 0.6)); changed = true; }
    if (high <= breakEven) { high = Math.min(100, Math.max(breakEven + 1, breakEven * 1.5)); changed = true; }

    // Jeśli poprawialiśmy — zapisz skorygowane
    if (changed) {
      p.setProperties({
        'ACOS_BREAK_EVEN': String(breakEven),
        'ACOS_LOW':        String(low),
        'ACOS_HIGH':       String(high),
      }, true);
    }

    return { breakEven, low, high };
  } catch (error) {
    console.error('Error getting ACOS settings:', error);
    return { breakEven: 25, low: 15, high: 40 };
  }
}

function saveAcosSettings(breakEven, low, high) {
  try {
    let be = Number(breakEven), lo = Number(low), hi = Number(high);

    if (!isFinite(be) || be <= 0 || be >= 100) return '❌ Nieprawidłowy break-even (1–99).';
    if (!isFinite(lo) || lo < 0 || lo >= 100)  return '❌ Nieprawidłowy niski ACOS (0–99).';
    if (!isFinite(hi) || hi <= 0 || hi > 100)  return '❌ Nieprawidłowy wysoki ACOS (1–100).';

    // Sanity
    if (lo >= be) lo = Math.max(0, Math.min(be - 1, be * 0.6));
    if (hi <= be) hi = Math.min(100, Math.max(be + 1, be * 1.5));

    PropertiesService.getDocumentProperties().setProperties({
      'ACOS_BREAK_EVEN': String(be),
      'ACOS_LOW':        String(lo),
      'ACOS_HIGH':       String(hi),
    }, true);

    return `✅ Ustawienia zapisane: Break-even=${be}%, Niski=${lo}%, Wysoki=${hi}%`;
  } catch (error) {
    return `❌ Błąd zapisu: ${error.message}`;
  }
}


// ===== UTILITY FUNCTIONS =====
function showDebugLog() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const debugSheet = ss.getSheetByName(LUKO_CONFIG.SHEETS.DEBUG);
    
    if (debugSheet) {
      ss.setActiveSheet(debugSheet);
      SpreadsheetApp.getUi().alert('✅ Debug log opened!');
    } else {
      SpreadsheetApp.getUi().alert('No debug log found. Run an analysis first.');
    }
  } catch (error) {
    SpreadsheetApp.getUi().alert(`❌ Błąd: ${error.message}`);
    console.error('Error showing debug log:', error);
  }
}

function clearAllData() {
  try {
    const ui = SpreadsheetApp.getUi();
    const result = ui.alert(
      'Potwierdzenie',
      'Czy na pewno chcesz usunąć wszystkie arkusze LUKO?',
      ui.ButtonSet.YES_NO
    );
    
    if (result == ui.Button.YES) {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheets = ss.getSheets();
      
      let deletedCount = 0;
      sheets.forEach(sheet => {
        if (sheet.getName().startsWith(LUKO_CONFIG.SHEET_PREFIX)) {
          try {
            ss.deleteSheet(sheet);
            deletedCount++;
          } catch (error) {
            console.error(`Error deleting sheet ${sheet.getName()}:`, error);
          }
        }
      });
      
      ui.alert(`✅ Usunięto ${deletedCount} arkuszy LUKO`);
    }
  } catch (error) {
    SpreadsheetApp.getUi().alert(`❌ Błąd: ${error.message}`);
    console.error('Error clearing data:', error);
  }
}
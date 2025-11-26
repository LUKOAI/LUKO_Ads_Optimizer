/**
 * BULK GENERATOR V2.0 - Główny kontroler systemu BULK
 * Koordynuje wszystkie moduły optymalizacji Amazon Ads
 * @author LUKO (Łukasz Koronczok)
 * @version 2.0
 */
// ====================================
// LUKO AMZ Ads Optimizer
// Version: 0.60
// Author: Łukasz Koronczok, NetAnaliza
// ====================================
const BulkGenerator = {
  
  VERSION: '2.0',
  
  /**
   * Inicjalizacja systemu BULK
   */
  init() {
    Logger.log('=== BULK GENERATOR V2.0 INITIALIZATION ===');
    
    // Sprawdź czy istnieją wymagane arkusze
    const requiredSheets = ['BULK_Source', 'BULK_Builder', 'BULK_Mapping'];
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    requiredSheets.forEach(sheetName => {
      if (!ss.getSheetByName(sheetName)) {
        ss.insertSheet(sheetName);
        Logger.log(`Created sheet: ${sheetName}`);
      }
    });
    
    SpreadsheetApp.getActiveSpreadsheet().toast(
      'BULK System zainicjalizowany', 
      'BULK Generator V2.0', 
      3
    );
  },
  
  /**
   * Główny przepływ pracy
   */
  async runFullWorkflow() {
    const ui = SpreadsheetApp.getUi();
    
    try {
      // Krok 1: Sprawdź dane źródłowe
      const sourceCheck = this.checkSourceData();
      if (!sourceCheck.isValid) {
        ui.alert('❌ Błąd', sourceCheck.message, ui.ButtonSet.OK);
        return;
      }
      
      // Krok 2: Rozpoznaj typ raportu
      const reportType = this.detectReportType();
      Logger.log(`Report type detected: ${reportType}`);
      
      // Krok 3: Mapowanie z istniejącą analizą
      ui.alert('🔄 Mapowanie', 'Rozpoczynam mapowanie kampanii...', ui.ButtonSet.OK);
      const mappingResult = BulkMapper.mapCampaigns();
      
      // Krok 4: Analiza szczegółowa
      if (mappingResult.confidence < 50) {
        const result = ui.alert(
          '⚠️ Niska pewność mapowania',
          `Pewność mapowania: ${mappingResult.confidence}%\n\n` +
          'Zalecana jest analiza od zera. Kontynuować?',
          ui.ButtonSet.YES_NO
        );
        
        if (result !== ui.Button.YES) {
          return;
        }
      }
      
      const analysis = BulkAnalyzer.runAnalysis(mappingResult);
      
      // Krok 5: Pokaż dashboard z akcjami
      this.showActionsDashboard(analysis);
      
    } catch (error) {
      Logger.log('Error in workflow: ' + error.toString());
      ui.alert('❌ Błąd', 'Wystąpił błąd: ' + error.toString(), ui.ButtonSet.OK);
    }
  },
  
  /**
   * Sprawdzenie danych źródłowych
   */
  checkSourceData() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sourceSheet = ss.getSheetByName('BULK_Source');
    
    if (!sourceSheet) {
      return {
        isValid: false,
        message: 'Brak arkusza BULK_Source. Utwórz go najpierw.'
      };
    }
    
    const lastRow = sourceSheet.getLastRow();
    const lastCol = sourceSheet.getLastColumn();
    
    if (lastRow < 2) {
      return {
        isValid: false,
        message: 'BULK_Source jest pusty. Wklej dane z Amazon Bulk.'
      };
    }
    
    if (lastCol < 10) {
      return {
        isValid: false,
        message: 'Za mało kolumn. Sprawdź czy wkleiłeś pełny raport.'
      };
    }
    
    // Sprawdź nagłówki
    const headers = sourceSheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const hasRequiredColumns = this.validateHeaders(headers);
    
    if (!hasRequiredColumns) {
      return {
        isValid: false,
        message: 'Brakuje wymaganych kolumn. Sprawdź format raportu.'
      };
    }
    
    return {
      isValid: true,
      message: 'OK',
      rowCount: lastRow - 1,
      columnCount: lastCol
    };
  },
  
  /**
   * Walidacja nagłówków
   */
  validateHeaders(headers) {
    const required = ['campaign', 'impressions', 'clicks', 'spend'];
    const headerString = headers.join('|').toLowerCase();
    
    return required.every(req => headerString.includes(req));
  },
  
  /**
   * Rozpoznawanie typu raportu
   */
  detectReportType() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sourceSheet = ss.getSheetByName('BULK_Source');
    const headers = sourceSheet.getRange(1, 1, 1, sourceSheet.getLastColumn()).getValues()[0];
    
    const headerString = headers.join('|').toLowerCase();
    const columnCount = headers.length;
    
    let reportType = 'UNKNOWN';
    let confidence = 0;
    
    // Rozpoznawanie po charakterystycznych kolumnach i liczbie kolumn
    if (headerString.includes('customer search term') && columnCount === 27) {
      reportType = 'SP_SEARCH_TERM';
      confidence = 95;
    } else if (headerString.includes('keyword id') && columnCount === 48) {
      reportType = 'SP_CAMPAIGNS';
      confidence = 95;
    } else if (headerString.includes('brand logo') && columnCount === 68) {
      reportType = 'SB_MULTI_AD_GROUP';
      confidence = 90;
    } else if (headerString.includes('tactic') && columnCount === 47) {
      reportType = 'SD_CAMPAIGNS';
      confidence = 90;
    } else if (headerString.includes('video media') && columnCount === 51) {
      reportType = 'SB_CAMPAIGNS';
      confidence = 85;
    } else if (headerString.includes('portfolio') && columnCount === 12) {
      reportType = 'PORTFOLIOS';
      confidence = 95;
    }
    
    // Zapisz typ raportu w properties
    PropertiesService.getScriptProperties().setProperty('BULK_REPORT_TYPE', reportType);
    PropertiesService.getScriptProperties().setProperty('BULK_CONFIDENCE', confidence.toString());
    
    // Dodaj informację do arkusza
    const infoSheet = ss.getSheetByName('BULK_Info');
    if (!infoSheet) {
      const newSheet = ss.insertSheet('BULK_Info');
      newSheet.getRange('A1:B5').setValues([
        ['Report Type', reportType],
        ['Confidence', confidence + '%'],
        ['Columns', columnCount],
        ['Rows', sourceSheet.getLastRow() - 1],
        ['Detected At', new Date().toLocaleString()]
      ]);
    }
    
    return reportType;
  },
  
  /**
   * Dashboard z akcjami do wykonania
   */
  showActionsDashboard(analysis) {
    const html = HtmlService.createTemplateFromFile('BulkDashboard');
    html.analysis = analysis;
    
    const htmlOutput = html.evaluate()
      .setWidth(800)
      .setHeight(600);
    
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, '🎯 BULK Optimizer - Panel Akcji');
  },
  
  /**
   * Funkcje menu
   */
  createBulkSheets() {
    this.init();
  },
  
  openBulkSource() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('BULK_Source');
    if (sheet) {
      ss.setActiveSheet(sheet);
    } else {
      ss.insertSheet('BULK_Source');
      SpreadsheetApp.getActiveSpreadsheet().toast('Utworzono arkusz BULK_Source', 'BULK', 2);
    }
  },
  
  initializeBulkWithHeaders() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sourceSheet = ss.getSheetByName('BULK_Source');
    
    if (!sourceSheet || sourceSheet.getLastRow() < 1) {
      SpreadsheetApp.getUi().alert('❌ Brak danych w BULK_Source');
      return;
    }
    
    // Kopiuj nagłówki do Builder
    let builderSheet = ss.getSheetByName('BULK_Builder');
    if (!builderSheet) {
      builderSheet = ss.insertSheet('BULK_Builder');
    }
    
    const headers = sourceSheet.getRange(1, 1, 1, sourceSheet.getLastColumn()).getValues();
    builderSheet.getRange(1, 1, 1, sourceSheet.getLastColumn()).setValues(headers);
    
    SpreadsheetApp.getActiveSpreadsheet().toast('Nagłówki skopiowane do BULK_Builder', 'BULK', 2);
  },
  
  /**
   * Uruchom pełną analizę
   */
  runBulkAnalysis() {
    this.runFullWorkflow();
  },
  
  /**
   * Zarządzanie zmianami - przekierowania do BulkChangeManager
   */
  pauseZeroSalesTargets() {
    BulkChangeManager.pauseZeroSales();
  },
  
  showBidAdjustmentDialog() {
    BulkChangeManager.showBidDialog();
  },
  
  addNegativeKeywords() {
    BulkChangeManager.addNegatives();
  },
  
  moveToPositiveKeywords() {
    BulkChangeManager.moveToPositives();
  },
  
  adjustCampaignBudgets() {
    BulkChangeManager.adjustBudgets();
  },
  
  /**
   * Walidacja i eksport
   */
  validateBulkData() {
    BulkValidator.runValidation();
  },
  
  exportBulkFile() {
    BulkExporter.exportToAmazon();
  },
  
  /**
   * Czyszczenie
   */
  clearAllBulkSheets() {
    const ui = SpreadsheetApp.getUi();
    const result = ui.alert(
      '🗑️ Czyszczenie',
      'Czy na pewno chcesz wyczyścić wszystkie arkusze BULK?',
      ui.ButtonSet.YES_NO
    );
    
    if (result === ui.Button.YES) {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheets = ['BULK_Source', 'BULK_Builder', 'BULK_Mapping', 'BULK_Info'];
      
      sheets.forEach(sheetName => {
        const sheet = ss.getSheetByName(sheetName);
        if (sheet) {
          sheet.clear();
        }
      });
      
      SpreadsheetApp.getActiveSpreadsheet().toast('Arkusze BULK wyczyszczone', 'BULK', 2);
    }
  },
  
  /**
   * Helper: Pobierz zaznaczone wiersze
   */
  getSelectedRows() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const selection = sheet.getActiveRange();
    
    if (!selection) {
      return null;
    }
    
    const startRow = selection.getRow();
    const numRows = selection.getNumRows();
    const endRow = startRow + numRows - 1;
    
    // Pomiń nagłówek
    if (startRow === 1) {
      return {
        start: 2,
        end: endRow,
        count: endRow - 1
      };
    }
    
    return {
      start: startRow,
      end: endRow,
      count: numRows
    };
  },
  
  /**
   * Helper: Formatowanie liczb
   */
  formatNumber(value, decimals = 2) {
    if (typeof value !== 'number') {
      value = parseFloat(value) || 0;
    }
    return value.toFixed(decimals);
  },
  
  /**
   * Helper: Formatowanie procentów
   */
  formatPercent(value, decimals = 1) {
    if (typeof value !== 'number') {
      value = parseFloat(value) || 0;
    }
    return value.toFixed(decimals) + '%';
  }
};

/**
 * Funkcje menu - muszą być globalne
 */
function createBulkSheets() { BulkGenerator.createBulkSheets(); }
function openBulkSource() { BulkGenerator.openBulkSource(); }
function initializeBulkWithHeaders() { BulkGenerator.initializeBulkWithHeaders(); }
function runBulkAnalysis() { BulkGenerator.runBulkAnalysis(); }
function pauseZeroSalesTargets() { BulkGenerator.pauseZeroSalesTargets(); }
function showBidAdjustmentDialog() { BulkGenerator.showBidAdjustmentDialog(); }
function addNegativeKeywords() { BulkGenerator.addNegativeKeywords(); }
function moveToPositiveKeywords() { BulkGenerator.moveToPositiveKeywords(); }
function adjustCampaignBudgets() { BulkGenerator.adjustCampaignBudgets(); }
function validateBulkData() { BulkGenerator.validateBulkData(); }
function exportBulkFile() { BulkGenerator.exportBulkFile(); }
function clearAllBulkSheets() { BulkGenerator.clearAllBulkSheets(); }
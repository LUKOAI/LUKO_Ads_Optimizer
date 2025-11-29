/**
 * ===== 01-MAIN.JS - GŁÓWNY KONTROLER LUKO ANALYZER =====
 * LUKO AMZ Ads Optimizer
 * Version: 6.2 - NOWE NAZWY ARKUSZY + UKRYTA STREFA 2
 * Author: Łukasz Koronczok, NetAnaliza
 *
 * Ten plik zawiera:
 * - Menu i funkcje główne
 * - Weryfikację API
 * - Integrację z modułami: BulkMapper, BulkAnalyzer, BulkChangeManager
 * - Konfigurację ACOS
 * - Analizy: Textual, Full, Snapshot
 *
 * FIXES V6.2:
 * - NOWE NAZWY ARKUSZY: Sponsored_Products_Search_term, SP_Bulk_Report
 * - Kompatybilność wsteczna ze starymi nazwami (BULK_Source, tu wklejasz raport z amazon)
 * - Helper functions: getAmazonReportSheet(), getBulkSourceSheet()
 * - Ukryta STREFA 2 w BulkChangeManager (tymczasowo)
 * - Ukryte menu: "Dodaj negatywy", "Przenieś do pozytywnych"
 * - Ulepszone wykrywanie raportów (ReportDetector) - obniżony próg, bonus za nazwę arkusza
 *
 * FIXES V3.0:
 * - clearAllData NIE kasuje arkuszy źródłowych
 * - showBulkAnalysisDialog wywołuje runAnalysis() zamiast showAnalysisDialog()
 * - LukoAnalyzer ma bezpieczny logger (fallback gdy LukoLogger nie istnieje)
 */

const LUKO_CONFIG = {
  VERSION: '6.2',
  SHEET_PREFIX: 'LUKO_',
  BREAK_EVEN_ACOS: 25,
  SHEETS: {
    TEXTUAL_REPORT: 'LUKO_Textual_Report',
    FULL_ANALYSIS: 'LUKO_Full_Analysis',
    SNAPSHOT: 'LUKO_Snapshot',
    DEBUG: 'LUKO_Debug_Log',
    // NOWE NAZWY ARKUSZY V6.2 - bez spacji, zgodne z Amazon
    AMAZON_REPORT: 'Sponsored_Products_Search_term',      // Główny raport z Amazon Ads
    BULK_SOURCE: 'SP_Bulk_Report',                        // Raport z Bulk Operations
    // Stare nazwy dla kompatybilności wstecznej
    AMAZON_REPORT_OLD: 'tu wklejasz raport z amazon',
    BULK_SOURCE_OLD: 'BULK_Source',
    // Pozostałe arkusze BULK
    BULK_BUILDER: 'BULK_Builder',
    BULK_EXPORT: 'BULK_Export',
    BULK_CHANGES_LOG: 'BULK_Changes_Log'
  }
};

// ===== HELPER: Pobieranie arkuszy z kompatybilnością wsteczną =====
/**
 * Pobiera arkusz Amazon Report - sprawdza nową i starą nazwę
 * @returns {Sheet|null}
 */
function getAmazonReportSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // Najpierw sprawdź nową nazwę
  let sheet = ss.getSheetByName(LUKO_CONFIG.SHEETS.AMAZON_REPORT);
  if (sheet) return sheet;
  // Fallback do starej nazwy
  return ss.getSheetByName(LUKO_CONFIG.SHEETS.AMAZON_REPORT_OLD);
}

/**
 * Pobiera arkusz BULK Source - sprawdza nową i starą nazwę
 * @returns {Sheet|null}
 */
function getBulkSourceSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // Najpierw sprawdź nową nazwę
  let sheet = ss.getSheetByName(LUKO_CONFIG.SHEETS.BULK_SOURCE);
  if (sheet) return sheet;
  // Fallback do starej nazwy
  return ss.getSheetByName(LUKO_CONFIG.SHEETS.BULK_SOURCE_OLD);
}

/**
 * Tworzy arkusz BULK Source z nową nazwą (lub zwraca istniejący)
 * @returns {Sheet}
 */
function getOrCreateBulkSourceSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // Najpierw sprawdź czy istnieje (nowa lub stara nazwa)
  let sheet = getBulkSourceSheet();
  if (sheet) {
    // Jeśli ma starą nazwę, zmień na nową
    if (sheet.getName() === LUKO_CONFIG.SHEETS.BULK_SOURCE_OLD) {
      sheet.setName(LUKO_CONFIG.SHEETS.BULK_SOURCE);
    }
    return sheet;
  }
  // Utwórz nowy z nową nazwą
  return ss.insertSheet(LUKO_CONFIG.SHEETS.BULK_SOURCE);
}

/**
 * Tworzy arkusz Amazon Report z nową nazwą (lub zwraca istniejący)
 * @returns {Sheet}
 */
function getOrCreateAmazonReportSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // Najpierw sprawdź czy istnieje (nowa lub stara nazwa)
  let sheet = getAmazonReportSheet();
  if (sheet) {
    // Jeśli ma starą nazwę, zmień na nową
    if (sheet.getName() === LUKO_CONFIG.SHEETS.AMAZON_REPORT_OLD) {
      sheet.setName(LUKO_CONFIG.SHEETS.AMAZON_REPORT);
    }
    return sheet;
  }
  // Utwórz nowy z nową nazwą
  return ss.insertSheet(LUKO_CONFIG.SHEETS.AMAZON_REPORT);
}

// ===== UNIWERSALNY PARSER LICZB =====
const universalParser = {
  parseNumber: function(value) {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number') return value;

    let str = String(value).trim();

    // Usuń symbole walut
    const currencySymbols = ['€', '$', '£', '¥', '₹', 'zł', 'PLN', 'kr', 'SEK', '₺', 'R$', 'BRL'];
    const currencyCodes = ['EUR', 'USD', 'GBP', 'PLN', 'SEK', 'TRY', 'JPY', 'CAD', 'AUD', 'NOK', 'DKK', 'CHF', 'BRL'];

    currencySymbols.forEach(symbol => {
      str = str.replace(new RegExp('\\' + symbol, 'g'), '');
    });

    currencyCodes.forEach(code => {
      str = str.replace(new RegExp('\\b' + code + '\\b', 'gi'), '');
    });

    // Zapamiętaj czy to procent
    const isPercent = str.includes('%');
    str = str.replace(/%/g, '').trim();

    // Określ format liczby
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

// ===== WERYFIKACJA KLUCZA API =====
function verifyApiKeyBeforeAction() {
  const apiKey = PropertiesService.getUserProperties().getProperty('LUKO_API_KEY');
  if (!apiKey || apiKey.trim() === '') {
    SpreadsheetApp.getUi().alert(
      '❌ Brak klucza API',
      'Musisz najpierw ustawić klucz API!\n\nMenu: LUKO → 🔑 Ustaw klucz API',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    return false;
  }
  return true;
}

function verifyApiKey(apiKey) {
  if (!apiKey) return false;

  try {
    const response = UrlFetchApp.fetch(
      'https://script.google.com/macros/s/AKfycbziKesVn1VFhMPMYl1wA8OTR9n-BemskNRiVqzE2nn8AWbXuHst_EpxNYGUd5HkiSHMjA/exec',
      {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({
          action: 'verifyKey',
          apiKey: apiKey
        }),
        muteHttpExceptions: true
      }
    );

    const result = JSON.parse(response.getContentText());
    return result.valid === true;
  } catch (error) {
    console.error('Verification error:', error);
    return false;
  }
}

function showApiKeyDialog() {
  const ui = SpreadsheetApp.getUi();
  const result = ui.prompt(
    '🔑 Konfiguracja klucza API',
    'Wklej swój klucz API (otrzymany w emailu):',
    ui.ButtonSet.OK_CANCEL
  );

  if (result.getSelectedButton() == ui.Button.OK) {
    const apiKey = result.getResponseText().trim();
    if (!apiKey) {
      ui.alert('❌ Błąd', 'Klucz API nie może być pusty!', ui.ButtonSet.OK);
      return;
    }

    PropertiesService.getUserProperties().setProperty('LUKO_API_KEY', apiKey);
    const isValid = verifyApiKey(apiKey);

    if (isValid) {
      ui.alert('✅ Sukces', 'Klucz API został zapisany i zweryfikowany!', ui.ButtonSet.OK);
    } else {
      ui.alert('⚠️ Uwaga', 'Klucz zapisany, ale weryfikacja nie powiodła się.', ui.ButtonSet.OK);
    }
  }
}

function checkLicense() {
  const ui = SpreadsheetApp.getUi();
  const apiKey = PropertiesService.getUserProperties().getProperty('LUKO_API_KEY');

  if (!apiKey) {
    ui.alert('❌ Błąd', 'Nie znaleziono klucza API. Ustaw go przez menu: LUKO → Ustaw klucz API', ui.ButtonSet.OK);
    return;
  }

  const isValid = verifyApiKey(apiKey);
  if (isValid) {
    ui.alert('✅ Licencja aktywna', 'Twoja licencja jest aktywna i ważna', ui.ButtonSet.OK);
  } else {
    ui.alert('❌ Licencja nieaktywna', 'Twoja licencja wygasła lub jest nieprawidłowa', ui.ButtonSet.OK);
  }
}

// ===== MENU CREATION =====
function onOpen() {
  const ui = SpreadsheetApp.getUi();

  ui.createMenu('🚀 LUKO ANALYZER V6.1')
    // KONFIGURACJA
    .addItem('🔑 Ustaw klucz API', 'showApiKeyDialog')
    .addItem('✅ Sprawdź licencję', 'checkLicense')
    .addSeparator()

    // USTAWIENIA ACOS - PIERWSZE CO UŻYTKOWNIK POWINIEN USTAWIĆ
    .addItem('⚙️ Ustawienia ACOS', 'showAcosSettings')
    .addSeparator()

    // ANALIZY
    .addSubMenu(ui.createMenu('📊 Analizy')
      .addItem('📄 Raport tekstowy', 'generateTextualReport')
      .addItem('📊 Pełna analiza', 'generateFullAnalysis')
      .addItem('📷 Snapshot', 'generateSnapshot'))

    // BULK OPERATIONS - WORKFLOW KROK PO KROKU
    .addSubMenu(ui.createMenu('🔧 BULK Operations')
      .addItem('1️⃣ Inicjalizuj BULK', 'initializeBulkWithHeaders')
      .addSeparator()
      .addItem('2️⃣ Mapowanie (Source → Builder)', 'showBulkMappingDialog')
      .addItem('3️⃣ Analiza (klasyfikacja targetów)', 'showBulkAnalysisDialog')
      .addSeparator()

      // ZAZNACZANIE
      .addItem('✅ Zaznacz wszystkie', 'selectAllTargets')
      .addItem('❌ Odznacz wszystkie', 'deselectAllTargets')
      .addItem('🎯 Zaznacz według kryterium', 'selectTargetsByCriteria')
      .addSeparator()

      // ZMIANY - PODMENU
      .addSubMenu(ui.createMenu('4️⃣ Zastosuj zmiany')
        .addItem('🎯 Manager Zmian (główne menu)', 'showBulkChangeManagerMenu')
        .addSeparator()
        .addItem('✓ Wszystkie sugerowane', 'applyAllSuggestedChanges')
        .addItem('⏸️ Pauzuj targety', 'showPauseTargetsDialog')
        .addItem('💰 Zmień stawki', 'showChangeBidsDialog')
        .addItem('📈 Zmień budżety', 'showChangeBudgetsDialog')
        // V6.3: Tymczasowo ukryte - funkcja w przygotowaniu
        // .addItem('🚫 Dodaj negatywy', 'showAddNegativesDialog')
      )
      .addSeparator()

      // EKSPORT I WALIDACJA
      .addItem('📤 Eksport do Amazon', 'showBulkExportDialog')
      .addItem('✅ Waliduj przed eksportem', 'validateBulkData')
      .addItem('📊 Pokaż statystyki', 'showBulkStats'))

    .addSeparator()
    .addItem('🐛 Debug Log', 'showDebugLog')
    .addItem('🗑️ Wyczyść dane LUKO', 'clearAllData')
    .addSeparator()
    .addItem('📖 Instrukcja', 'showInstructions')
    .addItem('❓ Pomoc', 'showHelp')
    .addItem('ℹ️ O programie', 'showAbout')
    .addToUi();
}

// ===== FUNKCJE BULK OPERATIONS =====

/**
 * 1. INICJALIZACJA - Przygotuj arkusze BULK_Source i BULK_Builder
 */
function initializeBulkWithHeaders() {
  if (!verifyApiKeyBeforeAction()) return;

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const ui = SpreadsheetApp.getUi();

    // V6.2: Sprawdź czy jest SP_Bulk_Report (lub stara nazwa BULK_Source)
    let sourceSheet = getBulkSourceSheet();
    if (!sourceSheet) {
      sourceSheet = ss.insertSheet(LUKO_CONFIG.SHEETS.BULK_SOURCE);
      sourceSheet.getRange('A1').setValue('👉 WKLEJ TUTAJ BULK Z AMAZON (Sponsored Products Campaigns)');
      sourceSheet.getRange('A1').setBackground('#fff3cd').setFontWeight('bold');
      sourceSheet.getRange('A1:J1').merge();
      ui.alert(
        `✅ Utworzono ${LUKO_CONFIG.SHEETS.BULK_SOURCE}`,
        'Pobierz Bulk z Amazon → skopiuj wszystko → wklej tutaj, potem ponów „Inicjalizuj BULK".',
        ui.ButtonSet.OK
      );
      return;
    }

    // Sprawdź czy coś wklejono
    const lastRow = sourceSheet.getLastRow();
    const lastCol = sourceSheet.getLastColumn();

    if (lastRow <= 1 || lastCol === 0) {
      ui.alert(
        '⚠️ BULK_Source jest pusty',
        'Wklej dane z Amazon przed inicjalizacją.',
        ui.ButtonSet.OK
      );
      return;
    }

    const headers = sourceSheet.getRange(1, 1, 1, lastCol).getValues()[0];

    // Przygotuj BULK_Builder
    let builderSheet = ss.getSheetByName('BULK_Builder');
    if (!builderSheet) {
      builderSheet = ss.insertSheet('BULK_Builder');
    } else {
      builderSheet.clear();
    }

    // Rozszerzone nagłówki z kolumnami helper
    const extendedHeaders = [
      ...headers,
      'Apply', 'Action', 'Reason', 'PercentValue', 'Confidence', 'Source', 'Status', 'ChangesDONE'
    ];

    builderSheet.getRange(1, 1, 1, extendedHeaders.length).setValues([extendedHeaders]);
    builderSheet.getRange(1, 1, 1, extendedHeaders.length)
      .setBackground('#4285f4')
      .setFontColor('#ffffff')
      .setFontWeight('bold');

    SpreadsheetApp.flush();

    ui.alert(
      '✅ BULK_Builder gotowy',
      `Zainicjalizowano z ${lastRow - 1} wierszami źródłowymi.\n\nTeraz uruchom:\nBULK Operations → 2️⃣ Mapowanie`,
      ui.ButtonSet.OK
    );
  } catch (error) {
    SpreadsheetApp.getUi().alert('❌ Błąd', error.toString(), SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

/**
 * 2. MAPOWANIE - Dialog i wywołanie BulkMapper
 */
function showBulkMappingDialog() {
  if (!verifyApiKeyBeforeAction()) return;

  try {
    // Sprawdź czy BulkMapper istnieje
    if (typeof BulkMapper === 'undefined') {
      throw new Error('Moduł BulkMapper nie jest załadowany. Sprawdź plik 13-BulkMapper.js');
    }

    const mapper = new BulkMapper();
    mapper.showMappingDialog();

  } catch (error) {
    SpreadsheetApp.getUi().alert(
      '❌ Błąd mapowania',
      error.toString(),
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}

/**
 * 3. ANALIZA - Dialog i wywołanie BulkAnalyzer
 * FIXED: Wywołuje runAnalysis() zamiast showAnalysisDialog()
 */
function showBulkAnalysisDialog() {
  if (!verifyApiKeyBeforeAction()) return;

  try {
    // Sprawdź czy BulkAnalyzer istnieje
    if (typeof BulkAnalyzer === 'undefined') {
      throw new Error('Moduł BulkAnalyzer nie jest załadowany. Sprawdź plik 14-BulkAnalyzer.js');
    }

    const analyzer = new BulkAnalyzer();

    // FIXED: Wywołaj runAnalysis() zamiast showAnalysisDialog()
    // showAnalysisDialog() zostało usunięte - analiza działa bezpośrednio
    if (typeof analyzer.runAnalysis === 'function') {
      analyzer.runAnalysis();
    } else if (typeof analyzer.showAnalysisDialog === 'function') {
      // Fallback dla starszej wersji
      analyzer.showAnalysisDialog();
    } else {
      throw new Error('BulkAnalyzer nie ma metody runAnalysis() ani showAnalysisDialog()');
    }

  } catch (error) {
    SpreadsheetApp.getUi().alert(
      '❌ Błąd analizy',
      error.toString(),
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}

/**
 * ZAZNACZANIE - Zaznacz wszystkie checkboxy w kolumnie Apply
 */
function selectAllTargets() {
  if (!verifyApiKeyBeforeAction()) return;

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('BULK_Builder');

    if (!sheet) {
      throw new Error('Brak arkusza BULK_Builder');
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    // Znajdź kolumny
    const applyCol = headers.findIndex(h => h === 'Apply');
    const entityCol = headers.findIndex(h => h.toString().toLowerCase().includes('entity'));

    if (applyCol === -1) {
      throw new Error('Brak kolumny Apply');
    }

    let selectedCount = 0;

    // Zaznacz tylko Keywords i Product Targeting
    for (let i = 1; i < data.length; i++) {
      const entity = data[i][entityCol];

      if (entity === 'Keyword' || entity === 'Product Targeting') {
        sheet.getRange(i + 1, applyCol + 1).setValue(true);
        selectedCount++;
      }
    }

    SpreadsheetApp.getUi().alert(
      '✅ Zaznaczono',
      `Zaznaczono ${selectedCount} targetów (Keywords i Product Targeting)`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );

  } catch (error) {
    SpreadsheetApp.getUi().alert('❌ Błąd', error.toString(), SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

/**
 * ZAZNACZANIE - Odznacz wszystkie checkboxy
 */
function deselectAllTargets() {
  if (!verifyApiKeyBeforeAction()) return;

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('BULK_Builder');

    if (!sheet) {
      throw new Error('Brak arkusza BULK_Builder');
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    const applyCol = headers.findIndex(h => h === 'Apply');

    if (applyCol === -1) {
      throw new Error('Brak kolumny Apply');
    }

    // Odznacz wszystko
    const numRows = data.length - 1;
    if (numRows > 0) {
      const falseValues = new Array(numRows).fill([false]);
      sheet.getRange(2, applyCol + 1, numRows, 1).setValues(falseValues);
    }

    SpreadsheetApp.getUi().alert(
      '✅ Odznaczono',
      'Wszystkie checkboxy zostały odznaczone',
      SpreadsheetApp.getUi().ButtonSet.OK
    );

  } catch (error) {
    SpreadsheetApp.getUi().alert('❌ Błąd', error.toString(), SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

/**
 * ZAZNACZANIE - Zaznacz według kryterium
 */
function selectTargetsByCriteria() {
  if (!verifyApiKeyBeforeAction()) return;

  const ui = SpreadsheetApp.getUi();

  const result = ui.alert(
    '🎯 Zaznacz według kryterium',
    'Wybierz kryterium:\n\n' +
    '• TAK = Zyskowne (ACOS < 50% Break-Even)\n' +
    '• NIE = Stratne (ACOS > 200% Break-Even)\n' +
    '• ANULUJ = Bez sprzedaży (0 orders, >20 clicks)',
    ui.ButtonSet.YES_NO_CANCEL
  );

  if (result === ui.Button.CANCEL) {
    selectNoSalesTargets();
    return;
  }

  const criteria = result === ui.Button.YES ? 'profitable' : 'unprofitable';

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('BULK_Builder');

    if (!sheet) {
      throw new Error('Brak arkusza BULK_Builder');
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    // Znajdź kolumny
    const applyCol = headers.findIndex(h => h === 'Apply');
    const acosCol = headers.findIndex(h => h.toString().toLowerCase().includes('acos'));
    const entityCol = headers.findIndex(h => h.toString().toLowerCase().includes('entity'));

    if (applyCol === -1 || acosCol === -1) {
      throw new Error('Brak wymaganych kolumn (Apply/ACOS)');
    }

    const acosSettings = getAcosSettings();
    const breakEven = acosSettings.breakEven;
    const lowThreshold = breakEven * 0.5;
    const highThreshold = breakEven * 2;

    let selectedCount = 0;

    for (let i = 1; i < data.length; i++) {
      const entity = data[i][entityCol];

      if (entity !== 'Keyword' && entity !== 'Product Targeting') continue;

      const acosRaw = data[i][acosCol];
      if (!acosRaw) continue;

      let acos = universalParser.parseNumber(acosRaw);
      if (acos > 0 && acos < 2) acos = acos * 100;

      let shouldSelect = false;

      if (criteria === 'profitable' && acos > 0 && acos < lowThreshold) {
        shouldSelect = true;
      } else if (criteria === 'unprofitable' && acos > highThreshold) {
        shouldSelect = true;
      }

      if (shouldSelect) {
        sheet.getRange(i + 1, applyCol + 1).setValue(true);
        selectedCount++;
      }
    }

    ui.alert(
      '✅ Zaznaczono',
      `Zaznaczono ${selectedCount} targetów\n` +
      `Kryterium: ${criteria === 'profitable' ? 'Zyskowne' : 'Stratne'}\n` +
      `Break-Even: ${breakEven}%`,
      ui.ButtonSet.OK
    );

  } catch (error) {
    ui.alert('❌ Błąd', error.toString(), ui.ButtonSet.OK);
  }
}

/**
 * Pomocnicza - zaznacz bez sprzedaży
 * FIX V3.3: Dodano parametr minClicks z dialogiem
 */
function selectNoSalesTargets() {
  const ui = SpreadsheetApp.getUi();

  // Pytaj o minimalną liczbę kliknięć
  const response = ui.prompt(
    '🎯 Zaznacz targety bez sprzedaży',
    'Podaj minimalną liczbę kliknięć (domyślnie 5):',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() !== ui.Button.OK) return;

  const minClicksInput = response.getResponseText().trim();
  const minClicks = minClicksInput ? parseInt(minClicksInput) : 5;

  if (isNaN(minClicks) || minClicks < 1) {
    ui.alert('❌ Błąd', 'Podaj poprawną liczbę (minimum 1)', ui.ButtonSet.OK);
    return;
  }

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('BULK_Builder');

    if (!sheet) {
      throw new Error('Brak arkusza BULK_Builder');
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    const applyCol = headers.findIndex(h => h === 'Apply');
    const ordersCol = headers.findIndex(h => h.toString().toLowerCase().includes('orders'));
    const salesCol = headers.findIndex(h => h.toString().toLowerCase().includes('sales') && !h.toString().toLowerCase().includes('units'));
    const clicksCol = headers.findIndex(h => h.toString().toLowerCase().includes('clicks'));
    const entityCol = headers.findIndex(h => h.toString().toLowerCase().includes('entity'));

    let selectedCount = 0;
    let totalChecked = 0;

    for (let i = 1; i < data.length; i++) {
      const entity = (data[i][entityCol] || '').toString().trim().toLowerCase();

      // FIX V3.3: Akceptuj różne formaty entity
      const isTarget = entity.includes('keyword') || entity.includes('targeting') || entity === '';

      if (!isTarget) continue;
      totalChecked++;

      const orders = universalParser.parseNumber(data[i][ordersCol]);
      const sales = universalParser.parseNumber(data[i][salesCol]);
      const clicks = universalParser.parseNumber(data[i][clicksCol]);

      // FIX V3.3: Użyj parametru minClicks i sprawdź też sales
      if ((orders === 0 || sales === 0) && clicks >= minClicks) {
        sheet.getRange(i + 1, applyCol + 1).setValue(true);
        selectedCount++;
      }
    }

    ui.alert(
      '✅ Zaznaczono',
      `Zaznaczono ${selectedCount} targetów bez sprzedaży\n` +
      `Kryterium: 0 zamówień/sprzedaży, ≥${minClicks} kliknięć\n` +
      `Sprawdzono: ${totalChecked} targetów`,
      ui.ButtonSet.OK
    );

  } catch (error) {
    ui.alert('❌ Błąd', error.toString(), ui.ButtonSet.OK);
  }
}

/**
 * 4. MANAGER ZMIAN - Wywołanie BulkChangeManager (główne menu)
 */
function showBulkChangeManagerMenu() {
  if (!verifyApiKeyBeforeAction()) return;

  try {
    // Sprawdź czy BulkChangeManager istnieje
    if (typeof BulkChangeManager === 'undefined') {
      throw new Error('Moduł BulkChangeManager nie jest załadowany. Sprawdź plik 15-BulkChangeManager.js');
    }

    const manager = new BulkChangeManager();
    manager.showMainMenu();

  } catch (error) {
    SpreadsheetApp.getUi().alert(
      '❌ Błąd managera zmian',
      error.toString(),
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}

/**
 * ZMIANY - Zastosuj wszystkie sugerowane (z analizy)
 */
function applyAllSuggestedChanges() {
  if (!verifyApiKeyBeforeAction()) return;

  try {
    if (typeof BulkChangeManager === 'undefined') {
      throw new Error('Moduł BulkChangeManager nie jest załadowany');
    }

    const manager = new BulkChangeManager();
    manager.applySuggestedChangesFromAnalysis();

  } catch (error) {
    SpreadsheetApp.getUi().alert('❌ Błąd', error.toString(), SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

/**
 * ZMIANY - Pauzuj targety
 */
function showPauseTargetsDialog() {
  if (!verifyApiKeyBeforeAction()) return;

  try {
    if (typeof BulkChangeManager === 'undefined') {
      throw new Error('Moduł BulkChangeManager nie jest załadowany');
    }

    const manager = new BulkChangeManager();
    manager.showPauseDialog();

  } catch (error) {
    SpreadsheetApp.getUi().alert('❌ Błąd', error.toString(), SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

/**
 * ZMIANY - Zmień stawki
 */
function showChangeBidsDialog() {
  if (!verifyApiKeyBeforeAction()) return;

  try {
    if (typeof BulkChangeManager === 'undefined') {
      throw new Error('Moduł BulkChangeManager nie jest załadowany');
    }

    const manager = new BulkChangeManager();
    manager.showBidChangeDialog();

  } catch (error) {
    SpreadsheetApp.getUi().alert('❌ Błąd', error.toString(), SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

/**
 * ZMIANY - Zmień budżety
 */
function showChangeBudgetsDialog() {
  if (!verifyApiKeyBeforeAction()) return;

  try {
    if (typeof BulkChangeManager === 'undefined') {
      throw new Error('Moduł BulkChangeManager nie jest załadowany');
    }

    const manager = new BulkChangeManager();
    manager.showBudgetChangeDialog();

  } catch (error) {
    SpreadsheetApp.getUi().alert('❌ Błąd', error.toString(), SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

/**
 * ZMIANY - Dodaj negatywy
 */
function showAddNegativesDialog() {
  if (!verifyApiKeyBeforeAction()) return;

  try {
    if (typeof BulkChangeManager === 'undefined') {
      throw new Error('Moduł BulkChangeManager nie jest załadowany');
    }

    const manager = new BulkChangeManager();
    manager.showNegativeKeywordsDialog();

  } catch (error) {
    SpreadsheetApp.getUi().alert('❌ Błąd', error.toString(), SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

/**
 * EKSPORT - Dialog eksportu do Amazon
 */
function showBulkExportDialog() {
  if (!verifyApiKeyBeforeAction()) return;

  const ui = SpreadsheetApp.getUi();

  const html = HtmlService.createHtmlOutput(`
    <!DOCTYPE html>
    <html>
      <head>
        <base target="_top">
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            margin: 0;
          }
          .container {
            background: white;
            border-radius: 15px;
            padding: 30px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
          }
          h2 {
            color: #333;
            margin-top: 0;
            text-align: center;
          }
          .warning {
            background: #fef7e0;
            padding: 15px;
            border-left: 4px solid #fbbc04;
            margin: 20px 0;
            border-radius: 5px;
          }
          .form-group {
            margin: 20px 0;
          }
          label {
            display: block;
            font-weight: 600;
            margin: 10px 0;
          }
          select {
            width: 100%;
            padding: 10px;
            border: 2px solid #ddd;
            border-radius: 8px;
            font-size: 14px;
          }
          button {
            width: 100%;
            padding: 12px;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            margin-top: 10px;
          }
          .btn-primary {
            background: linear-gradient(135deg, #34a853 0%, #0f9d58 100%);
            color: white;
          }
          .btn-secondary {
            background: #6c757d;
            color: white;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>📤 Eksport do Amazon</h2>

          <div class="warning">
            <strong>⚠️ WAŻNE:</strong><br>
            Eksportowane będą TYLKO wiersze z ChangesDONE = 'DONE'<br>
            Eksportuj do tego samego marketplace co źródło (DE→DE, FR→FR)
          </div>

          <div class="form-group">
            <label>Marketplace:</label>
            <select id="marketplace">
              <option value="DE">DE - Niemcy</option>
              <option value="FR">FR - Francja</option>
              <option value="IT">IT - Włochy</option>
              <option value="ES">ES - Hiszpania</option>
              <option value="UK">UK - Wielka Brytania</option>
              <option value="PL">PL - Polska</option>
            </select>
          </div>

          <button class="btn-primary" onclick="doExport()">
            📤 Eksportuj (nowy arkusz)
          </button>
          <button class="btn-secondary" onclick="google.script.host.close()">
            Anuluj
          </button>
        </div>

        <script>
          function doExport() {
            const marketplace = document.getElementById('marketplace').value;

            google.script.run
              .withSuccessHandler(result => {
                if (result && result.url) {
                  window.open(result.url, '_blank');
                }
                google.script.host.close();
              })
              .withFailureHandler(err => {
                alert('Błąd: ' + err);
              })
              .exportToAmazon(marketplace);
          }
        </script>
      </body>
    </html>
  `)
  .setWidth(500)
  .setHeight(450);

  ui.showModalDialog(html, 'Eksport do Amazon');
}

/**
 * Eksport do Amazon - wywołanie funkcji z modułu lub lokalna
 */
function exportToAmazon(marketplace) {
  if (!verifyApiKeyBeforeAction()) return;

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const builderSheet = ss.getSheetByName('BULK_Builder');

    if (!builderSheet) {
      throw new Error('Brak arkusza BULK_Builder');
    }

    const data = builderSheet.getDataRange().getValues();
    const headers = data[0];

    // Znajdź kolumnę ChangesDONE
    let changesDoneCol = -1;
    let originalColumnsEnd = headers.length;

    headers.forEach((h, i) => {
      const header = h.toString();
      if (header === 'ChangesDONE') changesDoneCol = i;

      // Znajdź koniec oryginalnych kolumn Amazon
      if ((header === 'Apply' || header === 'Action' || header === 'Reason') &&
          originalColumnsEnd === headers.length) {
        originalColumnsEnd = i;
      }
    });

    if (changesDoneCol === -1) {
      throw new Error('Brak kolumny ChangesDONE');
    }

    // Zbierz wiersze z DONE
    const exportData = [];
    const exportHeaders = headers.slice(0, originalColumnsEnd);
    exportData.push(exportHeaders);

    let exportedCount = 0;

    for (let i = 1; i < data.length; i++) {
      if (data[i][changesDoneCol] === 'DONE') {
        const row = data[i].slice(0, originalColumnsEnd);
        exportData.push(row);
        exportedCount++;
      }
    }

    if (exportedCount === 0) {
      SpreadsheetApp.getUi().alert(
        'Brak danych do eksportu',
        'Nie znaleziono wierszy z ChangesDONE = "DONE".\n\n' +
        'Użyj Manager Zmian aby zastosować zmiany i oznaczyć je jako DONE.',
        SpreadsheetApp.getUi().ButtonSet.OK
      );
      return { success: false };
    }

    // Utwórz nowy arkusz
    const timestamp = Utilities.formatDate(new Date(), 'GMT+1', 'yyyy-MM-dd_HHmm');
    const newSS = SpreadsheetApp.create(`Amazon_BULK_${marketplace}_${timestamp}`);
    const targetSheet = newSS.getActiveSheet();
    targetSheet.setName('BULK_Export');

    // Usuń dodatkowe arkusze
    const allSheets = newSS.getSheets();
    for (let i = 1; i < allSheets.length; i++) {
      newSS.deleteSheet(allSheets[i]);
    }

    // Wstaw dane
    targetSheet.getRange(1, 1, exportData.length, exportData[0].length)
      .setValues(exportData);

    // Formatowanie nagłówka
    targetSheet.getRange(1, 1, 1, exportData[0].length)
      .setBackground('#34a853')
      .setFontColor('#ffffff')
      .setFontWeight('bold');

    targetSheet.autoResizeColumns(1, exportData[0].length);

    SpreadsheetApp.getUi().alert(
      '✅ Eksport zakończony',
      `Wyeksportowano ${exportedCount} zmian do nowego arkusza.\n\n` +
      `Marketplace: ${marketplace}\n` +
      `URL: ${newSS.getUrl()}`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );

    return {
      success: true,
      url: newSS.getUrl(),
      count: exportedCount
    };

  } catch (error) {
    SpreadsheetApp.getUi().alert('❌ Błąd eksportu', error.toString(), SpreadsheetApp.getUi().ButtonSet.OK);
    throw error;
  }
}

/**
 * Walidacja danych przed eksportem
 */
function validateBulkData() {
  if (!verifyApiKeyBeforeAction()) return;

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('BULK_Builder');

    if (!sheet) {
      throw new Error('Brak arkusza BULK_Builder');
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    // Znajdź kolumny
    let entityCol = headers.findIndex(h => h.toString().toLowerCase().includes('entity'));
    let actionCol = headers.findIndex(h => h === 'Action');
    let changesDoneCol = headers.findIndex(h => h === 'ChangesDONE');

    let errors = [];
    let warnings = [];
    let readyCount = 0;

    for (let i = 1; i < data.length; i++) {
      const entity = data[i][entityCol];
      const action = data[i][actionCol];
      const done = data[i][changesDoneCol];

      if (done === 'DONE') {
        readyCount++;

        // Walidacje
        if (entity === 'Product Ad' && action && action.includes('BID')) {
          errors.push(`Wiersz ${i+1}: Product Ad nie może mieć zmian bid`);
        }

        if (entity === 'Negative Keyword' && action && action.includes('BID')) {
          warnings.push(`Wiersz ${i+1}: Negative Keyword z bid change`);
        }
      }
    }

    const ui = SpreadsheetApp.getUi();
    let message = `📊 WALIDACJA:\n\n`;
    message += `Gotowe do eksportu: ${readyCount} wierszy\n`;

    if (errors.length > 0) {
      message += `\n❌ BŁĘDY (${errors.length}):\n`;
      message += errors.slice(0, 3).join('\n') + '\n';
    }

    if (warnings.length > 0) {
      message += `\n⚠️ OSTRZEŻENIA (${warnings.length}):\n`;
      message += warnings.slice(0, 3).join('\n');
    }

    if (readyCount === 0) {
      ui.alert('⚠️ Brak danych', 'Nie znaleziono wierszy z DONE', ui.ButtonSet.OK);
    } else if (errors.length === 0) {
      ui.alert('✅ Walidacja OK', message, ui.ButtonSet.OK);
    } else {
      ui.alert('❌ Znaleziono błędy', message, ui.ButtonSet.OK);
    }

  } catch (error) {
    SpreadsheetApp.getUi().alert('❌ Błąd', error.toString(), SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

/**
 * Pokaż statystyki BULK
 */
function showBulkStats() {
  if (!verifyApiKeyBeforeAction()) return;

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('BULK_Builder');

    if (!sheet) {
      throw new Error('Brak arkusza BULK_Builder');
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    const entityCol = headers.findIndex(h => h.toString().toLowerCase().includes('entity'));
    const actionCol = headers.findIndex(h => h === 'Action');
    const changesDoneCol = headers.findIndex(h => h === 'ChangesDONE');

    const stats = {
      total: data.length - 1,
      byEntity: {},
      byAction: {},
      done: 0
    };

    for (let i = 1; i < data.length; i++) {
      const entity = data[i][entityCol];
      const action = data[i][actionCol];
      const done = data[i][changesDoneCol];

      stats.byEntity[entity] = (stats.byEntity[entity] || 0) + 1;

      if (action) {
        stats.byAction[action] = (stats.byAction[action] || 0) + 1;
      }

      if (done === 'DONE') stats.done++;
    }

    let message = `📊 STATYSTYKI BULK:\n\n`;
    message += `Łącznie targetów: ${stats.total}\n`;
    message += `Gotowych do eksportu: ${stats.done}\n\n`;

    message += `PO TYPACH:\n`;
    Object.entries(stats.byEntity).slice(0, 5).forEach(([entity, count]) => {
      message += `• ${entity}: ${count}\n`;
    });

    if (Object.keys(stats.byAction).length > 0) {
      message += `\nPO AKCJACH:\n`;
      Object.entries(stats.byAction).slice(0, 5).forEach(([action, count]) => {
        message += `• ${action}: ${count}\n`;
      });
    }

    SpreadsheetApp.getUi().alert('📊 Statystyki', message, SpreadsheetApp.getUi().ButtonSet.OK);

  } catch (error) {
    SpreadsheetApp.getUi().alert('❌ Błąd', error.toString(), SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

// ===== ANALIZY (Textual, Full, Snapshot) =====

function generateTextualReport() {
  if (!verifyApiKeyBeforeAction()) return;

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
  if (!verifyApiKeyBeforeAction()) return;

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
  if (!verifyApiKeyBeforeAction()) return;

  try {
    const analyzer = new LukoAnalyzer();
    analyzer.run('snapshot');
    SpreadsheetApp.getUi().alert('✅ Snapshot wygenerowany pomyślnie!');
  } catch (error) {
    SpreadsheetApp.getUi().alert(`❌ Błąd: ${error.message}`);
    console.error('Error in generateSnapshot:', error);
  }
}

// ===== USTAWIENIA ACOS =====

function showAcosSettings() {
  if (!verifyApiKeyBeforeAction()) return;

  try {
    const htmlOutput = HtmlService.createHtmlOutputFromFile('10-AcosSettings')
      .setWidth(450)
      .setHeight(400);
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Ustawienia ACOS');
  } catch (error) {
    // Fallback - prosty dialog
    const ui = SpreadsheetApp.getUi();
    const response = ui.prompt(
      'Ustawienia ACOS',
      'Podaj wartość Break-Even ACOS (%):',
      ui.ButtonSet.OK_CANCEL
    );

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

    let breakEven = Number(p.getProperty('ACOS_BREAK_EVEN'));
    if (!breakEven || breakEven <= 0 || breakEven >= 100) {
      breakEven = 25;
    }

    let low = Number(p.getProperty('ACOS_LOW')) || Math.round(breakEven * 0.5);
    let high = Number(p.getProperty('ACOS_HIGH')) || Math.round(breakEven * 1.67);

    return { breakEven, low, high };
  } catch (error) {
    console.error('Error getting ACOS settings:', error);
    return { breakEven: 25, low: 15, high: 40 };
  }
}

function saveAcosSettings(breakEven, low, high) {
  if (!verifyApiKeyBeforeAction()) return '❌ Brak klucza API';

  try {
    let be = Number(breakEven);
    let lo = Number(low);
    let hi = Number(high);

    if (!isFinite(be) || be <= 0 || be >= 100) {
      return '❌ Nieprawidłowy break-even (1–99)';
    }
    if (!isFinite(lo) || lo < 0 || lo >= 100) {
      return '❌ Nieprawidłowy niski ACOS (0–99)';
    }
    if (!isFinite(hi) || hi <= 0 || hi > 100) {
      return '❌ Nieprawidłowy wysoki ACOS (1–100)';
    }

    if (lo >= be) lo = Math.max(0, be - 10);
    if (hi <= be) hi = Math.min(100, be + 15);

    PropertiesService.getDocumentProperties().setProperties({
      'ACOS_BREAK_EVEN': String(be),
      'ACOS_LOW': String(lo),
      'ACOS_HIGH': String(hi),
    }, true);

    return `✅ Zapisano: Break-even=${be}%, Niski=${lo}%, Wysoki=${hi}%`;
  } catch (error) {
    return `❌ Błąd: ${error.message}`;
  }
}

// ===== UTILITY FUNCTIONS =====

function showDebugLog() {
  if (!verifyApiKeyBeforeAction()) return;

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const debugSheet = ss.getSheetByName(LUKO_CONFIG.SHEETS.DEBUG);

    if (debugSheet) {
      ss.setActiveSheet(debugSheet);
      SpreadsheetApp.getUi().alert('✅ Debug log otwarty');
    } else {
      SpreadsheetApp.getUi().alert('Brak debug logu. Uruchom najpierw analizę.');
    }
  } catch (error) {
    SpreadsheetApp.getUi().alert(`❌ Błąd: ${error.message}`);
  }
}

/**
 * FIXED V6.2: clearAllData NIE kasuje arkuszy źródłowych (stare i nowe nazwy)
 */
function clearAllData() {
  if (!verifyApiKeyBeforeAction()) return;

  try {
    const ui = SpreadsheetApp.getUi();
    const result = ui.alert(
      'Potwierdzenie',
      'Czy na pewno chcesz usunąć wszystkie arkusze LUKO_* i BULK_*?\n\n' +
      `⚠️ Arkusze źródłowe NIE zostaną usunięte:\n` +
      `• ${LUKO_CONFIG.SHEETS.BULK_SOURCE}\n` +
      `• ${LUKO_CONFIG.SHEETS.AMAZON_REPORT}\n` +
      `• (oraz stare nazwy dla kompatybilności)`,
      ui.ButtonSet.YES_NO
    );

    if (result == ui.Button.YES) {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheets = ss.getSheets();

      // V6.2: Lista arkuszy do ZACHOWANIA (nowe i stare nazwy)
      const protectedSheets = [
        LUKO_CONFIG.SHEETS.BULK_SOURCE.toLowerCase(),           // SP_Bulk_Report
        LUKO_CONFIG.SHEETS.AMAZON_REPORT.toLowerCase(),         // Sponsored_Products_Search_term
        LUKO_CONFIG.SHEETS.BULK_SOURCE_OLD.toLowerCase(),       // BULK_Source
        LUKO_CONFIG.SHEETS.AMAZON_REPORT_OLD.toLowerCase(),     // tu wklejasz raport z amazon
        'tu wklejasz raport z amazo'                            // skrócona wersja na wszelki wypadek
      ];

      let deletedCount = 0;
      sheets.forEach(sheet => {
        const name = sheet.getName();
        const nameLower = name.toLowerCase();

        // V6.2: Sprawdź czy arkusz jest chroniony (nowe i stare nazwy)
        const isProtected = protectedSheets.some(p =>
          nameLower === p || nameLower.includes('tu wklejasz') || nameLower.includes('sponsored_products_search')
        );

        if (isProtected) {
          Logger.log(`Pomijam chroniony arkusz: ${name}`);
          return; // Skip protected sheet
        }

        // Usuń arkusze LUKO_ i BULK_ (oprócz chronionych)
        if (name.startsWith(LUKO_CONFIG.SHEET_PREFIX) || name.startsWith('BULK_')) {
          try {
            ss.deleteSheet(sheet);
            deletedCount++;
          } catch (error) {
            console.error(`Error deleting sheet ${name}:`, error);
          }
        }
      });

      ui.alert(`✅ Usunięto ${deletedCount} arkuszy\n\nBULK_Source został zachowany.`);
    }
  } catch (error) {
    SpreadsheetApp.getUi().alert(`❌ Błąd: ${error.message}`);
  }
}

function showInstructions() {
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    '📖 Instrukcja LUKO Analyzer V6.1',
    '1. Ustaw klucz API (menu: 🔑 Ustaw klucz API)\n' +
    '2. Wklej dane Amazon do arkusza lub użyj BULK\n' +
    '3. Uruchom analizę lub operacje BULK\n\n' +
    'BULK workflow:\n' +
    '1️⃣ Inicjalizuj BULK\n' +
    '2️⃣ Mapowanie\n' +
    '3️⃣ Analiza\n' +
    '4️⃣ Manager Zmian\n' +
    '📤 Eksport',
    ui.ButtonSet.OK
  );
}

function showHelp() {
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    '❓ Pomoc',
    'Wsparcie techniczne:\nsupport@netanaliza.com\n\nDokumentacja:\nhttps://netanaliza.com/luko-docs',
    ui.ButtonSet.OK
  );
}

function showAbout() {
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    'ℹ️ O programie',
    'LUKO Ads Optimizer V6.1\n' +
    '© 2025 NetAnaliza\n' +
    'Autor: Łukasz Koronczok\n\n' +
    'Narzędzie do optymalizacji kampanii Amazon PPC',
    ui.ButtonSet.OK
  );
}

// ===== MAIN ANALYZER CLASS =====

/**
 * FIXED: LukoAnalyzer z bezpiecznym logger (fallback gdy LukoLogger nie istnieje)
 */
class LukoAnalyzer {
  constructor() {
    // FIXED: Bezpieczna inicjalizacja logger
    this.logger = this.createSafeLogger();

    // FIXED: Używamy ReportDetector (tak jak w oryginalnym gas/02-ReportDetector.js)
    this.detector = new ReportDetector(this.logger);
    this.integrator = new UltraDataIntegrator(this.logger);
    this.calculator = new MetricsCalculator(this.logger);
    this.reporter = null;

    this.logger.log('✅ LukoAnalyzer V6.1 initialized', 'SUCCESS');
  }

  /**
   * FIXED: Tworzy bezpieczny logger który ZAWSZE działa
   */
  createSafeLogger() {
    // Spróbuj użyć LukoLogger jeśli istnieje
    if (typeof LukoLogger === 'function') {
      try {
        return new LukoLogger();
      } catch (e) {
        console.log('LukoLogger failed, using fallback: ' + e.message);
      }
    }

    // Fallback - prosty logger który nie rzuca błędów
    return {
      entries: [],
      log: function(message, level) {
        const timestamp = new Date().toLocaleTimeString('pl-PL');
        const prefix = level ? `[${level}]` : '[INFO]';
        console.log(`${timestamp} ${prefix} ${message}`);
        this.entries.push({ timestamp, level: level || 'INFO', message });
      },
      saveToSheet: function() {
        try {
          const ss = SpreadsheetApp.getActiveSpreadsheet();
          let logSheet = ss.getSheetByName('LUKO_Log');
          if (!logSheet) logSheet = ss.insertSheet('LUKO_Log');

          if (this.entries.length > 0) {
            const lastRow = Math.max(logSheet.getLastRow(), 0);
            const data = this.entries.map(e => [e.timestamp, e.level, e.message]);
            logSheet.getRange(lastRow + 1, 1, data.length, 3).setValues(data);
          }
        } catch (e) {
          console.log('Could not save logs: ' + e.message);
        }
      },
      clear: function() {
        this.entries = [];
      }
    };
  }

  run(analysisType = 'textual') {
    try {
      this.logger.log(`🚀 STARTING ${analysisType.toUpperCase()} ANALYSIS - LUKO V6.0`, 'INFO');

      // STEP 1: Wykrywanie raportów
      this.logger.log('🔍 STEP 1: Report detection...', 'INFO');
      // FIXED: Używamy detectReports() - tak jak w oryginalnym gas/01-Main.js
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

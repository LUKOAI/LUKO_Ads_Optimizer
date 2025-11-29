// ===== 09-SNAPSHOTANALYZER.GS - WERSJA 4.1 FIXED =====
// ====================================
// LUKO AMZ Ads Optimizer
// Version: 0.60 (FIXED V2)
// Author: Łukasz Koronczok, NetAnaliza
// ====================================
// FIX V2: W pełni samodzielna wersja - nie zależy od LukoLogger ani innych klas
// Rozwiązuje "logger is not defined" i inne błędy zależności

class SnapshotAnalyzer {
  constructor(logger) {
    // FIX: Bezpieczna inicjalizacja logger - ZAWSZE działa
    this.logger = this.createSafeLogger(logger);
  }

  /**
   * FIX: Tworzy bezpieczny logger który ZAWSZE działa
   */
  createSafeLogger(logger) {
    // Jeśli przekazano działający logger, użyj go
    if (logger && typeof logger.log === 'function') {
      return logger;
    }

    // W przeciwnym razie stwórz własny prosty logger
    return {
      log: function(message, level) {
        const timestamp = new Date().toLocaleTimeString('pl-PL');
        const prefix = level ? `[${level}]` : '[INFO]';
        console.log(`${timestamp} ${prefix} ${message}`);
      }
    };
  }

  generateSnapshot() {
    try {
      this.logger.log('🚀 STARTING SNAPSHOT ANALYSIS - LUKO V6.0', 'INFO');

      const ss = SpreadsheetApp.getActiveSpreadsheet();
      // V6.2: Używaj helper function dla kompatybilności wstecznej
      const primarySheet = typeof getAmazonReportSheet === 'function'
        ? getAmazonReportSheet()
        : ss.getSheetByName(LUKO_CONFIG.SHEETS.AMAZON_REPORT) || ss.getSheetByName(LUKO_CONFIG.SHEETS.AMAZON_REPORT_OLD);
      const sheetName = primarySheet ? primarySheet.getName() : null;

      if (!primarySheet || primarySheet.getLastRow() < 2) {
        throw new Error(`Brak danych w arkuszu "${LUKO_CONFIG.SHEETS.AMAZON_REPORT}" (lub "${LUKO_CONFIG.SHEETS.AMAZON_REPORT_OLD}")`);
      }

      // FIX: Bezpieczne tworzenie MetricsCalculator
      let metrics;
      if (typeof MetricsCalculator === 'function') {
        const calc = new MetricsCalculator(this.logger);
        metrics = calc.calculateMetrics(null, sheetName);
      } else {
        this.logger.log('MetricsCalculator not found, using simple calculation', 'WARNING');
        metrics = this.calculateSimpleMetrics(primarySheet);
      }

      this.logger.log(`✅ Metrics calculated - ACOS: ${(metrics.totals.acos || 0).toFixed(1)}%`, 'SUCCESS');
      this.generateReport(metrics);

      this.logger.log('✅ ANALYSIS COMPLETED SUCCESSFULLY', 'SUCCESS');
      return true;

    } catch (error) {
      this.logger.log(`💥 ANALYSIS FAILED: ${error.message}`, 'ERROR');
      throw error;
    }
  }

  /**
   * FIX: Prosty kalkulator metryk jako fallback
   */
  calculateSimpleMetrics(sheet) {
    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    const findCol = (names) => {
      for (const name of names) {
        const idx = headers.findIndex(h => h && h.toString().toLowerCase().includes(name.toLowerCase()));
        if (idx >= 0) return idx;
      }
      return -1;
    };

    const cols = {
      impressions: findCol(['impressions', 'wyświetlenia']),
      clicks: findCol(['clicks', 'kliknięcia']),
      spend: findCol(['spend', 'wydatki', 'cost']),
      sales: findCol(['sales', 'sprzedaż', '7 day total sales']),
      orders: findCol(['orders', 'zamówienia', '7 day total orders'])
    };

    const totals = { impressions: 0, clicks: 0, spend: 0, sales: 0, orders: 0 };

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (cols.impressions >= 0) totals.impressions += parseFloat(row[cols.impressions]) || 0;
      if (cols.clicks >= 0) totals.clicks += parseFloat(row[cols.clicks]) || 0;
      if (cols.spend >= 0) totals.spend += parseFloat(String(row[cols.spend]).replace(/[€$,]/g, '')) || 0;
      if (cols.sales >= 0) totals.sales += parseFloat(String(row[cols.sales]).replace(/[€$,]/g, '')) || 0;
      if (cols.orders >= 0) totals.orders += parseFloat(row[cols.orders]) || 0;
    }

    totals.ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions * 100) : 0;
    totals.cpc = totals.clicks > 0 ? (totals.spend / totals.clicks) : 0;
    totals.acos = totals.sales > 0 ? (totals.spend / totals.sales * 100) : 999;
    totals.roas = totals.spend > 0 ? (totals.sales / totals.spend) : 0;
    totals.conversionRate = totals.clicks > 0 ? (totals.orders / totals.clicks * 100) : 0;
    totals.avgOrderValue = totals.orders > 0 ? (totals.sales / totals.orders) : 0;

    // FIX: Pobierz ustawienia ACOS bezpiecznie
    let acosSettings = { breakEven: 30, low: 15, high: 40 };
    try {
      if (typeof getAcosSettings === 'function') {
        acosSettings = getAcosSettings();
      }
    } catch (e) {
      // Użyj domyślnych
    }

    return {
      totals: totals,
      targetAnalysis: {},
      acosSettings: acosSettings
    };
  }

  generateReport(metrics) {
    this.logger.log('📸 Generating snapshot report...', 'INFO');

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const existing = ss.getSheetByName('LUKO_Snapshot');
    if (existing) ss.deleteSheet(existing);
    const sheet = ss.insertSheet('LUKO_Snapshot');

    // FIX: Bezpieczny dostęp do metrics
    const totals = metrics.totals || {};
    const acosSettings = metrics.acosSettings || { breakEven: 30, low: 15, high: 40 };

    sheet.getRange('A1:D1').merge()
      .setValue('📊 AMAZON ADS - SNAPSHOT WYDAJNOŚCI')
      .setBackground('#1E88E5').setFontColor('white').setFontSize(14)
      .setFontWeight('bold').setHorizontalAlignment('center');

    sheet.getRange('A2:D2').merge()
      .setValue(`Wygenerowano: ${new Date().toLocaleString('pl-PL')}`)
      .setBackground('#E3F2FD').setHorizontalAlignment('center');

    let row = 4;

    // KLUCZOWE METRYKI
    sheet.getRange(row, 1).setValue('📊 KLUCZOWE METRYKI')
      .setFontWeight('bold').setBackground('#FFA726');
    row += 2;

    const acosStatus = this.getACOSStatus(totals.acos || 0, acosSettings);
    const md = [
      ['Metryka', 'Wartość', 'Status', 'Ocena'],
      ['ACOS', `${(totals.acos || 0).toFixed(1)}%`, acosStatus, ''],
      ['ROAS', (totals.roas || 0).toFixed(2), acosStatus, ''],
      ['CTR', `${(totals.ctr || 0).toFixed(2)}%`,
        (totals.ctr || 0) >= 1 ? '🟢 WYSOKI' :
        (totals.ctr || 0) >= 0.5 ? '🟡 ŚREDNI' : '🔴 NISKI', ''],
      ['Sprzedaż', `${(totals.sales || 0).toFixed(2)} €`, '', ''],
      ['Wydatki', `${(totals.spend || 0).toFixed(2)} €`, '', '']
    ];

    sheet.getRange(row, 1, md.length, 4).setValues(md).setBorder(true, true, true, true, true, true);
    sheet.getRange(row, 1, 1, 4).setBackground('#E0E0E0').setFontWeight('bold');
    row += md.length + 2;

    // ANALIZA FINANSOWA
    sheet.getRange(row, 1).setValue('💰 ANALIZA FINANSOWA')
      .setFontWeight('bold').setBackground('#FFA726');
    row += 2;

    const marginPercent = acosSettings.breakEven / 100;
    const margin = (totals.sales || 0) * marginPercent;
    const realProfit = margin - (totals.spend || 0);
    const marginToBE = acosSettings.breakEven - (totals.acos || 0);

    const fd = [
      ['Szacowany wynik', `${realProfit.toFixed(2)} €`,
        realProfit > 0 ? '🟢 ZYSK' : '🔴 STRATA',
        realProfit > 0 ? 'Kampanie rentowne' : 'Optymalizacja potrzebna'],
      ['Margines do break-even', `${marginToBE.toFixed(1)} pp`,
        marginToBE > 0 ? '🟢' : '🔴', '']
    ];

    sheet.getRange(row, 1, fd.length, 4).setValues(fd).setBorder(true, true, true, true, true, true);
    row += fd.length + 2;

    // WYDAJNOŚĆ
    sheet.getRange(row, 1).setValue('📈 WYDAJNOŚĆ')
      .setFontWeight('bold').setBackground('#FFA726');
    row += 2;

    const pd = [
      ['Wyświetlenia', (totals.impressions || 0).toLocaleString('pl-PL'), '', ''],
      ['Kliknięcia', (totals.clicks || 0).toLocaleString('pl-PL'), '', ''],
      ['Zamówienia', (totals.orders || 0).toString(), '', ''],
      ['Konwersja', `${(totals.conversionRate || 0).toFixed(2)}%`, '', ''],
      ['Średnia wartość zamówienia', `${(totals.avgOrderValue || 0).toFixed(2)} €`, '', '']
    ];

    sheet.getRange(row, 1, pd.length, 4).setValues(pd).setBorder(true, true, true, true, true, true);
    row += pd.length + 2;

    // PODSUMOWANIE TARGETÓW
    sheet.getRange(row, 1).setValue('🎯 PODSUMOWANIE TARGETÓW')
      .setFontWeight('bold').setBackground('#FFA726');
    row += 2;

    const ta = metrics.targetAnalysis || {};
    const td = [
      ['Metryka', 'Wartość', '', ''],
      ['Targety (z kosztem/klikami)', (ta.totalTargets || 0).toString(), '', ''],
      ['Bez sprzedaży', (ta.zeroSalesTargets || 0).toString(), '', ''],
      [`ACOS > ${acosSettings.breakEven}%`, (ta.unprofitableTargets || 0).toString(), '', ''],
      [`ACOS ≤ ${acosSettings.breakEven}%`, (ta.goodAcosTargets || 0).toString(), '', ''],
      [`ACOS ≤ ${acosSettings.breakEven / 2}%`, (ta.excellentAcosTargets || 0).toString(), '', '']
    ];

    sheet.getRange(row, 1, td.length, 4).setValues(td).setBorder(true, true, true, true, true, true);

    // Formatowanie
    sheet.setColumnWidth(1, 220);
    sheet.setColumnWidth(2, 140);
    sheet.setColumnWidth(3, 110);
    sheet.setColumnWidth(4, 200);

    this.logger.log('✅ Snapshot report generated successfully', 'SUCCESS');
  }

  getACOSStatus(acos, settings) {
    if (acos <= settings.low) return '🟢 DOSKONAŁY';
    if (acos <= settings.breakEven) return '🟢 DOBRY';
    if (acos <= settings.high) return '🟠 UWAGA';
    return '🔴 KRYTYCZNY';
  }
}

// ===== FUNKCJE GLOBALNE =====

/**
 * FIX: Bezpośrednie wywołanie - NIE ZALEŻY od LukoLogger ani innych klas
 */
function runSnapshotDirect() {
  try {
    // Własny prosty logger
    const logger = {
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
      }
    };

    logger.log('🚀 Starting Snapshot Analysis (Direct)...', 'INFO');

    const analyzer = new SnapshotAnalyzer(logger);
    analyzer.generateSnapshot();

    logger.saveToSheet();
    SpreadsheetApp.getUi().alert('✅ Snapshot wygenerowany pomyślnie!');

  } catch (error) {
    SpreadsheetApp.getUi().alert(`❌ Błąd: ${error.message}\n\nStack: ${error.stack || 'brak'}`);
    console.error('Error in runSnapshotDirect:', error);
  }
}

/**
 * FIX: Funkcja do dodania do menu - w pełni samodzielna
 */
function generateSnapshotStandalone() {
  runSnapshotDirect();
}
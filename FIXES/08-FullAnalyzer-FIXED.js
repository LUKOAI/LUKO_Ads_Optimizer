// ===== 08-FULLANALYZER.GS - WERSJA 5.2 FIXED =====
// ====================================
// LUKO AMZ Ads Optimizer
// Version: 0.60 (FIXED V3.4)
// Author: Łukasz Koronczok, NetAnaliza
// ====================================
// FIX V3.4: Integracja z wspólnymi zasadami TargetAnalysisRules
// FIX V2: W pełni samodzielna wersja - nie zależy od LukoLogger ani innych klas
// Rozwiązuje "logger is not defined" i inne błędy zależności

class FullAnalyzer {
  constructor(logger) {
    // FIX: Bezpieczna inicjalizacja logger - ZAWSZE działa
    this.logger = this.createSafeLogger(logger);
    this.acosSettings = this.loadAcosSettings();
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

  loadAcosSettings() {
    try {
      // Próbuj użyć globalnej funkcji
      if (typeof getAcosSettings === 'function') {
        return getAcosSettings();
      }
    } catch (e) {
      this.logger.log('getAcosSettings() not available, using defaults', 'WARNING');
    }

    // Domyślne wartości
    return { breakEven: 30, low: 15, high: 40 };
  }

  generateFull(metrics, integratedData) {
    this.logger.log('📊 Starting FULL ANALYSIS generation...', 'INFO');

    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // FIX: Bezpieczne pobieranie nazwy arkusza
    let sheetName = 'LUKO_Full_Analysis';
    try {
      if (typeof LUKO_CONFIG !== 'undefined' && LUKO_CONFIG.SHEETS && LUKO_CONFIG.SHEETS.FULL_ANALYSIS) {
        sheetName = LUKO_CONFIG.SHEETS.FULL_ANALYSIS;
      }
    } catch (e) {
      // Użyj domyślnej nazwy
    }

    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    } else {
      sheet.clear();
    }

    this.createFullAnalysisSheet(sheet, metrics, integratedData);
    this.logger.log('✅ Full analysis generated successfully', 'SUCCESS');
  }

  createFullAnalysisSheet(sheet, metrics, integratedData) {
    let row = 1;

    row = this.createHeaderSection(sheet, row, metrics);
    row += 2;
    row = this.createKeyMetricsSection(sheet, row, metrics);
    row += 2;
    row = this.createProfitabilitySection(sheet, row, metrics);
    row += 2;
    row = this.createTargetsCampaignsSection(sheet, row, metrics);
    row += 2;
    row = this.createTargetValueAnalysis(sheet, row, metrics);
    row += 2;
    row = this.createParetoAnalysis(sheet, row, metrics);
    row += 2;
    row = this.createRecommendationsSection(sheet, row, metrics);

    this.applyFormatting(sheet);
  }

  createHeaderSection(sheet, startRow, metrics) {
    const now = new Date();
    sheet.getRange(startRow, 1).setValue('📊 AMAZON ADS - PEŁNA ANALIZA WYDAJNOŚCI')
      .setFontSize(16).setFontWeight('bold')
      .setBackground('#1a73e8').setFontColor('white');
    sheet.getRange(startRow, 1, 1, 8).merge();

    sheet.getRange(startRow + 1, 1)
      .setValue(`Data generacji: ${now.toLocaleString('pl-PL')}`)
      .setFontStyle('italic');

    sheet.getRange(startRow + 2, 1)
      .setValue('LUKO ANALYZER V6.0 - Kompleksowa analiza kampanii Amazon Advertising')
      .setFontWeight('bold');

    return startRow + 3;
  }

  createKeyMetricsSection(sheet, startRow, metrics) {
    sheet.getRange(startRow, 1).setValue('📈 KLUCZOWE METRYKI WYDAJNOŚCI')
      .setFontWeight('bold').setBackground('#f0f0f0');
    sheet.getRange(startRow, 1, 1, 8).merge();

    // FIX: Bezpieczny dostęp do metrics.totals
    const totals = metrics.totals || {};

    const d = [
      ['Metryka', 'Wartość', 'Status', 'Benchmark', 'Ocena'],
      ['Wyświetlenia', this.formatNumber(totals.impressions || 0), '', '', ''],
      ['Kliknięcia', this.formatNumber(totals.clicks || 0), '', '', ''],
      ['CTR', `${(totals.ctr || 0).toFixed(2)}%`, this.evaluateMetric('ctr', totals.ctr || 0), '0.8-2%', ''],
      ['Sprzedaż', this.formatCurrency(totals.sales || 0), '', '', ''],
      ['Wydatki', this.formatCurrency(totals.spend || 0), '', '', ''],
      ['CPC', this.formatCurrency(totals.cpc || 0), this.evaluateMetric('cpc', totals.cpc || 0), '€0.30-€1.20', ''],
      ['ACOS', `${(totals.acos || 0).toFixed(1)}%`, this.evaluateAcos(totals.acos || 0), `≤${this.acosSettings.breakEven}%`, `${((totals.acos || 0) - this.acosSettings.breakEven).toFixed(1)}pp`],
      ['ROAS', (totals.roas || 0).toFixed(2), this.evaluateAcos(totals.acos || 0), '≥2.5', ''],
      ['Zamówienia', this.formatNumber(totals.orders || 0), '', '', ''],
      ['Współczynnik konwersji', `${(totals.conversionRate || 0).toFixed(2)}%`, '', '', ''],
      ['Średnia wartość zamówienia', this.formatCurrency(totals.avgOrderValue || 0), '', '', '']
    ];

    sheet.getRange(startRow + 1, 1, d.length, 5).setValues(d);
    sheet.getRange(startRow + 1, 1, 1, 5).setFontWeight('bold').setBackground('#e8f0fe');
    return startRow + d.length + 1;
  }

  createProfitabilitySection(sheet, startRow, metrics) {
    sheet.getRange(startRow, 1).setValue('💰 ANALIZA RENTOWNOŚCI')
      .setFontWeight('bold').setBackground('#f0f0f0');
    sheet.getRange(startRow, 1, 1, 8).merge();

    const totals = metrics.totals || {};
    const p = (metrics.analysis && metrics.analysis.profitability)
      ? metrics.analysis.profitability
      : this.calculateBasicProfitability(totals);

    const d = [
      ['Kategoria', 'Wartość', 'Status', 'Komentarz'],
      ['Próg break-even ACOS', `${this.acosSettings.breakEven}%`, '', 'Ustawiony próg rentowności'],
      ['Aktualny ACOS', `${(totals.acos || 0).toFixed(1)}%`, this.evaluateAcos(totals.acos || 0), ''],
      ['Odchylenie od break-even',
        `${p.marginToBreakEven > 0 ? '+' : ''}${p.marginToBreakEven.toFixed(1)}pp`,
        p.marginToBreakEven > 0 ? '🟢 ZYSK' : '🔴 STRATA',
        p.marginToBreakEven > 0 ? 'W normie' : 'Powyżej progu!'],
      [`Szacowana marża (${this.acosSettings.breakEven}%)`,
        this.formatCurrency(p.estimatedMargin), '', 'Szacunkowa marża ze sprzedaży'],
      ['Wydatki na reklamy', this.formatCurrency(totals.spend || 0), '', 'Łączne wydatki'],
      ['Szacowany wynik',
        this.formatCurrency(p.profitLoss),
        p.profitLoss > 0 ? '🟢 ZYSK' : '🔴 STRATA',
        p.profitLoss > 0 ? 'Kampanie rentowne' : 'Optymalizacja potrzebna']
    ];

    sheet.getRange(startRow + 1, 1, d.length, 4).setValues(d);
    sheet.getRange(startRow + 1, 1, 1, 4).setFontWeight('bold').setBackground('#e8f0fe');
    return startRow + d.length + 1;
  }

  createTargetsCampaignsSection(sheet, startRow, metrics) {
    sheet.getRange(startRow, 1).setValue('🎯 ANALIZA KAMPANII I TARGETÓW')
      .setFontWeight('bold').setBackground('#f0f0f0');
    sheet.getRange(startRow, 1, 1, 8).merge();

    const ch = (metrics.analysis && metrics.analysis.campaignHealth) ||
      { healthy: 0, warning: 0, critical: 0, total: 0 };
    const ta = metrics.targetAnalysis || {};

    const d = [
      ['Metryka', 'Wartość', 'Komentarz'],
      ['Kampanie: łącznie', this.formatNumber(ch.total), ''],
      ['Kampanie w normie (ACOS ≤ BE)', this.formatNumber(ch.healthy), ''],
      ['Kampanie uwaga (≤ 1.5 × BE)', this.formatNumber(ch.warning), ''],
      ['Kampanie krytyczne (> 1.5 × BE)', this.formatNumber(ch.critical), ''],
      ['', '', ''],
      ['Targety: łącznie (z kosztem/klikami)', this.formatNumber(ta.totalTargets || 0), ''],
      ['Targety bez sprzedaży', this.formatNumber(ta.zeroSalesTargets || 0),
        `Koszt: ${this.formatCurrency(ta.zeroSalesSpend || 0)}`],
      [`Targety ACOS > ${this.acosSettings.breakEven}%`, this.formatNumber(ta.unprofitableTargets || 0), ''],
      [`Targety ACOS ≤ ${this.acosSettings.breakEven}%`, this.formatNumber(ta.goodAcosTargets || 0), ''],
      [`Targety ACOS ≤ ${this.acosSettings.breakEven / 2}%`, this.formatNumber(ta.excellentAcosTargets || 0), '']
    ];

    sheet.getRange(startRow + 1, 1, d.length, 3).setValues(d);
    sheet.getRange(startRow + 1, 1, 1, 3).setFontWeight('bold').setBackground('#e8f0fe');
    return startRow + d.length + 1;
  }

  createTargetValueAnalysis(sheet, startRow, metrics) {
    sheet.getRange(startRow, 1).setValue('💎 ANALIZA WARTOŚCIOWA TARGETÓW')
      .setFontWeight('bold').setBackground('#f0f0f0');
    sheet.getRange(startRow, 1, 1, 8).merge();

    const ta = metrics.targetAnalysis || {};
    const totals = metrics.totals || {};
    const totalSales = totals.sales || 1;

    const d = [
      ['Grupa targetów', 'Liczba', 'Sprzedaż', '% sprzedaży', 'Wydatki', 'ACOS'],

      [`ACOS > ${this.acosSettings.breakEven}% (nierentowne)`,
        this.formatNumber(ta.unprofitableTargets || 0),
        this.formatCurrency(ta.unprofitableSales || 0),
        `${((ta.unprofitableSales || 0) / totalSales * 100).toFixed(1)}%`,
        this.formatCurrency(ta.unprofitableSpend || 0),
        ta.unprofitableSales > 0 ? `${(ta.unprofitableSpend / ta.unprofitableSales * 100).toFixed(1)}%` : 'N/A'],

      [`ACOS ≤ ${this.acosSettings.breakEven}% (rentowne)`,
        this.formatNumber(ta.goodAcosTargets || 0),
        this.formatCurrency(ta.goodAcosSales || 0),
        `${((ta.goodAcosSales || 0) / totalSales * 100).toFixed(1)}%`,
        this.formatCurrency(ta.goodAcosSpend || 0),
        ta.goodAcosSales > 0 ? `${(ta.goodAcosSpend / ta.goodAcosSales * 100).toFixed(1)}%` : 'N/A'],

      [`ACOS ≤ ${this.acosSettings.breakEven / 2}% (bardzo rentowne)`,
        this.formatNumber(ta.excellentAcosTargets || 0),
        this.formatCurrency(ta.excellentAcosSales || 0),
        `${((ta.excellentAcosSales || 0) / totalSales * 100).toFixed(1)}%`,
        this.formatCurrency(ta.excellentAcosSpend || 0),
        ta.excellentAcosSales > 0 ? `${(ta.excellentAcosSpend / ta.excellentAcosSales * 100).toFixed(1)}%` : 'N/A'],

      ['Bez sprzedaży (do wyłączenia)',
        this.formatNumber(ta.zeroSalesTargets || 0),
        '€0,00',
        '0%',
        this.formatCurrency(ta.zeroSalesSpend || 0),
        '∞']
    ];

    sheet.getRange(startRow + 1, 1, d.length, 6).setValues(d);
    sheet.getRange(startRow + 1, 1, 1, 6).setFontWeight('bold').setBackground('#e8f0fe');

    if (d.length > 1) {
      sheet.getRange(startRow + 2, 1, 1, 6).setBackground('#ffe8e8');
      sheet.getRange(startRow + 3, 1, 1, 6).setBackground('#e8f5e8');
      sheet.getRange(startRow + 4, 1, 1, 6).setBackground('#d4edda');
      sheet.getRange(startRow + 5, 1, 1, 6).setBackground('#f8d7da');
    }

    return startRow + d.length + 1;
  }

  createParetoAnalysis(sheet, startRow, metrics) {
    sheet.getRange(startRow, 1).setValue('🏆 TOP TARGETY (ANALIZA PARETO 20/80)')
      .setFontWeight('bold').setBackground('#f0f0f0');
    sheet.getRange(startRow, 1, 1, 8).merge();

    const ta = metrics.targetAnalysis || {};
    const paretoTargets = ta.paretoTargets || [];

    if (paretoTargets.length === 0) {
      sheet.getRange(startRow + 1, 1).setValue('Brak danych do analizy Pareto');
      return startRow + 2;
    }

    const totals = metrics.totals || {};
    const totalSales = totals.sales || 1;
    const paretoCount = paretoTargets.length;
    const paretoPercent = (paretoCount / (ta.totalTargets || 1) * 100).toFixed(1);
    const paretoCumulative = paretoTargets.length > 0 ?
      (paretoTargets[paretoTargets.length - 1].cumulativePercent || 0).toFixed(1) : 0;

    sheet.getRange(startRow + 1, 1)
      .setValue(`TOP ${paretoCount} targetów (${paretoPercent}% wszystkich) generuje ${paretoCumulative}% sprzedaży`)
      .setFontWeight('bold').setBackground('#fff3cd');

    const headers = ['#', 'Keyword/Target', 'Kampania', 'Grupa', 'Sprzedaż', '% total', 'Wydatki', 'ACOS'];
    const data = [headers];

    const topLimit = Math.min(10, paretoTargets.length);
    for (let i = 0; i < topLimit; i++) {
      const t = paretoTargets[i];
      data.push([
        (i + 1).toString(),
        t.keyword || 'Unknown',
        t.campaign || '',
        t.adGroup || '',
        this.formatCurrency(t.sales || 0),
        `${(t.salesPercent || 0).toFixed(1)}%`,
        this.formatCurrency(t.spend || 0),
        `${(t.acos || 0).toFixed(1)}%`
      ]);
    }

    if (paretoTargets.length > 10) {
      data.push([
        '...',
        `+ ${paretoTargets.length - 10} innych targetów`,
        '', '', '', '', '', ''
      ]);
    }

    sheet.getRange(startRow + 2, 1, data.length, 8).setValues(data);
    sheet.getRange(startRow + 2, 1, 1, 8).setFontWeight('bold').setBackground('#e8f0fe');

    return startRow + data.length + 2;
  }

  createRecommendationsSection(sheet, startRow, metrics) {
    sheet.getRange(startRow, 1).setValue('💡 REKOMENDACJE OPTYMALIZACYJNE')
      .setFontWeight('bold').setBackground('#f0f0f0');
    sheet.getRange(startRow, 1, 1, 8).merge();

    const recs = (metrics.evaluation && metrics.evaluation.recommendations) || [];

    if (recs.length === 0) {
      sheet.getRange(startRow + 1, 1).setValue('Brak rekomendacji - kampanie działają optymalnie')
        .setFontStyle('italic');
      return startRow + 2;
    }

    const d = [['Priorytet', 'Obszar', 'Rekomendacja', 'Oczekiwany efekt']];

    recs.forEach(r => {
      d.push([
        r.priority || '',
        r.category || '',
        r.action || '',
        r.expectedImpact || ''
      ]);
    });

    sheet.getRange(startRow + 1, 1, d.length, 4).setValues(d);
    sheet.getRange(startRow + 1, 1, 1, 4).setFontWeight('bold').setBackground('#e8f0fe');

    for (let i = 2; i <= d.length; i++) {
      const priority = d[i - 1][0];
      if (priority === 'CRITICAL') {
        sheet.getRange(startRow + i, 1, 1, 4).setBackground('#ffeaa7');
      } else if (priority === 'HIGH') {
        sheet.getRange(startRow + i, 1, 1, 4).setBackground('#fff3cd');
      }
    }

    return startRow + d.length + 1;
  }

  applyFormatting(sheet) {
    for (let c = 1; c <= 8; c++) sheet.autoResizeColumn(c);
    if (sheet.getColumnWidth(1) < 250) sheet.setColumnWidth(1, 250);

    const r = sheet.getLastRow();
    const c = sheet.getLastColumn();
    if (r > 0 && c > 0) {
      sheet.getRange(1, 1, r, c).setBorder(
        true, true, true, true, true, true,
        '#cccccc', SpreadsheetApp.BorderStyle.SOLID
      );
    }
  }

  formatNumber(n) {
    return n ? n.toLocaleString('pl-PL') : '0';
  }

  formatCurrency(a) {
    return (a || 0).toLocaleString('pl-PL', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2
    });
  }

  evaluateAcos(acos) {
    // FIX V3.4: Użyj wspólnych zasad z TargetAnalysisRules jeśli dostępne
    if (typeof TargetAnalysisRules !== 'undefined') {
      return TargetAnalysisRules.evaluateAcos(acos);
    }
    // Fallback - lokalna logika
    if (acos <= this.acosSettings.low) return '🟢 DOSKONAŁY';
    if (acos <= this.acosSettings.breakEven) return '🟡 DOBRY';
    if (acos <= this.acosSettings.high) return '🟠 UWAGA';
    return '🔴 KRYTYCZNY';
  }

  evaluateMetric(type, v) {
    if (type === 'ctr') {
      return v >= 1.5 ? '🟢 DOSKONAŁY' : v >= 1.0 ? '🟡 DOBRY' :
        v >= 0.5 ? '🟠 SŁABY' : '🔴 BARDZO SŁABY';
    }
    if (type === 'cpc') {
      return v <= 0.40 ? '🟢 NISKI' : v <= 0.80 ? '🟡 ŚREDNI' :
        v <= 1.50 ? '🟠 WYSOKI' : '🔴 BARDZO WYSOKI';
    }
    return '';
  }

  calculateBasicProfitability(t) {
    const marginPercent = this.acosSettings.breakEven / 100;
    const sales = t.sales || 0;
    const spend = t.spend || 0;
    const acos = t.acos || 0;
    const estimatedMargin = sales * marginPercent;
    const profitLoss = estimatedMargin - spend;
    const marginToBreakEven = this.acosSettings.breakEven - acos;
    return { estimatedMargin, profitLoss, marginToBreakEven };
  }
}

// ===== FUNKCJE GLOBALNE =====

/**
 * FIX: Bezpośrednie wywołanie - NIE ZALEŻY od LukoLogger ani innych klas
 */
function runFullAnalysisDirect() {
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
        // Opcjonalnie zapisz logi do arkusza
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

    logger.log('🚀 Starting Full Analysis (Direct)...', 'INFO');

    // Sprawdź czy MetricsCalculator istnieje
    let metrics;
    if (typeof MetricsCalculator === 'function') {
      const calc = new MetricsCalculator(logger);
      metrics = calc.calculateMetrics(null, 'tu wklejasz raport z amazon');
    } else {
      // Fallback - prosty kalkulator
      logger.log('MetricsCalculator not found, using simple calculation', 'WARNING');
      metrics = calculateSimpleMetrics();
    }

    const analyzer = new FullAnalyzer(logger);
    analyzer.generateFull(metrics, null);

    logger.saveToSheet();
    SpreadsheetApp.getUi().alert('✅ Pełna analiza wygenerowana pomyślnie!');

  } catch (error) {
    SpreadsheetApp.getUi().alert(`❌ Błąd: ${error.message}\n\nStack: ${error.stack || 'brak'}`);
    console.error('Error in runFullAnalysisDirect:', error);
  }
}

/**
 * FIX: Prosty kalkulator metryk jako fallback
 */
function calculateSimpleMetrics() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // V6.2: Używaj helper function dla kompatybilności wstecznej
  const sheet = typeof getAmazonReportSheet === 'function'
    ? getAmazonReportSheet()
    : ss.getSheetByName(LUKO_CONFIG.SHEETS.AMAZON_REPORT) || ss.getSheetByName(LUKO_CONFIG.SHEETS.AMAZON_REPORT_OLD);

  if (!sheet || sheet.getLastRow() < 2) {
    return {
      totals: { impressions: 0, clicks: 0, spend: 0, sales: 0, orders: 0, ctr: 0, cpc: 0, acos: 0, roas: 0, conversionRate: 0, avgOrderValue: 0 },
      targetAnalysis: {},
      acosSettings: { breakEven: 30, low: 15, high: 40 }
    };
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  // Znajdź kolumny
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

  // Sumuj
  const totals = { impressions: 0, clicks: 0, spend: 0, sales: 0, orders: 0 };

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (cols.impressions >= 0) totals.impressions += parseFloat(row[cols.impressions]) || 0;
    if (cols.clicks >= 0) totals.clicks += parseFloat(row[cols.clicks]) || 0;
    if (cols.spend >= 0) totals.spend += parseFloat(String(row[cols.spend]).replace(/[€$,]/g, '')) || 0;
    if (cols.sales >= 0) totals.sales += parseFloat(String(row[cols.sales]).replace(/[€$,]/g, '')) || 0;
    if (cols.orders >= 0) totals.orders += parseFloat(row[cols.orders]) || 0;
  }

  // Oblicz metryki pochodne
  totals.ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions * 100) : 0;
  totals.cpc = totals.clicks > 0 ? (totals.spend / totals.clicks) : 0;
  totals.acos = totals.sales > 0 ? (totals.spend / totals.sales * 100) : 999;
  totals.roas = totals.spend > 0 ? (totals.sales / totals.spend) : 0;
  totals.conversionRate = totals.clicks > 0 ? (totals.orders / totals.clicks * 100) : 0;
  totals.avgOrderValue = totals.orders > 0 ? (totals.sales / totals.orders) : 0;

  return {
    totals: totals,
    targetAnalysis: {},
    acosSettings: { breakEven: 30, low: 15, high: 40 }
  };
}

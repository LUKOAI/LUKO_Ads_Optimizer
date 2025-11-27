// ===== 08-FULLANALYZER.GS - WERSJA 5.0 =====
// ====================================
// LUKO AMZ Ads Optimizer
// Version: 0.60
// Author: Łukasz Koronczok, NetAnaliza
// ====================================
// DODANE: Analiza wartościowa targetów, TOP 20% Pareto, pełne rekomendacje

class FullAnalyzer {
  constructor(logger) {
    this.logger = logger || console;
    this.acosSettings = this.loadAcosSettings();
  }

  loadAcosSettings() {
    try { 
      return getAcosSettings(); 
    } catch (e) {
      this.logger.log(`ACOS settings load failed, using defaults`, 'WARNING');
      return { breakEven: 30, low: 15, high: 40 };
    }
  }

  generateFull(metrics, integratedData) {
    this.logger.log('📊 Starting FULL ANALYSIS generation...', 'INFO');

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(LUKO_CONFIG.SHEETS.FULL_ANALYSIS);
    if (!sheet) sheet = ss.insertSheet(LUKO_CONFIG.SHEETS.FULL_ANALYSIS);
    else sheet.clear();

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
    row = this.createTargetValueAnalysis(sheet, row, metrics); // NOWE!
    row += 2;
    row = this.createParetoAnalysis(sheet, row, metrics); // NOWE!
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

    const d = [
      ['Metryka', 'Wartość', 'Status', 'Benchmark', 'Ocena'],
      ['Wyświetlenia', this.formatNumber(metrics.totals.impressions), '', '', ''],
      ['Kliknięcia', this.formatNumber(metrics.totals.clicks), '', '', ''],
      ['CTR', `${metrics.totals.ctr.toFixed(2)}%`, this.evaluateMetric('ctr', metrics.totals.ctr), '0.8-2%', ''],
      ['Sprzedaż', this.formatCurrency(metrics.totals.sales), '', '', ''],
      ['Wydatki', this.formatCurrency(metrics.totals.spend), '', '', ''],
      ['CPC', this.formatCurrency(metrics.totals.cpc), this.evaluateMetric('cpc', metrics.totals.cpc), '€0.30-€1.20', ''],
      ['ACOS', `${metrics.totals.acos.toFixed(1)}%`, this.evaluateAcos(metrics.totals.acos), `≤${this.acosSettings.breakEven}%`, `${(metrics.totals.acos - this.acosSettings.breakEven).toFixed(1)}pp`],
      ['ROAS', metrics.totals.roas.toFixed(2), this.evaluateAcos(metrics.totals.acos), '≥2.5', ''],
      ['Zamówienia', this.formatNumber(metrics.totals.orders), '', '', ''],
      ['Współczynnik konwersji', `${metrics.totals.conversionRate.toFixed(2)}%`, '', '', ''],
      ['Średnia wartość zamówienia', this.formatCurrency(metrics.totals.avgOrderValue), '', '', '']
    ];

    sheet.getRange(startRow + 1, 1, d.length, 5).setValues(d);
    sheet.getRange(startRow + 1, 1, 1, 5).setFontWeight('bold').setBackground('#e8f0fe');
    return startRow + d.length + 1;
  }

  createProfitabilitySection(sheet, startRow, metrics) {
    sheet.getRange(startRow, 1).setValue('💰 ANALIZA RENTOWNOŚCI')
      .setFontWeight('bold').setBackground('#f0f0f0');
    sheet.getRange(startRow, 1, 1, 8).merge();

    const p = (metrics.analysis && metrics.analysis.profitability)
      ? metrics.analysis.profitability
      : this.calculateBasicProfitability(metrics.totals);

    const d = [
      ['Kategoria', 'Wartość', 'Status', 'Komentarz'],
      ['Próg break-even ACOS', `${this.acosSettings.breakEven}%`, '', 'Ustawiony próg rentowności'],
      ['Aktualny ACOS', `${metrics.totals.acos.toFixed(1)}%`, this.evaluateAcos(metrics.totals.acos), ''],
      ['Odchylenie od break-even', 
        `${p.marginToBreakEven > 0 ? '+' : ''}${p.marginToBreakEven.toFixed(1)}pp`,
        p.marginToBreakEven > 0 ? '🟢 ZYSK' : '🔴 STRATA',
        p.marginToBreakEven > 0 ? 'W normie' : 'Powyżej progu!'],
      [`Szacowana marża (${this.acosSettings.breakEven}%)`, 
        this.formatCurrency(p.estimatedMargin), '', 'Szacunkowa marża ze sprzedaży'],
      ['Wydatki na reklamy', this.formatCurrency(metrics.totals.spend), '', 'Łączne wydatki'],
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

  // NOWA SEKCJA: Analiza wartościowa targetów
  createTargetValueAnalysis(sheet, startRow, metrics) {
    sheet.getRange(startRow, 1).setValue('💎 ANALIZA WARTOŚCIOWA TARGETÓW')
      .setFontWeight('bold').setBackground('#f0f0f0');
    sheet.getRange(startRow, 1, 1, 8).merge();

    const ta = metrics.targetAnalysis || {};
    const totalSales = metrics.totals.sales || 1;

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
    
    // Kolorowanie wierszy
    if (d.length > 1) {
      sheet.getRange(startRow + 2, 1, 1, 6).setBackground('#ffe8e8'); // nierentowne
      sheet.getRange(startRow + 3, 1, 1, 6).setBackground('#e8f5e8'); // rentowne
      sheet.getRange(startRow + 4, 1, 1, 6).setBackground('#d4edda'); // bardzo rentowne
      sheet.getRange(startRow + 5, 1, 1, 6).setBackground('#f8d7da'); // bez sprzedaży
    }
    
    return startRow + d.length + 1;
  }

  // NOWA SEKCJA: Analiza Pareto - TOP 20%
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

    const totalSales = metrics.totals.sales || 1;
    const paretoCount = paretoTargets.length;
    const paretoPercent = (paretoCount / (ta.totalTargets || 1) * 100).toFixed(1);
    const paretoCumulative = paretoTargets.length > 0 ? 
      paretoTargets[paretoTargets.length - 1].cumulativePercent.toFixed(1) : 0;

    // Podsumowanie
    sheet.getRange(startRow + 1, 1)
      .setValue(`TOP ${paretoCount} targetów (${paretoPercent}% wszystkich) generuje ${paretoCumulative}% sprzedaży`)
      .setFontWeight('bold').setBackground('#fff3cd');

    // Nagłówki tabeli
    const headers = ['#', 'Keyword/Target', 'Kampania', 'Grupa', 'Sprzedaż', '% total', 'Wydatki', 'ACOS'];
    const data = [headers];

    // TOP 10 targetów szczegółowo
    const topLimit = Math.min(10, paretoTargets.length);
    for (let i = 0; i < topLimit; i++) {
      const t = paretoTargets[i];
      data.push([
        (i + 1).toString(),
        t.keyword || 'Unknown',
        t.campaign || '',
        t.adGroup || '',
        this.formatCurrency(t.sales),
        `${t.salesPercent.toFixed(1)}%`,
        this.formatCurrency(t.spend),
        `${t.acos.toFixed(1)}%`
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
    
    // Koloruj priorytety
    for (let i = 2; i <= d.length; i++) {
      const priority = d[i-1][0];
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
    const estimatedMargin = t.sales * marginPercent;
    const profitLoss = estimatedMargin - t.spend;
    const marginToBreakEven = this.acosSettings.breakEven - t.acos;
    return { estimatedMargin, profitLoss, marginToBreakEven };
  }
}
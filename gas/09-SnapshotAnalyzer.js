// ===== 09-SnapshotAnalyzer.gs - WERSJA 4.0 =====
// ====================================
// LUKO AMZ Ads Optimizer
// Version: 0.60
// Author: Łukasz Koronczok, NetAnaliza
// ====================================
// Marża = break-even%, spójna ocena ACOS/ROAS

class SnapshotAnalyzer {
  constructor(logger) { 
    this.logger = logger || console; 
  }

  generateSnapshot() {
    try {
      this.logger.log('🚀 STARTING SNAPSHOT ANALYSIS - LUKO V6.0', 'INFO');

      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const primarySheet = ss.getSheetByName('tu wklejasz raport z amazon');
      
      if (!primarySheet || primarySheet.getLastRow() < 2) {
        throw new Error('Brak danych w arkuszu "tu wklejasz raport z amazon"');
      }

      const calc = new MetricsCalculator(this.logger);
      const metrics = calc.calculateMetrics(null, 'tu wklejasz raport z amazon');

      this.logger.log(`✅ Metrics calculated - ACOS: ${metrics.totals.acos.toFixed(1)}%`, 'SUCCESS');
      this.generateReport(metrics);

      this.logger.log('✅ ANALYSIS COMPLETED SUCCESSFULLY', 'SUCCESS');
      return true;
    } catch (error) {
      this.logger.log(`💥 ANALYSIS FAILED: ${error.message}`, 'ERROR');
      throw error;
    }
  }

  generateReport(metrics) {
    this.logger.log('📸 Generating snapshot report...', 'INFO');

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const existing = ss.getSheetByName('LUKO_Snapshot');
    if (existing) ss.deleteSheet(existing);
    const sheet = ss.insertSheet('LUKO_Snapshot');

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

    const acosStatus = this.getACOSStatus(metrics.totals.acos, metrics.acosSettings);
    const md = [
      ['Metryka', 'Wartość', 'Status', 'Ocena'],
      ['ACOS', `${metrics.totals.acos.toFixed(1)}%`, acosStatus, ''],
      ['ROAS', metrics.totals.roas.toFixed(2), acosStatus, ''], // Ta sama ocena!
      ['CTR', `${metrics.totals.ctr.toFixed(2)}%`, 
        metrics.totals.ctr >= 1 ? '🟢 WYSOKI' : 
        metrics.totals.ctr >= 0.5 ? '🟡 ŚREDNI' : '🔴 NISKI', ''],
      ['Sprzedaż', `${metrics.totals.sales.toFixed(2)} €`, '', ''],
      ['Wydatki', `${metrics.totals.spend.toFixed(2)} €`, '', '']
    ];
    
    sheet.getRange(row, 1, md.length, 4).setValues(md).setBorder(true, true, true, true, true, true);
    sheet.getRange(row, 1, 1, 4).setBackground('#E0E0E0').setFontWeight('bold');
    row += md.length + 2;

    // ANALIZA FINANSOWA (marża = break-even%)
    sheet.getRange(row, 1).setValue('💰 ANALIZA FINANSOWA')
      .setFontWeight('bold').setBackground('#FFA726');
    row += 2;

    const marginPercent = metrics.acosSettings.breakEven / 100;
    const margin = metrics.totals.sales * marginPercent;
    const realProfit = margin - metrics.totals.spend;
    const marginToBE = metrics.acosSettings.breakEven - metrics.totals.acos;

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
      ['Wyświetlenia', metrics.totals.impressions.toLocaleString('pl-PL'), '', ''],
      ['Kliknięcia', metrics.totals.clicks.toLocaleString('pl-PL'), '', ''],
      ['Zamówienia', metrics.totals.orders.toString(), '', ''],
      ['Konwersja', `${metrics.totals.conversionRate.toFixed(2)}%`, '', ''],
      ['Średnia wartość zamówienia', `${metrics.totals.avgOrderValue.toFixed(2)} €`, '', '']
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
      [`ACOS > ${metrics.acosSettings.breakEven}%`, (ta.unprofitableTargets || 0).toString(), '', ''],
      [`ACOS ≤ ${metrics.acosSettings.breakEven}%`, (ta.goodAcosTargets || 0).toString(), '', ''],
      [`ACOS ≤ ${metrics.acosSettings.breakEven / 2}%`, (ta.excellentAcosTargets || 0).toString(), '', '']
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
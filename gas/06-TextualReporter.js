// ===== 06-TextualReporter.gs - WERSJA 4.0 =====
// ====================================
// LUKO AMZ Ads Optimizer
// Version: 0.60
// Author: Łukasz Koronczok, NetAnaliza
// ====================================


class TextualReporter {
  constructor(logger) {
    this.logger = logger || console;
    this.acosSettings = this.loadAcosSettings();
  }

  loadAcosSettings() {
    try {
      return getAcosSettings();
    } catch (error) {
      this.logger.log(`ACOS settings load failed, using defaults`, 'WARNING');
      return { breakEven: 30, low: 15, high: 40 };
    }
  }

  generateReport(metrics, integratedData) {
    this.logger.log('📝 Generating Polish textual report...', 'INFO');

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(LUKO_CONFIG.SHEETS.TEXTUAL_REPORT);
    if (!sheet) sheet = ss.insertSheet(LUKO_CONFIG.SHEETS.TEXTUAL_REPORT);
    else sheet.clear();

    const report = this.buildPolishReport(metrics, integratedData);
    this.writeReport(sheet, report);

    this.logger.log('✅ Polish textual report generated successfully', 'SUCCESS');
  }

  buildPolishReport(metrics, integratedData) {
    const lines = [];
    const now = new Date();

    lines.push('📊 RAPORT WYDAJNOŚCI REKLAM AMAZON - LUKO ANALYZER V6.0');
    lines.push('Data generacji: ' + now.toLocaleString('pl-PL'));
    lines.push('');
    lines.push('═'.repeat(70));
    lines.push('');

    lines.push('⚙️ USTAWIENIA PROGÓW WYDAJNOŚCI');
    lines.push(`• Świetny ACOS (zielony): ≤ ${this.acosSettings.low}%`);
    lines.push(`• Break-even ACOS (żółty): ≤ ${this.acosSettings.breakEven}%`);
    lines.push(`• Wysokie ryzyko ACOS (czerwony): > ${this.acosSettings.high}%`);
    lines.push('');

    lines.push('📈 PODSUMOWANIE WYDAJNOŚCI');
    lines.push(`Wyświetlenia: ${this.formatNumber(metrics.totals.impressions)}`);
    lines.push(`Kliknięcia: ${this.formatNumber(metrics.totals.clicks)}`);
    lines.push(`CTR: ${metrics.totals.ctr.toFixed(2)}%`);
    lines.push(`Zamówienia: ${this.formatNumber(metrics.totals.orders)}`);
    lines.push(`Współczynnik konwersji: ${metrics.totals.conversionRate.toFixed(2)}%`);
    lines.push(`Sprzedaż: ${this.formatCurrency(metrics.totals.sales)}`);
    lines.push(`Wydatki: ${this.formatCurrency(metrics.totals.spend)}`);
    lines.push(`ACOS: ${metrics.totals.acos.toFixed(1)}% ${this.getAcosEmoji(metrics.totals.acos)}`);
    lines.push(`ROAS: ${metrics.totals.roas.toFixed(2)}`);
    lines.push(`Średnia wartość zamówienia (AOV): ${this.formatCurrency(metrics.totals.avgOrderValue)}`);
    lines.push('');

    const ta = metrics.targetAnalysis || {};
    lines.push('🎯 PODSUMOWANIE TARGETÓW');
    lines.push(`• Liczba targetów (z kosztem/klikami): ${this.formatNumber(ta.totalTargets || 0)}`);
    lines.push(`• Bez sprzedaży: ${this.formatNumber(ta.zeroSalesTargets || 0)}`);
    lines.push(`• ACOS > ${this.acosSettings.breakEven}%: ${this.formatNumber(ta.unprofitableTargets || 0)}`);
    lines.push(`• ACOS ≤ ${this.acosSettings.breakEven}%: ${this.formatNumber(ta.goodAcosTargets || 0)}`);
    lines.push(`• ACOS ≤ ${this.acosSettings.breakEven / 2}%: ${this.formatNumber(ta.excellentAcosTargets || 0)}`);
    lines.push('');

    const acosStatus = this.evaluateAcos(metrics.totals.acos);
    const profitability =
      (metrics.analysis && metrics.analysis.profitability)
        ? metrics.analysis.profitability
        : this.calculateBasicProfitability(metrics.totals);

    lines.push('📊 STATUS STRATEGII ' + this.getStatusIcon(acosStatus));
    lines.push(`Szacowany wynik: ${this.formatCurrency(profitability.profitLoss)}`);
    lines.push(`Margines do break-even: ${profitability.marginToBreakEven.toFixed(1)} pp`);
    
    if (profitability.marginToBreakEven < 0) {
      lines.push(`❌ STRATA! (próg break-even: ${this.acosSettings.breakEven}%)`);
    } else {
      lines.push(`✅ Kampanie rentowne (marża bezpieczeństwa: ${profitability.marginToBreakEven.toFixed(1)} pp)`);
    }
    lines.push('');

    if (metrics.analysis && metrics.analysis.risk) {
      const risk = metrics.analysis.risk;
      lines.push(`🛡️ ANALIZA RYZYKA (Poziom: ${risk.level})`);
      lines.push(`Wskaźnik ryzyka: ${risk.score}/100`);
      if (risk.factors && risk.factors.length) {
        lines.push('Główne czynniki ryzyka:');
        risk.factors.forEach(f => lines.push(`• ${f}`));
      }
      lines.push('');
    }

    if (metrics.evaluation && Array.isArray(metrics.evaluation.recommendations) && metrics.evaluation.recommendations.length > 0) {
      lines.push('💡 REKOMENDACJE OPTYMALIZACYJNE');
      metrics.evaluation.recommendations.forEach((rec, i) => {
        const p = rec.priority === 'CRITICAL' ? '🔴' : rec.priority === 'HIGH' ? '🟠' : '🟢';
        lines.push(`${i + 1}. ${p} ${rec.category}`);
        lines.push(`   Akcja: ${rec.action}`);
        if (rec.expectedImpact) lines.push(`   Oczekiwany efekt: ${rec.expectedImpact}`);
        lines.push('');
      });
    }

    lines.push('═'.repeat(70));
    lines.push('📞 LUKO ANALYZER V6.0 - Kompleksowa analiza Amazon Ads');
    lines.push('🔗 Więcej informacji: sprawdź arkusze Full Analysis i Snapshot');
    return lines;
  }

  // KLUCZOWA ZMIANA: Marża = break-even%, nie 15%
  calculateBasicProfitability(t) {
    const marginPercent = this.acosSettings.breakEven / 100;
    const estimatedMargin = t.sales * marginPercent;
    const profitLoss = estimatedMargin - t.spend;
    const marginToBreakEven = this.acosSettings.breakEven - t.acos;
    return { estimatedMargin, profitLoss, marginToBreakEven };
  }

  writeReport(sheet, reportLines) {
    sheet.getRange(1, 1).setValue(reportLines[0]);
    sheet.getRange(1, 1).setFontWeight('bold').setFontSize(14)
      .setBackground('#1a73e8').setFontColor('white');
    sheet.getRange(1, 1, 1, 3).merge();

    reportLines.slice(1).forEach((line, idx) => {
      const row = idx + 2;
      sheet.getRange(row, 1).setValue(line);
      if (line.includes('═')) {
        sheet.getRange(row, 1).setFontWeight('bold').setBackground('#e0e0e0');
      } else if (/[📊📈💰🏆⚠️💡🎯🛡️]/.test(line)) {
        sheet.getRange(row, 1).setFontWeight('bold').setBackground('#f0f8ff');
      } else if (line.includes('✅')) {
        sheet.getRange(row, 1).setBackground('#e8f5e8');
      } else if (line.includes('❌')) {
        sheet.getRange(row, 1).setBackground('#fce8e6');
      } else if (line.includes('🔴')) {
        sheet.getRange(row, 1).setBackground('#ffeaa7');
      }
    });

    sheet.autoResizeColumn(1);
    if (sheet.getColumnWidth(1) < 800) sheet.setColumnWidth(1, 800);

    const lastRow = sheet.getLastRow();
    if (lastRow > 0) {
      sheet.getRange(1, 1, lastRow, 1).setBorder(
        true, true, true, true, false, false, 
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
    if (acos <= this.acosSettings.low) return 'EXCELLENT';
    if (acos <= this.acosSettings.breakEven) return 'GOOD';
    if (acos <= this.acosSettings.high) return 'WARNING';
    return 'CRITICAL';
  }
  
  getAcosEmoji(acos) {
    const s = this.evaluateAcos(acos);
    return s === 'EXCELLENT' ? '🟢' : s === 'GOOD' ? '🟡' : s === 'WARNING' ? '🟠' : '🔴';
  }
  
  getStatusIcon(status) {
    return status === 'EXCELLENT' ? '🟢 ŚWIETNY'
      : status === 'GOOD' ? '🟡 DOBRY'
      : status === 'WARNING' ? '🟠 UWAGA'
      : '🔴 KRYTYCZNY';
  }
}
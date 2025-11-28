// ===== 00-TARGETANALYSISRULES.JS - WSPÓLNE ZASADY ANALIZY =====
// Wersja: 1.0
// Ten moduł definiuje SPÓJNE zasady analizy targetów
// używane zarówno przez FullAnalyzer jak i BulkAnalyzer
//
// WAŻNE: Ten plik musi być załadowany PRZED innymi plikami (stąd 00- w nazwie)

/**
 * Wspólne zasady analizy targetów
 */
const TargetAnalysisRules = {

  // ============================================
  // PROGI ACOS (używane wszędzie tak samo)
  // ============================================

  getAcosThresholds: function() {
    const settings = typeof getAcosSettings === 'function' ? getAcosSettings() : { breakEven: 25, low: 12.5, high: 40 };

    return {
      breakEven: settings.breakEven,
      low: settings.low || settings.breakEven * 0.5,      // Bardzo dobry ACOS
      high: settings.high || settings.breakEven * 1.67,   // Wysoki ACOS
      critical: settings.breakEven * 2                     // Krytyczny (2x BE)
    };
  },

  // ============================================
  // KLASYFIKACJA TARGETU (wspólna logika)
  // ============================================

  /**
   * Klasyfikuj target według wspólnych zasad
   * @param {Object} target - dane targetu
   * @returns {Object} - klasyfikacja z action, reason, autoSelect, color, etc.
   */
  classifyTarget: function(target) {
    const thresholds = this.getAcosThresholds();

    const clicks = parseFloat(target.clicks) || 0;
    const spend = parseFloat(target.spend) || 0;
    const sales = parseFloat(target.sales) || 0;
    const orders = parseFloat(target.orders) || 0;
    const acos = sales > 0 ? (spend / sales * 100) : 0;
    const impressions = parseFloat(target.impressions) || 0;

    // ==========================================
    // PRIORYTET 1: KOSZTOWNE BEZ SPRZEDAŻY
    // ==========================================
    if (clicks > 0 && orders === 0 && sales === 0) {

      // KRYTYCZNE: wysokie wydatki/kliknięcia bez sprzedaży
      if (spend >= 50 || clicks >= 50) {
        return {
          status: 'CRITICAL',
          statusText: '🔴 KRYTYCZNY',
          action: 'PAUSE',
          reason: `🚨 KRYTYCZNE: ${clicks} kliknięć, ${spend.toFixed(2)}€ wydane, 0 zamówień`,
          confidence: 0.95,
          autoSelect: true,
          color: '#ff0000',
          classification: 'PAUSE_CRITICAL'
        };
      }

      // PILNE: przekroczone progi
      if (clicks >= 10 || spend >= 5) {
        return {
          status: 'URGENT',
          statusText: '🔴 PILNE',
          action: 'PAUSE',
          reason: `⚠️ ${clicks} kliknięć, ${spend.toFixed(2)}€ wydane, 0 zamówień`,
          confidence: 0.90,
          autoSelect: true,
          color: '#ff4444',
          classification: 'PAUSE_URGENT'
        };
      }

      // NORMALNE: mniej wydatków ale wciąż bez sprzedaży
      if (clicks >= 5 || spend >= 3) {
        return {
          status: 'WARNING',
          statusText: '🟠 UWAGA',
          action: 'PAUSE',
          reason: `${clicks} kliknięć, ${spend.toFixed(2)}€, 0 zamówień - nieefektywny`,
          confidence: 0.75,
          autoSelect: true,
          color: '#ff8888',
          classification: 'PAUSE_NORMAL'
        };
      }

      // ZA MAŁO DANYCH
      if (clicks >= 3) {
        return {
          status: 'MONITOR',
          statusText: '👁️ MONITORUJ',
          action: 'MONITOR',
          reason: `${clicks} kliknięć, ${spend.toFixed(2)}€, 0 zamówień - monitoruj`,
          confidence: 0.60,
          autoSelect: false,
          color: '#ffeeba',
          classification: 'MONITOR'
        };
      }
    }

    // ==========================================
    // PRIORYTET 2: BARDZO WYSOKI ACOS (>2×BE)
    // ==========================================
    if (acos > thresholds.critical && sales > 0) {
      return {
        status: 'CRITICAL',
        statusText: '🔴 KRYTYCZNY',
        action: 'DECREASE_BID',
        change: '-30',
        reason: `ACOS ${acos.toFixed(1)}% > 2×BE (${thresholds.breakEven}%) - duże straty`,
        confidence: 0.90,
        autoSelect: true,
        color: '#ff9900',
        classification: 'DECREASE_BID_HIGH'
      };
    }

    // ==========================================
    // PRIORYTET 3: WYSOKI ACOS (BE do 2×BE)
    // ==========================================
    if (acos > thresholds.breakEven && sales > 0) {
      const shouldAutoSelect = acos > thresholds.breakEven * 1.5 || spend > 10;
      return {
        status: 'WARNING',
        statusText: '🟠 UWAGA',
        action: 'DECREASE_BID',
        change: '-20',
        reason: `ACOS ${acos.toFixed(1)}% > BE ${thresholds.breakEven}% - obniż stawkę`,
        confidence: 0.80,
        autoSelect: shouldAutoSelect,
        color: '#ffcc00',
        classification: 'DECREASE_BID_MEDIUM'
      };
    }

    // ==========================================
    // PRIORYTET 4: BARDZO NISKI ACOS (<0.5×BE) - SKALUJ!
    // ==========================================
    if (acos > 0 && acos < thresholds.low && sales >= 5 && orders >= 1) {
      return {
        status: 'EXCELLENT',
        statusText: '🟢 DOSKONAŁY',
        action: 'INCREASE_BID',
        change: '+25',
        reason: `ACOS ${acos.toFixed(1)}% < ${thresholds.low}% - zwiększ widoczność!`,
        confidence: 0.85,
        autoSelect: true,
        color: '#00cc66',
        classification: 'INCREASE_BID_HIGH'
      };
    }

    // ==========================================
    // PRIORYTET 5: NISKI ACOS - umiarkowane skalowanie
    // ==========================================
    if (acos > 0 && acos < thresholds.breakEven * 0.8 && sales >= 10) {
      return {
        status: 'GOOD',
        statusText: '🟡 DOBRY',
        action: 'INCREASE_BID',
        change: '+15',
        reason: `ACOS ${acos.toFixed(1)}% - dobry wynik, można skalować`,
        confidence: 0.75,
        autoSelect: false,
        color: '#99cc00',
        classification: 'INCREASE_BID_MEDIUM'
      };
    }

    // ==========================================
    // PRIORYTET 6: BRAK WYŚWIETLEŃ - potrzebuje widoczności
    // ==========================================
    if (impressions === 0 && clicks === 0) {
      return {
        status: 'NEEDS_VISIBILITY',
        statusText: '🔵 WIDOCZNOŚĆ',
        action: 'INCREASE_BID',
        change: '+50',
        reason: 'Brak wyświetleń - stawka prawdopodobnie za niska',
        confidence: 0.70,
        autoSelect: false,
        color: '#66ccff',
        classification: 'INCREASE_BID_VISIBILITY'
      };
    }

    // ==========================================
    // PRIORYTET 7: OK - w normie
    // ==========================================
    if (acos > 0 && acos <= thresholds.breakEven) {
      return {
        status: 'OK',
        statusText: '✅ OK',
        action: 'MAINTAIN',
        reason: `ACOS ${acos.toFixed(1)}% ≤ BE ${thresholds.breakEven}% - utrzymaj`,
        confidence: 0.70,
        autoSelect: false,
        color: '#ccffcc',
        classification: 'MAINTAIN'
      };
    }

    // ==========================================
    // DOMYŚLNIE: MONITORUJ
    // ==========================================
    return {
      status: 'MONITOR',
      statusText: '👁️ MONITORUJ',
      action: 'MONITOR',
      reason: 'Za mało danych do jednoznacznej oceny',
      confidence: 0.50,
      autoSelect: false,
      color: '#f5f5f5',
      classification: 'MONITOR'
    };
  },

  // ============================================
  // OCENA ACOS (dla raportów - FullAnalyzer)
  // ============================================

  evaluateAcos: function(acos) {
    const thresholds = this.getAcosThresholds();

    if (acos <= thresholds.low) return '🟢 DOSKONAŁY';
    if (acos <= thresholds.breakEven) return '🟡 DOBRY';
    if (acos <= thresholds.high) return '🟠 UWAGA';
    return '🔴 KRYTYCZNY';
  },

  // ============================================
  // PODSUMOWANIE TARGETÓW (dla raportów)
  // ============================================

  summarizeTargets: function(targets) {
    const thresholds = this.getAcosThresholds();

    const summary = {
      total: targets.length,
      zeroSales: 0,
      zeroSalesSpend: 0,
      excellent: 0,      // ACOS < low
      good: 0,           // ACOS <= BE
      warning: 0,        // ACOS <= high
      critical: 0,       // ACOS > high
      excellentSales: 0,
      goodSales: 0,
      warningSales: 0,
      criticalSales: 0
    };

    targets.forEach(t => {
      const sales = parseFloat(t.sales) || 0;
      const spend = parseFloat(t.spend) || 0;
      const acos = sales > 0 ? (spend / sales * 100) : 0;

      if (sales === 0 && spend > 0) {
        summary.zeroSales++;
        summary.zeroSalesSpend += spend;
      } else if (acos <= thresholds.low) {
        summary.excellent++;
        summary.excellentSales += sales;
      } else if (acos <= thresholds.breakEven) {
        summary.good++;
        summary.goodSales += sales;
      } else if (acos <= thresholds.high) {
        summary.warning++;
        summary.warningSales += sales;
      } else {
        summary.critical++;
        summary.criticalSales += sales;
      }
    });

    return summary;
  }
};

// Eksportuj jako globalną funkcję (dla kompatybilności)
function getTargetClassification(target) {
  return TargetAnalysisRules.classifyTarget(target);
}

function evaluateTargetAcos(acos) {
  return TargetAnalysisRules.evaluateAcos(acos);
}
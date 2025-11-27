// ===== 14-BULKANALYZER.JS - KOMPLEKSOWA ANALIZA TARGETÓW =====
// Wersja: 3.4 FIXED - Naprawiona auto-selekcja i progi
// Autor: LUKO AI
// Data: 2025-11-27
//
// ZMIANY W V3.4 (2025-11-27):
// - Obniżone progi: minClicksForPause=10 (z 30), minSpendForPause=5 (z 10)
// - Auto-select dla 5+ kliknięć bez sprzedaży (wcześniej 10+)
// - Toast zamykany po zakończeniu analizy
// - Lepsze zamykanie toastów przed podsumowaniem
//
// ZMIANY W V3.3 (2024-11-27):
// - PAUSE_NORMAL: autoSelect: true (wcześniej false) - targety z 10+ kliknięć/5€+ bez sprzedaży są automatycznie zaznaczane
// - DECREASE_BID_MEDIUM: autoSelect gdy ACOS > 1.5×BE lub spend > 10€ (wcześniej tylko spend > 20)
// - INCREASE_BID_HIGH: obniżone progi z sales >= 20 na >= 5 i orders >= 3 na >= 1
//
// ZMIANY W V2.1 (FIXED):
// 1. 0 kliknięć → INCREASE_BID zamiast MONITOR (target potrzebuje widoczności)
// 2. Ulepszona detekcja kosztownych targetów bez sprzedaży (clicks>0, sales=0)
// 3. Zachowana cała oryginalna funkcjonalność

/**
 * BulkAnalyzer - Szczegółowa analiza targetów z automatycznym zaznaczaniem
 * i kolorowaniem według priorytetów
 */
class BulkAnalyzer {
  constructor() {
    // Weryfikacja licencji
    this.verifyLicense();

    this.ss = SpreadsheetApp.getActiveSpreadsheet();
    this.logger = new LukoLogger();
    this.parser = universalParser;
    this.acosSettings = getAcosSettings();

    // Progi domyślne - FIX V3.4: Obniżone dla lepszej auto-selekcji
    this.thresholds = {
      minClicksForPause: 10,     // Obniżone z 30 - targety z 10+ kliknięć bez sprzedaży
      minSpendForPause: 5,       // Obniżone z 10€ - targety z 5€+ bez sprzedaży
      minClicksForAnalysis: 3,   // Obniżone z 5
      minSpendForAnalysis: 0.5   // Obniżone z 1€
    };

    // Kolory dla różnych akcji (z odcieniami)
    this.colors = {
      PAUSE_CRITICAL: '#ff0000',      // Ciemny czerwony - pilne
      PAUSE_URGENT: '#ff4444',        // Średni czerwony
      PAUSE_NORMAL: '#ff8888',        // Jasny czerwony
      DECREASE_BID_HIGH: '#ff9900',   // Ciemny pomarańczowy
      DECREASE_BID_MEDIUM: '#ffbb33', // Średni pomarańczowy
      DECREASE_BID_LOW: '#ffdd88',    // Jasny pomarańczowy
      INCREASE_BID_HIGH: '#00cc00',   // Ciemny zielony
      INCREASE_BID_MEDIUM: '#44dd44', // Średni zielony
      INCREASE_BID_LOW: '#88ee88',    // Jasny zielony
      ADD_NEGATIVE: '#ff6666',        // Czerwonawy
      MONITOR: '#f0f0f0',             // Szary
      MAINTAIN: '#e8f4f8',            // Niebieski
      // FIXED: Nowe kolory dla 0 kliknięć
      NO_VISIBILITY: '#99ccff',       // Niebieski - brak widoczności
      LOW_VISIBILITY: '#cce5ff'       // Jasny niebieski - niska widoczność
    };
  }

  /**
   * Weryfikacja licencji
   */
  verifyLicense() {
    const apiKey = PropertiesService.getUserProperties().getProperty('LUKO_API_KEY');
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('Brak klucza API - ustaw przez menu LUKO → Ustawienia → Ustaw klucz API');
    }
  }

  /**
   * GŁÓWNA FUNKCJA - Bezpośrednia analiza (bez dialogu)
   * Dialog usunięty - ustawienia pytane są przy mapowaniu
   */
  runAnalysis() {
    try {
      this.logger.log('=== BULK ANALYZER START ===', 'INFO');
      this.logger.log(`Progi: ${this.thresholds.minClicksForPause} kliknięć, ${this.thresholds.minSpendForPause}€`, 'INFO');

      // Uruchom analizę bezpośrednio
      return this.analyze();

    } catch (error) {
      this.logger.log(`BŁĄD: ${error.toString()}`, 'ERROR');

      SpreadsheetApp.getUi().alert(
        '❌ Błąd analizy',
        error.toString(),
        SpreadsheetApp.getUi().ButtonSet.OK
      );

      throw error;
    }
  }

  // Dialog usunięty - ustawienia są pytane przy mapowaniu
  // Zostawiam stub dla kompatybilności wstecznej
  runAnalysisWithDialog() {
    return this.runAnalysis();
  }

  /**
   * USUNIĘTY DIALOG - teraz nie potrzebny
   * Ustawienia są pytane przy mapowaniu (BulkMapper)
   */
  /*
  showAnalysisDialog() {
    // Dialog usunięty - analiza działa od razu z domyślnymi progami
  }
  */

  /**
   * Placeholder dla kompatybilności - nie używany
   */
  _legacyDialogCode() {
    // Stary kod dialogu - zachowany jako referencja
    const _unusedHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <base target="_top">
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              font-family: 'Google Sans', Roboto, Arial, sans-serif;
              padding: 24px;
              background: #f8f9fa;
            }

            .container {
              background: white;
              border-radius: 12px;
              padding: 24px;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
              max-width: 500px;
            }

            h2 {
              color: #1a73e8;
              margin-bottom: 8px;
              font-size: 20px;
            }

            .subtitle {
              color: #5f6368;
              font-size: 14px;
              margin-bottom: 24px;
            }

            .info-box {
              background: #e8f0fe;
              padding: 16px;
              border-radius: 8px;
              margin-bottom: 24px;
              border-left: 4px solid #1a73e8;
            }

            .info-box strong {
              display: block;
              margin-bottom: 8px;
              color: #1557b0;
            }

            .info-box ul {
              margin: 0;
              padding-left: 20px;
              color: #174ea6;
              font-size: 13px;
              line-height: 1.6;
            }

            .setting {
              margin-bottom: 20px;
            }

            label {
              display: block;
              margin-bottom: 8px;
              font-weight: 600;
              color: #1f1f1f;
            }

            input[type="number"] {
              width: 100%;
              padding: 12px;
              border: 2px solid #e8eaed;
              border-radius: 8px;
              font-size: 14px;
            }

            input[type="number"]:focus {
              outline: none;
              border-color: #1a73e8;
              background: #f1f7ff;
            }

            .helper-text {
              font-size: 12px;
              color: #5f6368;
              margin-top: 4px;
            }

            .buttons {
              display: flex;
              gap: 12px;
              margin-top: 24px;
            }

            button {
              padding: 12px 24px;
              border: none;
              border-radius: 8px;
              cursor: pointer;
              font-size: 14px;
              font-weight: 600;
              flex: 1;
              transition: all 0.2s;
            }

            .btn-primary {
              background: #1a73e8;
              color: white;
            }

            .btn-primary:hover {
              background: #1557b0;
              box-shadow: 0 2px 8px rgba(26, 115, 232, 0.3);
            }

            .btn-secondary {
              background: white;
              color: #5f6368;
              border: 2px solid #e8eaed;
            }

            .btn-secondary:hover {
              background: #f8f9fa;
              border-color: #dadce0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>🔍 Analiza BULK - Ustawienia</h2>
            <div class="subtitle">Określ progi dla wykrywania problemowych targetów</div>

            <div class="info-box">
              <strong>💡 Co będzie analizowane:</strong>
              <ul>
                <li>Targety bez sprzedaży (do pauzowania)</li>
                <li>Targety z wysokim ACOS (do obniżenia stawek)</li>
                <li>Targety z niskim ACOS (do zwiększenia stawek)</li>
                <li>Targety z 0 kliknięciami (do zwiększenia widoczności)</li>
                <li>Targety do dodania jako negatywy</li>
                <li>Kampanie do optymalizacji budżetu</li>
              </ul>
            </div>

            <div class="setting">
              <label for="minClicks">
                Minimum kliknięć (targety bez sprzedaży):
              </label>
              <input type="number" id="minClicks" value="30" min="5" max="100" step="1">
              <div class="helper-text">
                Targety z większą liczbą kliknięć i bez sprzedaży będą oznaczone do pauzy
              </div>
            </div>

            <div class="setting">
              <label for="minSpend">
                Minimum wydatków € (targety bez sprzedaży):
              </label>
              <input type="number" id="minSpend" value="10" min="1" max="100" step="0.5">
              <div class="helper-text">
                Targety z większymi wydatkami i bez sprzedaży będą priorytetowo oznaczone
              </div>
            </div>

            <div class="buttons">
              <button class="btn-primary" onclick="startAnalysis()">
                🚀 Rozpocznij analizę
              </button>
              <button class="btn-secondary" onclick="google.script.host.close()">
                Anuluj
              </button>
            </div>
          </div>

          <script>
            function startAnalysis() {
              const minClicks = parseInt(document.getElementById('minClicks').value);
              const minSpend = parseFloat(document.getElementById('minSpend').value);

              if (isNaN(minClicks) || isNaN(minSpend)) {
                alert('❌ Wprowadź poprawne wartości');
                return;
              }

              if (minClicks < 5 || minSpend < 1) {
                alert('⚠️ Wartości są bardzo niskie. Czy na pewno chcesz kontynuować?');
              }

              google.script.run
                .withSuccessHandler(() => {
                  google.script.host.close();
                })
                .withFailureHandler(error => {
                  alert('❌ Błąd: ' + error);
                })
                .runAnalysisWithSettings({
                  minClicks: minClicks,
                  minSpend: minSpend
                });
            }
          </script>
        </body>
      </html>
    `;
    // Koniec legacy kodu - nie używany
  }

  /**
   * GŁÓWNA FUNKCJA ANALIZY
   */
  analyze() {
    const startTime = Date.now();

    try {
      this.ss.toast('Rozpoczynam analizę BULK...', 'LUKO', -1);

      this.logger.log('=== BULK ANALYZER START ===', 'INFO');
      this.logger.log(`Progi: ${this.thresholds.minClicksForPause} kliknięć, ${this.thresholds.minSpendForPause}€`, 'INFO');

      // Pobierz arkusz
      const builderSheet = this.ss.getSheetByName('BULK_Builder');
      if (!builderSheet || builderSheet.getLastRow() < 2) {
        throw new Error('Brak danych w BULK_Builder - uruchom najpierw mapowanie');
      }

      const allData = builderSheet.getDataRange().getValues();
      const headers = allData[0];
      const columns = this.mapColumns(headers);

      this.logger.log(`Analizuję ${allData.length - 1} wierszy...`, 'INFO');

      // Sprawdź czy są rekomendacje z Full Analysis
      const fullAnalysisRecs = this.getFullAnalysisRecommendations();
      if (fullAnalysisRecs.length > 0) {
        this.logger.log(`Znaleziono ${fullAnalysisRecs.length} rekomendacji z Full Analysis`, 'INFO');
      }

      // Statystyki
      const stats = {
        processed: 0,
        analyzed: 0,
        autoSelected: 0,
        fromFullAnalysis: 0,
        classifications: {
          PAUSE_CRITICAL: 0,
          PAUSE_URGENT: 0,
          PAUSE_NORMAL: 0,
          DECREASE_BID_HIGH: 0,
          DECREASE_BID_MEDIUM: 0,
          DECREASE_BID_LOW: 0,
          INCREASE_BID_HIGH: 0,
          INCREASE_BID_MEDIUM: 0,
          INCREASE_BID_LOW: 0,
          // FIXED: Nowe klasyfikacje dla 0 kliknięć
          INCREASE_VISIBILITY: 0,
          ADD_NEGATIVE: 0,
          MONITOR: 0,
          MAINTAIN: 0
        }
      };

      // Przetwarzanie danych - WSZYSTKIE wiersze
      for (let i = 1; i < allData.length; i++) {
        const row = allData[i];
        const entity = row[columns.entity] || '';

        stats.processed++;

        // ZMIANA: Analizujemy WSZYSTKIE typy entity
        // Tylko pomijamy Product Ads (nie mają metryk do analizy)
        if (entity === 'Product Ad' || entity === 'Ad') {
          // Dla Product Ads - ustaw status bez analizy
          allData[i][columns.action] = 'SKIP';
          allData[i][columns.reason] = 'Product Ad - brak metryk do analizy';
          allData[i][columns.status] = 'Pominięto';
          continue;
        }

        // USUNIĘTO filtr: if (entity !== 'Keyword' && entity !== 'Product Targeting') continue;
        // Teraz analizujemy Campaign, Ad Group, Keyword, Product Targeting - WSZYSTKO

        const campaignName = row[columns.campaignName] || '';
        const adGroupName = row[columns.adGroupName] || '';
        const keywordText = row[columns.keywordText] || '';

        // Sprawdź czy jest rekomendacja z Full Analysis
        const fullAnalysisMatch = this.findFullAnalysisMatch(
          fullAnalysisRecs,
          campaignName,
          adGroupName,
          keywordText
        );

        let classification;

        if (fullAnalysisMatch) {
          // Użyj rekomendacji z Full Analysis
          classification = {
            action: fullAnalysisMatch.action,
            reason: `📊 Full Analysis: ${fullAnalysisMatch.reason}`,
            change: fullAnalysisMatch.change,
            confidence: 0.95,
            urgency: 'HIGH',
            autoSelect: true,
            color: this.getColorForAction(fullAnalysisMatch.action, 'HIGH'),
            classification: 'FROM_FULL_ANALYSIS'
          };
          stats.fromFullAnalysis++;
        } else {
          // Standardowa klasyfikacja
          classification = this.classifyTarget(row, columns);
        }

        // FIXED: Zastosuj klasyfikację - zmieniono próg z 0.5 na 0.1 aby analizować WSZYSTKIE
        // Każdy target z jakąkolwiek klasyfikacją powinien być liczony
        if (classification && classification.confidence >= 0.1) {
          allData[i][columns.action] = classification.action;
          allData[i][columns.reason] = classification.reason;
          allData[i][columns.confidence] = classification.confidence;
          allData[i][columns.source] = classification.source || 'ANALYZED';
          allData[i][columns.status] = 'Gotowe do przeglądu';

          if (classification.change) {
            allData[i][columns.percentValue] = classification.change;
          }

          // KLUCZOWE: Automatyczne zaznaczanie
          if (classification.autoSelect) {
            allData[i][columns.apply] = true;
            stats.autoSelected++;
          }

          // Statystyki klasyfikacji
          if (stats.classifications[classification.classification] !== undefined) {
            stats.classifications[classification.classification]++;
          }

          stats.analyzed++;
        }
      }

      // Zapisz wyniki - BATCH
      this.logger.log('Zapisuję wyniki analizy...', 'INFO');
      builderSheet.getRange(1, 1, allData.length, headers.length).setValues(allData);
      SpreadsheetApp.flush();

      // Kolorowanie
      this.logger.log('Stosuję kolorowanie...', 'INFO');
      this.applyColorCoding(builderSheet, allData, columns);

      // Podsumowanie
      const elapsed = Math.round((Date.now() - startTime) / 1000);

      this.logger.log('=== ANALIZA ZAKOŃCZONA ===', 'SUCCESS');
      this.logger.log(`✅ Przeanalizowano: ${stats.analyzed} targetów w ${elapsed}s`, 'SUCCESS');
      this.logger.log(`📊 Z Full Analysis: ${stats.fromFullAnalysis}`, 'INFO');
      this.logger.log(`✅ Automatycznie zaznaczono: ${stats.autoSelected}`, 'INFO');

      // FIX V3.4: Zamknij WSZYSTKIE toasty przed pokazaniem podsumowania
      try {
        this.ss.toast('', '', 0);  // Zamknij stary toast
      } catch(e) { /* ignore */ }

      // Pokaż szczegółowe podsumowanie
      this.showDetailedSummary(stats, elapsed);

      // FIX V3.4: Zamknij toast ponownie po pokazaniu podsumowania (na wszelki wypadek)
      Utilities.sleep(100);
      try {
        this.ss.toast('', '', 0);
      } catch(e) { /* ignore */ }

      return {
        success: true,
        stats: stats,
        time: elapsed
      };

    } catch (error) {
      this.logger.log(`BŁĄD: ${error.toString()}`, 'ERROR');
      throw error;
    }
  }

  /**
   * KLASYFIKACJA TARGETU - Szczegółowa z wyjaśnieniami
   * FIXED: Dodana logika dla 0 kliknięć i ulepszona detekcja kosztownych targetów
   */
  classifyTarget(row, columns) {
    // ZMIANA: Pobierz typ entity
    const entity = (row[columns.entity] || '').toString();

    // Parsuj metryki
    const clicks = this.parser.parseNumber(row[columns.clicks]);
    const spend = this.parser.parseNumber(row[columns.spend]);
    const sales = this.parser.parseNumber(row[columns.sales]);
    const orders = this.parser.parseNumber(row[columns.orders]);
    let acos = this.parser.parseNumber(row[columns.acos]);
    const impressions = this.parser.parseNumber(row[columns.impressions]);
    const cpc = this.parser.parseNumber(row[columns.cpc]);
    const matchType = (row[columns.matchType] || '').toLowerCase();

    // ZMIANA: Obsługa Campaign i Ad Group
    if (entity === 'Campaign') {
      return this.classifyCampaign(clicks, spend, sales, orders, acos, impressions);
    }
    if (entity === 'Ad Group') {
      return this.classifyAdGroup(clicks, spend, sales, orders, acos, impressions);
    }

    // Normalizuj ACOS (jeśli 0.25 → 25%)
    if (acos > 0 && acos < 2) {
      acos = acos * 100;
    }

    // Oblicz dodatkowe metryki
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    const convRate = clicks > 0 ? (orders / clicks) * 100 : 0;

    // Progi ACOS
    const breakEven = this.acosSettings.breakEven;
    const lowAcos = breakEven * 0.5;
    const highAcos = breakEven * 2;

    // ========================================
    // KLASYFIKACJA WEDŁUG PRIORYTETÓW
    // ========================================

    // === FIXED: NOWY PRIORYTET 0 - ZERO KLIKNIĘĆ ===
    // Targety bez kliknięć NIE powinny być pauzowane!
    // Potrzebują zwiększenia widoczności (wyższa stawka)
    if (clicks === 0) {
      if (impressions === 0) {
        // Całkowity brak widoczności - zdecydowanie zwiększ stawkę
        return {
          action: 'INCREASE_BID',
          reason: `🔵 BRAK WIDOCZNOŚCI: 0 wyświetleń, 0 kliknięć - stawka zbyt niska, zwiększ o 50%+`,
          change: '+50',
          confidence: 0.85,
          urgency: 'HIGH',
          autoSelect: false, // Nie auto-zaznaczaj - niech user zdecyduje
          color: this.colors.NO_VISIBILITY,
          classification: 'INCREASE_VISIBILITY',
          source: 'ANALYZED'
        };
      } else if (impressions > 0 && impressions < 100) {
        // Mało wyświetleń, 0 kliknięć - zwiększ stawkę
        return {
          action: 'INCREASE_BID',
          reason: `🔵 Niska widoczność: ${impressions} wyświetleń, 0 kliknięć - zwiększ stawkę o 30%`,
          change: '+30',
          confidence: 0.75,
          urgency: 'MEDIUM',
          autoSelect: false,
          color: this.colors.LOW_VISIBILITY,
          classification: 'INCREASE_VISIBILITY',
          source: 'ANALYZED'
        };
      } else if (impressions >= 100 && impressions < 500) {
        // Średnio wyświetleń, 0 kliknięć - może problem z listingiem
        return {
          action: 'INCREASE_BID',
          reason: `${impressions} wyświetleń, 0 kliknięć - zwiększ stawkę o 20% lub sprawdź listing`,
          change: '+20',
          confidence: 0.70,
          urgency: 'LOW',
          autoSelect: false,
          color: this.colors.LOW_VISIBILITY,
          classification: 'INCREASE_BID_LOW',
          source: 'ANALYZED'
        };
      } else {
        // Dużo wyświetleń, 0 kliknięć - CTR problem, nie stawka
        return {
          action: 'MONITOR',
          reason: `⚠️ ${impressions} wyświetleń, 0 kliknięć - niski CTR, sprawdź listing/cenę`,
          confidence: 0.70,
          urgency: 'LOW',
          autoSelect: false,
          color: this.colors.MONITOR,
          classification: 'MONITOR',
          source: 'ANALYZED'
        };
      }
    }

    // === FIXED: PRIORYTET 1 - KOSZTOWNE BEZ SPRZEDAŻY (clicks > 0, sales = 0) ===
    // To jest KLUCZOWA zmiana - wykrywanie targetów które kosztują ale nie sprzedają
    if (clicks > 0 && orders === 0 && sales === 0) {
      // Krytyczne - wysokie wydatki
      if (spend >= 50 || clicks >= 50) {
        return {
          action: 'PAUSE',
          reason: `🚨 KRYTYCZNE: ${clicks} kliknięć, ${spend.toFixed(2)}€ wydane, 0 zamówień - natychmiastowa pauza zalecana`,
          confidence: 0.95,
          urgency: 'CRITICAL',
          autoSelect: true,
          color: this.colors.PAUSE_CRITICAL,
          classification: 'PAUSE_CRITICAL',
          source: 'ANALYZED'
        };
      }

      // Pilne - powyżej progów użytkownika
      if (clicks >= this.thresholds.minClicksForPause || spend >= this.thresholds.minSpendForPause) {
        return {
          action: 'PAUSE',
          reason: `⚠️ PILNE: ${clicks} kliknięć (próg: ${this.thresholds.minClicksForPause}), ${spend.toFixed(2)}€ (próg: ${this.thresholds.minSpendForPause}€), 0 zamówień - zalecana pauza`,
          confidence: 0.90,
          urgency: 'HIGH',
          autoSelect: true,
          color: this.colors.PAUSE_URGENT,
          classification: 'PAUSE_URGENT',
          source: 'ANALYZED'
        };
      }

      // FIX V3.4: KAŻDY target z 5+ kliknięć i 0 sprzedaży powinien być auto-zaznaczony!
      // To jest główna funkcja optymalizacji - zatrzymaj straty
      if (clicks >= 5 || spend >= 3) {
        return {
          action: 'PAUSE',
          reason: `⚠️ ${clicks} kliknięć, ${spend.toFixed(2)}€ wydane, 0 zamówień - target nieefektywny, zalecana pauza`,
          confidence: 0.75,
          urgency: 'MEDIUM',
          autoSelect: true,  // FIX V3.4: ZAWSZE zaznaczaj targety 5+ clicks bez sprzedaży
          color: this.colors.PAUSE_NORMAL,
          classification: 'PAUSE_NORMAL',
          source: 'ANALYZED'
        };
      }

      // FIX V3.4: Nawet 3+ kliknięć bez sprzedaży - sugeruj pauzę (ale nie auto-select)
      if (clicks >= 3) {
        return {
          action: 'PAUSE',
          reason: `${clicks} kliknięć, ${spend.toFixed(2)}€, 0 zamówień - rozważ pauzę`,
          confidence: 0.60,
          urgency: 'LOW',
          autoSelect: false,  // Nie auto-select, ale sugeruj pauzę
          color: this.colors.PAUSE_NORMAL,
          classification: 'PAUSE_NORMAL',
          source: 'ANALYZED'
        };
      }
    }

    // === 2. BARDZO WYSOKI ACOS (>2×BE) ===
    if (acos > highAcos && sales > 0) {
      const acosRatio = (acos / breakEven).toFixed(1);
      return {
        action: 'DECREASE_BID',
        reason: `🔴 Bardzo wysoki ACOS ${acos.toFixed(1)}% (${acosRatio}× Break-Even ${breakEven}%) - znaczne straty. Sprzedaż: ${sales.toFixed(2)}€, Koszt: ${spend.toFixed(2)}€. Obniż stawkę o 30%`,
        change: '-30',
        confidence: 0.90,
        urgency: 'HIGH',
        autoSelect: true,
        color: this.colors.DECREASE_BID_HIGH,
        classification: 'DECREASE_BID_HIGH',
        source: 'ANALYZED'
      };
    }

    // === 3. WYSOKI ACOS (BE do 2×BE) ===
    // FIX V3.3: autoSelect jeśli ACOS > 1.5×BE (nie tylko spend > 20)
    if (acos > breakEven && acos <= highAcos && sales > 0) {
      const shouldAutoSelect = acos > breakEven * 1.5 || spend > 10;
      return {
        action: 'DECREASE_BID',
        reason: `🟠 Wysoki ACOS ${acos.toFixed(1)}% > Break-Even ${breakEven}% (różnica: ${(acos - breakEven).toFixed(1)}pp). Sprzedaż: ${sales.toFixed(2)}€, ale nieopłacalna. Obniż stawkę o 20%`,
        change: '-20',
        confidence: 0.80,
        urgency: 'MEDIUM',
        autoSelect: shouldAutoSelect,  // FIX: Zaznacz jeśli ACOS > 1.5×BE lub spend > 10€
        color: this.colors.DECREASE_BID_MEDIUM,
        classification: 'DECREASE_BID_MEDIUM',
        source: 'ANALYZED'
      };
    }

    // === 4. LEKKO POWYŻEJ BE ===
    if (acos > breakEven * 1.1 && acos <= breakEven * 1.3 && sales > 0) {
      return {
        action: 'DECREASE_BID',
        reason: `Lekko powyżej Break-Even: ACOS ${acos.toFixed(1)}% vs ${breakEven}%. Niewielka strata ${(acos - breakEven).toFixed(1)}pp. Lekka optymalizacja -10%`,
        change: '-10',
        confidence: 0.70,
        urgency: 'LOW',
        autoSelect: false,
        color: this.colors.DECREASE_BID_LOW,
        classification: 'DECREASE_BID_LOW',
        source: 'ANALYZED'
      };
    }

    // === 5. BARDZO NISKI ACOS - Możliwość skalowania ===
    // FIX V3.3: Obniżone progi z sales >= 20 na sales >= 5 i orders >= 3 na orders >= 1
    // Targety z bardzo niskim ACOS i jakąkolwiek sprzedażą powinny być skalowane
    if (acos > 0 && acos < lowAcos && sales >= 5 && orders >= 1) {
      return {
        action: 'INCREASE_BID',
        reason: `🟢 Bardzo zyskowny ACOS ${acos.toFixed(1)}% < ${lowAcos.toFixed(1)}% (0.5×BE). Sprzedaż: ${sales.toFixed(2)}€, ${orders} zamówień. Zwiększ widoczność +25%`,
        change: '+25',
        confidence: 0.85,
        urgency: 'MEDIUM',
        autoSelect: true,  // FIX: Zawsze auto-select dla bardzo zyskownych targetów
        color: this.colors.INCREASE_BID_HIGH,
        classification: 'INCREASE_BID_HIGH',
        source: 'ANALYZED'
      };
    }

    // === 6. NISKI ACOS - Umiarkowane skalowanie ===
    if (acos > 0 && acos >= lowAcos && acos < breakEven * 0.8 && sales >= 10) {
      return {
        action: 'INCREASE_BID',
        reason: `Zyskowny ACOS ${acos.toFixed(1)}% < ${breakEven}%. Sprzedaż: ${sales.toFixed(2)}€. Możliwość zwiększenia +15%`,
        change: '+15',
        confidence: 0.75,
        urgency: 'LOW',
        autoSelect: false,
        color: this.colors.INCREASE_BID_MEDIUM,
        classification: 'INCREASE_BID_MEDIUM',
        source: 'ANALYZED'
      };
    }

    // === 7. BROAD MATCH z wysokim ACOS - Negatywy ===
    if (matchType.includes('broad') && acos > breakEven * 1.5) {
      return {
        action: 'ADD_NEGATIVE',
        reason: `Broad match + wysoki ACOS ${acos.toFixed(1)}% - sprawdź search terms i dodaj negatywne słowa kluczowe`,
        confidence: 0.70,
        urgency: 'MEDIUM',
        autoSelect: false,
        color: this.colors.ADD_NEGATIVE,
        classification: 'ADD_NEGATIVE',
        source: 'ANALYZED'
      };
    }

    // === 8. Bardzo niskie CTR ===
    if (impressions > 1000 && ctr < 0.1) {
      return {
        action: 'PAUSE',
        reason: `Bardzo niskie CTR ${ctr.toFixed(3)}% przy ${impressions} wyświetleniach - niska trafność/relevance`,
        confidence: 0.65,
        urgency: 'LOW',
        autoSelect: false,
        color: this.colors.PAUSE_NORMAL,
        classification: 'PAUSE_NORMAL',
        source: 'ANALYZED'
      };
    }

    // === 9. Niska konwersja ===
    if (clicks > 50 && convRate < 1 && orders > 0) {
      return {
        action: 'DECREASE_BID',
        reason: `Niska konwersja ${convRate.toFixed(1)}% przy ${clicks} kliknięciach. Wysokie koszty na zamówienie. Obniż -15%`,
        change: '-15',
        confidence: 0.70,
        urgency: 'LOW',
        autoSelect: false,
        color: this.colors.DECREASE_BID_LOW,
        classification: 'DECREASE_BID_LOW',
        source: 'ANALYZED'
      };
    }

    // === 10. ACOS w strefie optymalnej ===
    if (acos >= breakEven * 0.8 && acos <= breakEven && orders > 0) {
      return {
        action: 'MAINTAIN',
        reason: `ACOS ${acos.toFixed(1)}% w optymalnym zakresie (80-100% BE). Sprzedaż: ${sales.toFixed(2)}€, ${orders} zamówień. Utrzymaj obecne ustawienia`,
        confidence: 0.80,
        urgency: 'LOW',
        autoSelect: false,
        color: this.colors.MAINTAIN,
        classification: 'MAINTAIN',
        source: 'ANALYZED'
      };
    }

    // === 11. Za mało danych (ale clicks > 0, obsłużone wcześniej dla clicks=0) ===
    if (clicks < 5 || spend < 1) {
      return {
        action: 'MONITOR',
        reason: `Za mało danych do analizy (${clicks} kliknięć, ${spend.toFixed(2)}€). Kontynuuj obserwację`,
        confidence: 0.30,
        urgency: 'LOW',
        autoSelect: false,
        color: this.colors.MONITOR,
        classification: 'MONITOR',
        source: 'ANALYZED'
      };
    }

    // === 12. Domyślnie - Monitor ===
    return {
      action: 'MONITOR',
      reason: `Target w normie - ${clicks} kliknięć, ${orders} zamówień, ACOS ${acos > 0 ? acos.toFixed(1) + '%' : 'N/A'}. Obserwuj`,
      confidence: 0.50,
      urgency: 'LOW',
      autoSelect: false,
      color: this.colors.MONITOR,
      classification: 'MONITOR',
      source: 'ANALYZED'
    };
  }

  /**
   * NOWE: Klasyfikacja Campaign
   */
  classifyCampaign(clicks, spend, sales, orders, acos, impressions) {
    const breakEven = this.acosSettings.breakEven;

    // Kampania bez danych
    if (impressions === 0 && clicks === 0) {
      return {
        action: 'MONITOR',
        reason: `📁 Kampania: brak danych (0 wyświetleń)`,
        confidence: 0.30,
        urgency: 'LOW',
        autoSelect: false,
        color: this.colors.MONITOR,
        classification: 'MONITOR',
        source: 'ANALYZED'
      };
    }

    // Kampania bez sprzedaży ale z wydatkami
    if (sales === 0 && spend > 0) {
      return {
        action: 'REVIEW',
        reason: `📁 Kampania: ${spend.toFixed(2)}€ wydane, 0 sprzedaży - sprawdź targety`,
        confidence: 0.70,
        urgency: spend > 50 ? 'HIGH' : 'MEDIUM',
        autoSelect: false,
        color: spend > 50 ? this.colors.PAUSE_URGENT : this.colors.PAUSE_NORMAL,
        classification: spend > 50 ? 'PAUSE_URGENT' : 'PAUSE_NORMAL',
        source: 'ANALYZED'
      };
    }

    // Kampania z wysokim ACOS
    if (acos > breakEven * 2 && sales > 0) {
      return {
        action: 'OPTIMIZE',
        reason: `📁 Kampania: ACOS ${acos.toFixed(1)}% >> ${breakEven}% BE - wymaga optymalizacji targetów`,
        confidence: 0.80,
        urgency: 'HIGH',
        autoSelect: false,
        color: this.colors.DECREASE_BID_HIGH,
        classification: 'DECREASE_BID_HIGH',
        source: 'ANALYZED'
      };
    }

    // Kampania z dobrym ACOS
    if (acos > 0 && acos <= breakEven && sales > 0) {
      return {
        action: 'MAINTAIN',
        reason: `📁 Kampania: ACOS ${acos.toFixed(1)}% ≤ ${breakEven}% BE - działa dobrze`,
        confidence: 0.80,
        urgency: 'LOW',
        autoSelect: false,
        color: this.colors.MAINTAIN,
        classification: 'MAINTAIN',
        source: 'ANALYZED'
      };
    }

    // Domyślnie
    return {
      action: 'MONITOR',
      reason: `📁 Kampania: ${clicks} kliknięć, ${sales.toFixed(2)}€ sprzedaży`,
      confidence: 0.50,
      urgency: 'LOW',
      autoSelect: false,
      color: this.colors.MONITOR,
      classification: 'MONITOR',
      source: 'ANALYZED'
    };
  }

  /**
   * NOWE: Klasyfikacja Ad Group
   */
  classifyAdGroup(clicks, spend, sales, orders, acos, impressions) {
    const breakEven = this.acosSettings.breakEven;

    // Ad Group bez danych
    if (impressions === 0 && clicks === 0) {
      return {
        action: 'MONITOR',
        reason: `📂 Ad Group: brak danych (0 wyświetleń)`,
        confidence: 0.30,
        urgency: 'LOW',
        autoSelect: false,
        color: this.colors.MONITOR,
        classification: 'MONITOR',
        source: 'ANALYZED'
      };
    }

    // Ad Group bez sprzedaży ale z wydatkami
    if (sales === 0 && spend > 0) {
      return {
        action: 'REVIEW',
        reason: `📂 Ad Group: ${spend.toFixed(2)}€ wydane, 0 sprzedaży - sprawdź słowa kluczowe`,
        confidence: 0.70,
        urgency: spend > 30 ? 'HIGH' : 'MEDIUM',
        autoSelect: false,
        color: spend > 30 ? this.colors.PAUSE_URGENT : this.colors.PAUSE_NORMAL,
        classification: spend > 30 ? 'PAUSE_URGENT' : 'PAUSE_NORMAL',
        source: 'ANALYZED'
      };
    }

    // Ad Group z wysokim ACOS
    if (acos > breakEven * 2 && sales > 0) {
      return {
        action: 'OPTIMIZE',
        reason: `📂 Ad Group: ACOS ${acos.toFixed(1)}% >> ${breakEven}% BE - optymalizuj stawki`,
        confidence: 0.80,
        urgency: 'HIGH',
        autoSelect: false,
        color: this.colors.DECREASE_BID_HIGH,
        classification: 'DECREASE_BID_HIGH',
        source: 'ANALYZED'
      };
    }

    // Ad Group z dobrym ACOS
    if (acos > 0 && acos <= breakEven && sales > 0) {
      return {
        action: 'MAINTAIN',
        reason: `📂 Ad Group: ACOS ${acos.toFixed(1)}% ≤ ${breakEven}% BE - działa dobrze`,
        confidence: 0.80,
        urgency: 'LOW',
        autoSelect: false,
        color: this.colors.MAINTAIN,
        classification: 'MAINTAIN',
        source: 'ANALYZED'
      };
    }

    // Domyślnie
    return {
      action: 'MONITOR',
      reason: `📂 Ad Group: ${clicks} kliknięć, ${sales.toFixed(2)}€ sprzedaży`,
      confidence: 0.50,
      urgency: 'LOW',
      autoSelect: false,
      color: this.colors.MONITOR,
      classification: 'MONITOR',
      source: 'ANALYZED'
    };
  }

  /**
   * Pobierz rekomendacje z Full Analysis
   */
  getFullAnalysisRecommendations() {
    try {
      const fullSheet = this.ss.getSheetByName('LUKO_Full_Analysis');
      if (!fullSheet) return [];

      const recommendations = [];
      const data = fullSheet.getDataRange().getValues();

      let inSection = false;

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const firstCell = row[0] ? row[0].toString() : '';

        if (firstCell.includes('TOP TARGETY') || firstCell.includes('PARETO')) {
          inSection = true;
          continue;
        }

        if (inSection && firstCell.includes('===')) {
          break;
        }

        if (inSection && row.length >= 4) {
          const keyword = row[1] ? row[1].toString().trim() : '';
          const campaign = row[2] ? row[2].toString().trim() : '';
          const adGroup = row[3] ? row[3].toString().trim() : '';
          const acos = this.parser.parseNumber(row[7]);

          if (keyword && keyword !== 'Keyword/Target' && keyword !== '...') {
            const actionInfo = this.determineActionFromAcos(acos);

            recommendations.push({
              keyword: keyword,
              campaign: campaign,
              adGroup: adGroup,
              acos: acos,
              action: actionInfo.action,
              change: actionInfo.change,
              reason: actionInfo.reason
            });
          }
        }
      }

      return recommendations;

    } catch (error) {
      this.logger.log(`Błąd pobierania Full Analysis: ${error.toString()}`, 'WARNING');
      return [];
    }
  }

  /**
   * Znajdź dopasowanie w Full Analysis
   */
  findFullAnalysisMatch(recommendations, campaign, adGroup, keyword) {
    if (!recommendations || recommendations.length === 0) return null;

    for (const rec of recommendations) {
      const campaignMatch = campaign && rec.campaign &&
        (campaign.toLowerCase().includes(rec.campaign.toLowerCase()) ||
         rec.campaign.toLowerCase().includes(campaign.toLowerCase()));

      const keywordMatch = keyword && rec.keyword &&
        (keyword.toLowerCase().includes(rec.keyword.toLowerCase()) ||
         rec.keyword.toLowerCase().includes(keyword.toLowerCase()));

      if (campaignMatch && keywordMatch) {
        return rec;
      }
    }

    return null;
  }

  /**
   * Określ akcję na podstawie ACOS
   */
  determineActionFromAcos(acos) {
    const breakEven = this.acosSettings.breakEven;

    if (acos > breakEven * 2) {
      return {
        action: 'DECREASE_BID',
        change: '-30',
        reason: `ACOS ${acos.toFixed(1)}% >> Break-Even - znaczna redukcja`
      };
    } else if (acos > breakEven) {
      return {
        action: 'DECREASE_BID',
        change: '-20',
        reason: `ACOS ${acos.toFixed(1)}% > Break-Even - redukcja`
      };
    } else if (acos < breakEven * 0.5) {
      return {
        action: 'INCREASE_BID',
        change: '+20',
        reason: `ACOS ${acos.toFixed(1)}% < 0.5×BE - skalowanie`
      };
    } else {
      return {
        action: 'MONITOR',
        change: '',
        reason: `ACOS ${acos.toFixed(1)}% w normie`
      };
    }
  }

  /**
   * Zastosuj kolorowanie
   */
  applyColorCoding(sheet, data, columns) {
    try {
      const colors = [];

      for (let i = 1; i < data.length; i++) {
        const action = data[i][columns.action] || '';
        const reason = data[i][columns.reason] || '';

        let color = '#ffffff';

        // Określ kolor na podstawie action + reason (dla odcieni)
        if (action === 'PAUSE') {
          if (reason.includes('KRYTYCZNE')) {
            color = this.colors.PAUSE_CRITICAL;
          } else if (reason.includes('PILNE')) {
            color = this.colors.PAUSE_URGENT;
          } else {
            color = this.colors.PAUSE_NORMAL;
          }
        } else if (action === 'DECREASE_BID') {
          const change = Math.abs(this.parser.parseNumber(data[i][columns.percentValue]));
          if (change >= 25) {
            color = this.colors.DECREASE_BID_HIGH;
          } else if (change >= 15) {
            color = this.colors.DECREASE_BID_MEDIUM;
          } else {
            color = this.colors.DECREASE_BID_LOW;
          }
        } else if (action === 'INCREASE_BID') {
          // FIXED: Dodane kolory dla zwiększenia widoczności
          if (reason.includes('BRAK WIDOCZNOŚCI') || reason.includes('Niska widoczność')) {
            color = this.colors.NO_VISIBILITY;
          } else {
            const change = this.parser.parseNumber(data[i][columns.percentValue]);
            if (change >= 20) {
              color = this.colors.INCREASE_BID_HIGH;
            } else if (change >= 15) {
              color = this.colors.INCREASE_BID_MEDIUM;
            } else {
              color = this.colors.INCREASE_BID_LOW;
            }
          }
        } else if (action === 'ADD_NEGATIVE') {
          color = this.colors.ADD_NEGATIVE;
        } else if (action === 'MAINTAIN') {
          color = this.colors.MAINTAIN;
        } else if (action === 'MONITOR') {
          color = this.colors.MONITOR;
        }

        colors.push([color]);
      }

      if (colors.length > 0 && columns.action >= 0) {
        sheet.getRange(2, columns.action + 1, colors.length, 1).setBackgrounds(colors);

        // Koloruj też reason
        if (columns.reason >= 0) {
          sheet.getRange(2, columns.reason + 1, colors.length, 1).setBackgrounds(colors);
        }
      }

    } catch (error) {
      this.logger.log(`Błąd kolorowania: ${error.toString()}`, 'WARNING');
    }
  }

  /**
   * Pokaż szczegółowe podsumowanie
   * FIXED: Dodane podsumowanie dla zwiększenia widoczności
   */
  showDetailedSummary(stats, elapsed) {
    let summary = `📊 ANALIZA BULK - PODSUMOWANIE\n`;
    summary += `═══════════════════════════════════════\n\n`;
    summary += `⏱️ Czas: ${elapsed}s\n`;
    summary += `📋 Przetworzono: ${stats.processed} wierszy\n`;
    summary += `✅ Przeanalizowano: ${stats.analyzed} targetów\n`;
    summary += `☑️ Automatycznie zaznaczono: ${stats.autoSelected}\n`;
    summary += `📊 Z Full Analysis: ${stats.fromFullAnalysis}\n\n`;

    summary += `🎯 KLASYFIKACJA:\n\n`;

    // PAUSE
    const totalPause = stats.classifications.PAUSE_CRITICAL +
                       stats.classifications.PAUSE_URGENT +
                       stats.classifications.PAUSE_NORMAL;
    if (totalPause > 0) {
      summary += `⏸️ DO PAUZY: ${totalPause}\n`;
      if (stats.classifications.PAUSE_CRITICAL > 0) {
        summary += `   🚨 Krytyczne: ${stats.classifications.PAUSE_CRITICAL}\n`;
      }
      if (stats.classifications.PAUSE_URGENT > 0) {
        summary += `   ⚠️ Pilne: ${stats.classifications.PAUSE_URGENT}\n`;
      }
      if (stats.classifications.PAUSE_NORMAL > 0) {
        summary += `   • Normalne: ${stats.classifications.PAUSE_NORMAL}\n`;
      }
    }

    // DECREASE
    const totalDecrease = stats.classifications.DECREASE_BID_HIGH +
                          stats.classifications.DECREASE_BID_MEDIUM +
                          stats.classifications.DECREASE_BID_LOW;
    if (totalDecrease > 0) {
      summary += `\n🔻 OBNIŻENIE STAWEK: ${totalDecrease}\n`;
      if (stats.classifications.DECREASE_BID_HIGH > 0) {
        summary += `   🔴 Wysokie (-30%): ${stats.classifications.DECREASE_BID_HIGH}\n`;
      }
      if (stats.classifications.DECREASE_BID_MEDIUM > 0) {
        summary += `   🟠 Średnie (-20%): ${stats.classifications.DECREASE_BID_MEDIUM}\n`;
      }
      if (stats.classifications.DECREASE_BID_LOW > 0) {
        summary += `   • Niskie (-10%): ${stats.classifications.DECREASE_BID_LOW}\n`;
      }
    }

    // INCREASE
    const totalIncrease = stats.classifications.INCREASE_BID_HIGH +
                          stats.classifications.INCREASE_BID_MEDIUM +
                          stats.classifications.INCREASE_BID_LOW +
                          stats.classifications.INCREASE_VISIBILITY;
    if (totalIncrease > 0) {
      summary += `\n🔺 ZWIĘKSZENIE STAWEK: ${totalIncrease}\n`;
      // FIXED: Dodane zwiększenie widoczności
      if (stats.classifications.INCREASE_VISIBILITY > 0) {
        summary += `   🔵 Zwiększ widoczność: ${stats.classifications.INCREASE_VISIBILITY}\n`;
      }
      if (stats.classifications.INCREASE_BID_HIGH > 0) {
        summary += `   🟢 Wysokie (+25%): ${stats.classifications.INCREASE_BID_HIGH}\n`;
      }
      if (stats.classifications.INCREASE_BID_MEDIUM > 0) {
        summary += `   • Średnie (+15%): ${stats.classifications.INCREASE_BID_MEDIUM}\n`;
      }
      if (stats.classifications.INCREASE_BID_LOW > 0) {
        summary += `   • Niskie (+10%): ${stats.classifications.INCREASE_BID_LOW}\n`;
      }
    }

    // Pozostałe
    if (stats.classifications.ADD_NEGATIVE > 0) {
      summary += `\n🚫 Negatywy: ${stats.classifications.ADD_NEGATIVE}\n`;
    }
    if (stats.classifications.MAINTAIN > 0) {
      summary += `✅ Utrzymać: ${stats.classifications.MAINTAIN}\n`;
    }
    if (stats.classifications.MONITOR > 0) {
      summary += `👁️ Monitorować: ${stats.classifications.MONITOR}\n`;
    }

    summary += `\n═══════════════════════════════════════\n`;
    summary += `\n💡 Zaznaczone wiersze (${stats.autoSelected}) są gotowe\n`;
    summary += `do zastosowania zmian.\n\n`;
    summary += `Możesz teraz:\n`;
    summary += `• Przejrzeć sugestie w BULK_Builder\n`;
    summary += `• Zastosować zmiany (BULK → Zastosuj zmiany)\n`;
    summary += `• Wyeksportować do Amazon`;

    SpreadsheetApp.getUi().alert(
      '✅ Analiza zakończona',
      summary,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }

  /**
   * Pobierz kolor dla akcji
   */
  getColorForAction(action, urgency) {
    if (action === 'PAUSE') {
      if (urgency === 'CRITICAL') return this.colors.PAUSE_CRITICAL;
      if (urgency === 'HIGH') return this.colors.PAUSE_URGENT;
      return this.colors.PAUSE_NORMAL;
    }
    if (action === 'DECREASE_BID') return this.colors.DECREASE_BID_MEDIUM;
    if (action === 'INCREASE_BID') return this.colors.INCREASE_BID_MEDIUM;
    if (action === 'ADD_NEGATIVE') return this.colors.ADD_NEGATIVE;
    if (action === 'MAINTAIN') return this.colors.MAINTAIN;
    return this.colors.MONITOR;
  }

  /**
   * Mapuj kolumny
   */
  mapColumns(headers) {
    const columns = {};

    headers.forEach((header, index) => {
      const h = header.toString().toLowerCase();

      if (h.includes('entity')) columns.entity = index;
      if (h.includes('campaign') && h.includes('name')) columns.campaignName = index;
      if (h.includes('ad group') && h.includes('name')) columns.adGroupName = index;
      if (h.includes('keyword') && h.includes('text')) columns.keywordText = index;
      if (h.includes('match') && h.includes('type')) columns.matchType = index;
      if (h.includes('impressions')) columns.impressions = index;
      if (h.includes('clicks')) columns.clicks = index;
      if (h.includes('spend')) columns.spend = index;
      if (h.includes('sales')) columns.sales = index;
      if (h.includes('orders')) columns.orders = index;
      if (h.includes('acos')) columns.acos = index;
      if (h.includes('cpc')) columns.cpc = index;

      if (h === 'apply' || h === '✅ apply') columns.apply = index;
      if (h === 'action' || h === '💡 action') columns.action = index;
      if (h === 'reason' || h === '📝 reason') columns.reason = index;
      if (h === 'percentvalue' || h === '% change') columns.percentValue = index;
      if (h === 'confidence' || h === '🎯 confidence') columns.confidence = index;
      if (h === 'source' || h === '📊 source') columns.source = index;
      if (h === 'status' || h === '📌 status') columns.status = index;
    });

    return columns;
  }
}

// ===== FUNKCJE GLOBALNE =====

/**
 * Główna funkcja wywoływana z menu
 * ZMIANA: Bez dialogu - analiza działa od razu z domyślnymi progami
 */
function runBulkAnalysis() {
  // Weryfikacja klucza API
  const apiKey = PropertiesService.getUserProperties().getProperty('LUKO_API_KEY');
  if (!apiKey || apiKey.trim() === '') {
    SpreadsheetApp.getUi().alert(
      '❌ Błąd licencji',
      'Brak klucza API - ustaw przez menu LUKO → Ustawienia → Ustaw klucz API',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    return;
  }

  try {
    const analyzer = new BulkAnalyzer();
    // ZMIANA: Bezpośrednia analiza bez dialogu
    analyzer.runAnalysis();
  } catch (error) {
    SpreadsheetApp.getUi().alert(
      '❌ Błąd',
      error.toString(),
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}

/**
 * Funkcja pomocnicza - zachowana dla kompatybilności
 * (nie używana po usunięciu dialogu)
 */
function runAnalysisWithSettings(settings) {
  const analyzer = new BulkAnalyzer();
  if (settings && settings.minClicks) {
    analyzer.thresholds.minClicksForPause = settings.minClicks;
  }
  if (settings && settings.minSpend) {
    analyzer.thresholds.minSpendForPause = settings.minSpend;
  }
  return analyzer.analyze();
}

/**
 * Integracja z Full Analysis
 */
function applyFullAnalysisRecommendations() {
  const apiKey = PropertiesService.getUserProperties().getProperty('LUKO_API_KEY');
  if (!apiKey || apiKey.trim() === '') {
    SpreadsheetApp.getUi().alert(
      '❌ Błąd licencji',
      'Brak klucza API',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    return;
  }

  try {
    const analyzer = new BulkAnalyzer();
    const recs = analyzer.getFullAnalysisRecommendations();

    if (recs.length === 0) {
      SpreadsheetApp.getUi().alert(
        'Brak rekomendacji',
        'Nie znaleziono rekomendacji w Full Analysis',
        SpreadsheetApp.getUi().ButtonSet.OK
      );
      return;
    }

    // Uruchom analizę która automatycznie użyje rekomendacji z FA
    analyzer.analyze();

  } catch (error) {
    SpreadsheetApp.getUi().alert(
      '❌ Błąd',
      error.toString(),
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}
// Re-pushed Thu Nov 27 20:50:04 UTC 2025

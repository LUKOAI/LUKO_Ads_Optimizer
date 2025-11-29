// ===== 13-BULKMAPPER.JS - FILTROWANIE I KOPIOWANIE BULK DATA =====
// Wersja: 1.4 - V6.4: ShareOfSales + poprawne formatowanie % (0.021 → 2.10%)
// Zadanie: Kopiowanie wierszy z BULK_Source do BULK_Builder z filtrowaniem
// Autor: LUKO AI
// Data: 2024

/**
 * BulkMapper - Filtruje i kopiuje dane z raportów Amazon
 * NIE ANALIZUJE - tylko filtruje według kryteriów i przenosi dane
 * Dodaje puste kolumny pomocnicze do późniejszej analizy
 */
class BulkMapper {
  constructor() {
    // Weryfikacja licencji
    this.verifyLicense();

    this.ss = SpreadsheetApp.getActiveSpreadsheet();
    this.logger = new LukoLogger();
    this.parser = universalParser;

    // Ustawienia batch processing
    this.BATCH_SIZE = 500;
    this.MAX_EXECUTION_TIME = 270000; // 4.5 min
  }

  /**
   * Weryfikacja licencji - UŻYWA UserProperties!
   */
  verifyLicense() {
    const apiKey = PropertiesService.getUserProperties().getProperty('LUKO_API_KEY');
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('Brak klucza API - ustaw przez menu LUKO → Ustawienia → Ustaw klucz API');
    }
  }

  /**
   * NOWA METODA: Pokaż dialog mapowania
   * Wywołuje globalną funkcję showMappingDialog()
   */
  showMappingDialog() {
    // Uzywamy this.ss ktore juz mamy
    const ui = SpreadsheetApp.getUi();
    // V6.3: Ulepszone wyszukiwanie arkusza zrodlowego z fallback do hardcoded nazw
    let sourceSheet = null;

    // 1. Probuj helper function
    if (typeof getBulkSourceSheet === 'function') {
      sourceSheet = getBulkSourceSheet();
    }

    // 2. Probuj LUKO_CONFIG jesli helper nie znalazl
    if (!sourceSheet && typeof LUKO_CONFIG !== 'undefined' && LUKO_CONFIG.SHEETS) {
      if (LUKO_CONFIG.SHEETS.BULK_SOURCE) {
        sourceSheet = this.ss.getSheetByName(LUKO_CONFIG.SHEETS.BULK_SOURCE);
      }
      if (!sourceSheet && LUKO_CONFIG.SHEETS.BULK_SOURCE_OLD) {
        sourceSheet = this.ss.getSheetByName(LUKO_CONFIG.SHEETS.BULK_SOURCE_OLD);
      }
    }

    // 3. Fallback do hardcoded nazw (jesli konfiguracja nie istnieje)
    if (!sourceSheet) {
      sourceSheet = this.ss.getSheetByName('SP_Bulk_Report') ||
                    this.ss.getSheetByName('BULK_Source');
    }

    if (!sourceSheet) {
      ui.alert(
        '❌ Brak danych',
        'Najpierw wgraj raport Amazon do arkusza "SP_Bulk_Report" lub "BULK_Source"',
        ui.ButtonSet.OK
      );
      return;
    }

    const totalRows = sourceSheet.getLastRow() - 1;
    const acosSettings = getAcosSettings();
    const breakEven = acosSettings.breakEven || 25;
    const lowAcos = (breakEven * 0.5).toFixed(1);
    const highAcos = (breakEven * 2).toFixed(1);

    const html = HtmlService.createHtmlOutput(`
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
              margin-bottom: 4px;
              color: #1557b0;
            }

            .filter-section {
              margin-bottom: 24px;
            }

            .section-title {
              font-weight: 600;
              margin-bottom: 12px;
              color: #1f1f1f;
              font-size: 15px;
            }

            .checkbox-group {
              display: flex;
              flex-direction: column;
              gap: 12px;
            }

            .checkbox-item {
              display: flex;
              align-items: flex-start;
              padding: 12px;
              border: 2px solid #e8eaed;
              border-radius: 8px;
              cursor: pointer;
              transition: all 0.2s;
            }

            .checkbox-item:hover {
              border-color: #1a73e8;
              background: #f1f7ff;
            }

            .checkbox-item.disabled {
              opacity: 0.4;
              pointer-events: none;
              background: #f8f9fa;
            }

            .checkbox-item input[type="checkbox"] {
              margin-right: 12px;
              margin-top: 2px;
              width: 20px;
              height: 20px;
              cursor: pointer;
            }

            .checkbox-label {
              flex: 1;
            }

            .checkbox-label strong {
              display: block;
              margin-bottom: 4px;
              color: #1f1f1f;
            }

            .checkbox-label .description {
              font-size: 12px;
              color: #5f6368;
            }

            .fetch-all-box {
              background: #d4edda;
              border: 2px solid #28a745;
              border-radius: 8px;
              padding: 16px;
              margin-bottom: 24px;
            }

            .fetch-all-box .checkbox-item {
              border: none;
              padding: 0;
              background: transparent;
            }

            .fetch-all-box .checkbox-item:hover {
              background: transparent;
            }

            .fetch-all-box strong {
              color: #155724;
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

            .warning {
              color: #ea4335;
              font-size: 12px;
              margin-top: 8px;
              display: flex;
              align-items: center;
              gap: 4px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>🔍 Mapowanie danych BULK</h2>
            <div class="subtitle">Wybierz które targety przenieść do BULK_Builder</div>

            <div class="info-box">
              <strong>Znaleziono: ${totalRows} wierszy w ${sourceSheet.getName()}</strong>
              Break-Even ACOS: ${breakEven}%<br>
              Niski ACOS: ≤${lowAcos}% | Wysoki ACOS: ≥${highAcos}%
            </div>

            <!-- POBIERZ WSZYSTKO - DOMYŚLNIE ZAZNACZONE -->
            <div class="fetch-all-box">
              <div class="checkbox-item" onclick="toggleFetchAll()">
                <input type="checkbox" id="fetchAll" checked onchange="toggleFetchAll()">
                <div class="checkbox-label">
                  <strong>📦 Pobierz wszystkie wiersze (ZALECANE)</strong>
                  <div class="description">
                    Kopiuje całą zawartość ${sourceSheet.getName()} do BULK_Builder bez filtrowania
                  </div>
                </div>
              </div>
            </div>

            <!-- FILTRY ACOS - domyślnie wyłączone -->
            <div class="filter-section disabled" id="acosFilters">
              <div class="section-title">Filtry ACOS (opcjonalne):</div>

              <div class="checkbox-group">
                <div class="checkbox-item" onclick="toggleCheckbox('highAcos')">
                  <input type="checkbox" id="highAcos" disabled>
                  <div class="checkbox-label">
                    <strong>🔴 ACOS za wysoki (≥${highAcos}%)</strong>
                    <div class="description">
                      Targety z ACOS powyżej 2×Break-Even
                    </div>
                  </div>
                </div>

                <div class="checkbox-item" onclick="toggleCheckbox('optimalAcos')">
                  <input type="checkbox" id="optimalAcos" disabled>
                  <div class="checkbox-label">
                    <strong>🟡 ACOS optymalny (${lowAcos}% - ${breakEven}%)</strong>
                    <div class="description">
                      Targety między 0.5×BE a Break-Even
                    </div>
                  </div>
                </div>

                <div class="checkbox-item" onclick="toggleCheckbox('lowAcos')">
                  <input type="checkbox" id="lowAcos" disabled>
                  <div class="checkbox-label">
                    <strong>🟢 ACOS niski/zyskowny (≤${lowAcos}%)</strong>
                    <div class="description">
                      Targety poniżej 0.5×Break-Even
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- FILTR BEZ SPRZEDAŻY -->
            <div class="filter-section disabled" id="noSalesFilter">
              <div class="section-title">Filtr wydajności:</div>

              <div class="checkbox-group">
                <div class="checkbox-item" onclick="toggleCheckbox('noSales')">
                  <input type="checkbox" id="noSales" disabled>
                  <div class="checkbox-label">
                    <strong>⛔ Bez sprzedaży (clicks > 0, sales = 0)</strong>
                    <div class="description">
                      Targety z kliknięciami ale bez sprzedaży
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="buttons">
              <button class="btn-primary" onclick="startMapping()">
                🚀 Rozpocznij mapowanie
              </button>
              <button class="btn-secondary" onclick="google.script.host.close()">
                Anuluj
              </button>
            </div>
          </div>

          <script>
            // Inicjalizacja - filtry wyłączone bo fetchAll jest zaznaczone
            document.addEventListener('DOMContentLoaded', function() {
              toggleFetchAll();
            });

            function toggleCheckbox(id) {
              const checkbox = document.getElementById(id);
              if (!checkbox.disabled) {
                checkbox.checked = !checkbox.checked;
              }
            }

            function toggleFetchAll() {
              const fetchAll = document.getElementById('fetchAll').checked;
              const acosFilters = document.getElementById('acosFilters');
              const noSalesFilter = document.getElementById('noSalesFilter');

              // Włącz/wyłącz checkboxy
              const filterCheckboxes = ['highAcos', 'lowAcos', 'optimalAcos', 'noSales'];
              filterCheckboxes.forEach(id => {
                const cb = document.getElementById(id);
                cb.disabled = fetchAll;
                if (fetchAll) cb.checked = false;
              });

              if (fetchAll) {
                acosFilters.classList.add('disabled');
                noSalesFilter.classList.add('disabled');
              } else {
                acosFilters.classList.remove('disabled');
                noSalesFilter.classList.remove('disabled');
              }
            }

            function startMapping() {
              console.log('startMapping() wywołane');

              // Pokaż że przycisk działa
              const btn = document.querySelector('.btn-primary');
              btn.textContent = '⏳ Mapowanie...';
              btn.disabled = true;

              const fetchAll = document.getElementById('fetchAll').checked;

              const filters = {
                fetchAll: fetchAll,
                highAcos: document.getElementById('highAcos').checked,
                lowAcos: document.getElementById('lowAcos').checked,
                optimalAcos: document.getElementById('optimalAcos').checked,
                noSales: document.getElementById('noSales').checked
              };

              console.log('Filtry:', JSON.stringify(filters));

              // Wywołaj funkcję Apps Script
              google.script.run
                .withSuccessHandler(function(result) {
                  console.log('SUCCESS:', result);
                  google.script.host.close();
                })
                .withFailureHandler(function(error) {
                  console.error('FAILURE:', error);
                  alert('❌ Błąd: ' + error.message || error);
                  btn.textContent = '🚀 Rozpocznij mapowanie';
                  btn.disabled = false;
                })
                .runMappingWithFilters(filters);
            }
          </script>
        </body>
      </html>
    `)
    .setWidth(550)
    .setHeight(750);

    ui.showModalDialog(html, 'Mapowanie BULK');
  }

  /**
   * GŁÓWNA FUNKCJA - Mapowanie z filtrami
   * @param {Object} filters - Wybrane filtry z okienka
   * @returns {Object} Wynik operacji {success, count, time}
   */
  runMapping(filters) {
    const startTime = Date.now();

    try {
      this.ss.toast('Rozpoczynam mapowanie BULK...', 'LUKO', -1);

      this.logger.log('=== BULK MAPPER START ===', 'INFO');
      this.logger.log(`Filtry: ${JSON.stringify(filters)}`, 'INFO');

      // V6.3: Ulepszone wyszukiwanie arkusza zrodlowego z fallback do hardcoded nazw
      let bulkSource = null;

      // 1. Probuj helper function
      if (typeof getBulkSourceSheet === 'function') {
        bulkSource = getBulkSourceSheet();
      }

      // 2. Probuj LUKO_CONFIG jesli helper nie znalazl
      if (!bulkSource && typeof LUKO_CONFIG !== 'undefined' && LUKO_CONFIG.SHEETS) {
        if (LUKO_CONFIG.SHEETS.BULK_SOURCE) {
          bulkSource = this.ss.getSheetByName(LUKO_CONFIG.SHEETS.BULK_SOURCE);
        }
        if (!bulkSource && LUKO_CONFIG.SHEETS.BULK_SOURCE_OLD) {
          bulkSource = this.ss.getSheetByName(LUKO_CONFIG.SHEETS.BULK_SOURCE_OLD);
        }
      }

      // 3. Fallback do hardcoded nazw
      if (!bulkSource) {
        bulkSource = this.ss.getSheetByName('SP_Bulk_Report') ||
                     this.ss.getSheetByName('BULK_Source');
      }
      if (!bulkSource || bulkSource.getLastRow() < 2) {
        throw new Error('Brak danych w SP_Bulk_Report lub BULK_Source - wgraj raport Amazon');
      }

      const totalRows = bulkSource.getLastRow();
      const totalCols = bulkSource.getLastColumn();

      this.logger.log(`${bulkSource.getName()}: ${totalRows} wierszy × ${totalCols} kolumn`, 'INFO');

      // Pobierz nagłówki i dane
      const headers = bulkSource.getRange(1, 1, 1, totalCols).getValues()[0];
      const allData = bulkSource.getRange(2, 1, totalRows - 1, totalCols).getValues();

      // Identyfikuj kolumny
      const columns = this.identifyColumns(headers);
      this.logger.log(`Kolumny: ${JSON.stringify(columns)}`, 'INFO');

      // Przygotuj ustawienia ACOS
      const acosSettings = getAcosSettings();
      const breakEven = acosSettings.breakEven || 25;
      const lowAcos = breakEven * 0.5;
      const highAcos = breakEven * 2;

      this.logger.log(`ACOS: Low=${lowAcos}%, BE=${breakEven}%, High=${highAcos}%`, 'INFO');

      // Filtruj wiersze
      const filteredRows = this.filterRows(allData, columns, filters, {
        breakEven: breakEven,
        lowAcos: lowAcos,
        highAcos: highAcos
      });

      this.logger.log(`Przefiltrowano: ${filteredRows.length} z ${allData.length} wierszy`, 'INFO');

      if (filteredRows.length === 0) {
        SpreadsheetApp.getUi().alert(
          '⚠️ Brak danych',
          'Żaden wiersz nie spełnia wybranych filtrów.\n\n' +
          'Spróbuj:\n' +
          '• Zmienić kryteria filtrowania\n' +
          '• Wybrać "Pobierz wszystko"',
          SpreadsheetApp.getUi().ButtonSet.OK
        );
        return { success: false, count: 0 };
      }

      // Utwórz arkusz BULK_Builder
      let builderSheet = this.ss.getSheetByName('BULK_Builder');

      if (builderSheet) {
        this.ss.deleteSheet(builderSheet);
        SpreadsheetApp.flush();
        Utilities.sleep(500);
      }

      builderSheet = this.ss.insertSheet('BULK_Builder');

      // Przygotuj rozszerzone nagłówki (oryginalne + pomocnicze)
      const extendedHeaders = this.createExtendedHeaders(headers);
      builderSheet.getRange(1, 1, 1, extendedHeaders.length).setValues([extendedHeaders]);
      this.formatHeaders(builderSheet);

      // Przygotuj rozszerzone wiersze (oryginalne dane + kolumny pomocnicze)
      const extendedRows = this.addHelperColumns(filteredRows);

      // Skopiuj przefiltrowane dane - BATCH
      if (extendedRows.length > 0) {
        this.ss.toast(`Kopiuję ${extendedRows.length} wierszy...`, 'LUKO', -1);

        builderSheet.getRange(2, 1, extendedRows.length, extendedHeaders.length)
          .setValues(extendedRows);
      }

      // Dodaj checkboxy w kolumnie Apply
      this.addCheckboxColumn(builderSheet, extendedHeaders, extendedRows.length);

      // Ustaw formaty numeryczne dla kolumn z liczbami
      this.setNumericFormats(builderSheet, columns);

      SpreadsheetApp.flush();

      // Podsumowanie
      const elapsed = Math.round((Date.now() - startTime) / 1000);

      this.logger.log('=== MAPOWANIE ZAKOŃCZONE ===', 'SUCCESS');
      this.logger.log(`Skopiowano: ${extendedRows.length} wierszy w ${elapsed}s`, 'SUCCESS');

      this.ss.toast('✅ Mapowanie zakończone!', 'LUKO', 3);

      SpreadsheetApp.getUi().alert(
        '✅ Mapowanie zakończone',
        `Skopiowano ${extendedRows.length} wierszy do BULK_Builder.\n\n` +
        `Czas: ${elapsed}s\n\n` +
        `Możesz teraz:\n` +
        `• Przejrzeć dane w BULK_Builder\n` +
        `• Uruchomić analizę (BULK → Analiza)`,
        SpreadsheetApp.getUi().ButtonSet.OK
      );

      return {
        success: true,
        count: extendedRows.length,
        time: elapsed
      };

    } catch (error) {
      this.logger.log(`BŁĄD: ${error.toString()}`, 'ERROR');

      SpreadsheetApp.getUi().alert(
        '❌ Błąd mapowania',
        error.toString(),
        SpreadsheetApp.getUi().ButtonSet.OK
      );

      throw error;
    }
  }

  /**
   * Tworzenie rozszerzonych nagłówków (oryginalne + pomocnicze)
   * V6.4: Dodana kolumna ShareOfSales (udział w obrocie) po ROAS, przed Apply
   */
  createExtendedHeaders(originalHeaders) {
    return [
      ...originalHeaders,
      'ShareOfSales',      // V6.4: NOWE - udział w całkowitej sprzedaży (% total)
      'Apply',
      'Action',
      'Reason',
      'PercentValue',      // V6.4: Teraz = wartość zmiany (np. "-30%", "+25%")
      'Confidence',
      'Source',
      'Status',
      'ChangesDONE'
    ];
  }

  /**
   * Dodanie kolumn pomocniczych do każdego wiersza
   * V6.4: Dodana kolumna ShareOfSales przed Apply
   */
  addHelperColumns(rows) {
    return rows.map(row => {
      return [
        ...row,
        '',                    // ShareOfSales - V6.4: udział w obrocie (wypełni BulkAnalyzer)
        '',                    // Apply - pusta kratka (checkbox będzie dodany)
        '',                    // Action - puste
        '',                    // Reason - puste
        '',                    // PercentValue - V6.4: wartość zmiany (np. "-30%")
        '',                    // Confidence - puste
        'BULK Report',         // Source - skąd pochodzą dane
        'Czeka na analizę',    // Status - informacja dla użytkownika
        ''                     // ChangesDONE - puste
      ];
    });
  }

  /**
   * Dodaj checkboxy do kolumny Apply
   */
  addCheckboxColumn(sheet, headers, numRows) {
    const applyColIndex = headers.indexOf('Apply');

    if (applyColIndex >= 0 && numRows > 0) {
      const range = sheet.getRange(2, applyColIndex + 1, numRows, 1);

      // Dodaj checkbox bez wymuszania wartości
      const validation = SpreadsheetApp.newDataValidation()
        .requireCheckbox()
        .setAllowInvalid(false)
        .build();

      range.setDataValidation(validation);
    }
  }

  /**
   * Identyfikacja kolumn w raporcie Amazon
   */
  identifyColumns(headers) {
    const columns = {};

    headers.forEach((header, index) => {
      const h = header.toString().toLowerCase();

      // Entity i State
      if (h.includes('entity')) columns.entity = index;
      if (h.includes('state')) columns.state = index;

      // Nazwy
      if (h.includes('campaign') && h.includes('name')) columns.campaignName = index;
      if (h.includes('ad group') && h.includes('name')) columns.adGroupName = index;
      if (h.includes('keyword') && h.includes('text')) columns.keywordText = index;
      if (h.includes('targeting')) columns.targeting = index;

      // Metryki
      if (h.includes('impressions')) columns.impressions = index;
      if (h.includes('clicks')) columns.clicks = index;
      if (h.includes('spend')) columns.spend = index;
      if (h.includes('sales')) columns.sales = index;
      if (h.includes('orders')) columns.orders = index;
      if (h.includes('acos')) columns.acos = index;
      if (h.includes('roas')) columns.roas = index;
      // V6.3: Dodane kolumny CTR i Conversion Rate
      if (h.includes('click-through rate') || h === 'ctr') columns.ctr = index;
      if (h.includes('conversion rate')) columns.conversionRate = index;

      // Ustawienia
      if (h.includes('bid') && !h.includes('strategy')) columns.bid = index;
      if (h.includes('daily') && h.includes('budget')) columns.budget = index;
    });

    return columns;
  }

  /**
   * FILTROWANIE WIERSZY według wybranych kryteriów
   */
  filterRows(allData, columns, filters, acosThresholds) {
    const filtered = [];

    // Jeśli "Pobierz wszystko" - zwróć wszystko
    if (filters.fetchAll === true) {
      this.logger.log('Tryb: POBIERZ WSZYSTKO', 'INFO');
      return allData;
    }

    // Sprawdź czy wybrano jakikolwiek filtr
    const hasAnyFilter = filters.highAcos || filters.lowAcos || filters.optimalAcos || filters.noSales;

    if (!hasAnyFilter) {
      this.logger.log('UWAGA: Brak wybranych filtrów - zwracam wszystko', 'WARNING');
      return allData;
    }

    // Filtrowanie
    for (let i = 0; i < allData.length; i++) {
      const row = allData[i];

      // Parsuj metryki
      const clicks = this.parser.parseNumber(row[columns.clicks]);
      const sales = this.parser.parseNumber(row[columns.sales]);
      const orders = this.parser.parseNumber(row[columns.orders]);
      let acos = this.parser.parseNumber(row[columns.acos]);

      // Normalizuj ACOS (jeśli 0.25 → 25%)
      if (acos > 0 && acos < 2) {
        acos = acos * 100;
      }

      // FILTR: Bez sprzedaży (wyklucza filtry ACOS)
      if (filters.noSales === true) {
        if (clicks > 0 && (sales === 0 || orders === 0)) {
          filtered.push(row);
          continue;
        }
      }

      // Jeśli wybrany "bez sprzedaży" - pomiń filtry ACOS
      if (filters.noSales === true) {
        continue;
      }

      // FILTR: ACOS za wysoki (≥ 2×BE)
      if (filters.highAcos === true) {
        if (acos >= acosThresholds.highAcos && sales > 0) {
          filtered.push(row);
          continue;
        }
      }

      // FILTR: ACOS niski/zyskowny (≤ 0.5×BE)
      if (filters.lowAcos === true) {
        if (acos > 0 && acos <= acosThresholds.lowAcos && sales > 0) {
          filtered.push(row);
          continue;
        }
      }

      // FILTR: ACOS optymalny (0.5×BE do BE)
      if (filters.optimalAcos === true) {
        if (acos > acosThresholds.lowAcos && acos <= acosThresholds.breakEven && sales > 0) {
          filtered.push(row);
          continue;
        }
      }
    }

    return filtered;
  }

  /**
   * Formatowanie nagłówków
   */
  formatHeaders(sheet) {
    const lastCol = sheet.getLastColumn();
    const headerRange = sheet.getRange(1, 1, 1, lastCol);

    headerRange.setBackground('#4285f4');
    headerRange.setFontColor('#ffffff');
    headerRange.setFontWeight('bold');
    headerRange.setHorizontalAlignment('center');

    sheet.setFrozenRows(1);
  }

  /**
   * Ustawienie formatów numerycznych
   * V6.4: ACOS/CTR/ConvRate - Amazon podaje jako ułamki dziesiętne
   * Format 0.00% mnoży przez 100 (0.021 → 2.10%)
   */
  setNumericFormats(sheet, columns) {
    const lastRow = sheet.getLastRow();

    if (lastRow < 2) return;

    // Bid - 0.00€
    if (columns.bid >= 0) {
      sheet.getRange(2, columns.bid + 1, lastRow - 1, 1)
        .setNumberFormat('0.00');
    }

    // Budget - 0.00€
    if (columns.budget >= 0) {
      sheet.getRange(2, columns.budget + 1, lastRow - 1, 1)
        .setNumberFormat('0.00');
    }

    // Spend - 0.00€
    if (columns.spend >= 0) {
      sheet.getRange(2, columns.spend + 1, lastRow - 1, 1)
        .setNumberFormat('0.00');
    }

    // Sales - 0.00€
    if (columns.sales >= 0) {
      sheet.getRange(2, columns.sales + 1, lastRow - 1, 1)
        .setNumberFormat('0.00');
    }

    // V6.4: ACOS - Amazon podaje jako ułamek (0.25 = 25%), więc mnożymy przez 100
    if (columns.acos >= 0) {
      sheet.getRange(2, columns.acos + 1, lastRow - 1, 1)
        .setNumberFormat('0.00%');
    }

    // ROAS - 0.00
    if (columns.roas >= 0) {
      sheet.getRange(2, columns.roas + 1, lastRow - 1, 1)
        .setNumberFormat('0.00');
    }

    // V6.4: CTR - Amazon podaje jako ułamek (0.021 = 2.1%), więc mnożymy przez 100
    // Tak jak w Full Analysis: (clicks/impressions)*100 daje np. 6.30
    if (columns.ctr >= 0) {
      sheet.getRange(2, columns.ctr + 1, lastRow - 1, 1)
        .setNumberFormat('0.00%');
    }

    // V6.4: Conversion Rate - Amazon podaje jako ułamek, mnożymy przez 100
    if (columns.conversionRate >= 0) {
      sheet.getRange(2, columns.conversionRate + 1, lastRow - 1, 1)
        .setNumberFormat('0.00%');
    }
  }
}

// ===== FUNKCJE GLOBALNE =====

/**
 * Pokaż dialog wyboru filtrów (wywoływana z HTML lub menu)
 */
function showMappingDialog() {
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
    const mapper = new BulkMapper();
    mapper.showMappingDialog();

  } catch (error) {
    SpreadsheetApp.getUi().alert(
      '❌ Błąd',
      'Błąd podczas otwierania dialogu: ' + error.toString(),
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}

/**
 * Uruchom mapowanie z wybranymi filtrami
 */
function runMappingWithFilters(filters) {
  // Weryfikacja klucza API
  const apiKey = PropertiesService.getUserProperties().getProperty('LUKO_API_KEY');
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('Brak klucza API - ustaw przez menu LUKO → Ustawienia → Ustaw klucz API');
  }

  try {
    const mapper = new BulkMapper();
    const result = mapper.runMapping(filters);

    return result;

  } catch (error) {
    throw new Error('Błąd mapowania: ' + error.toString());
  }
}
/**
 * LUKO Ads Optimizer - Bulk Change Manager
 * Moduł do aplikowania zmian masowych w kampaniach Amazon PPC
 *
 * WERSJA: 3.6 - NAPRAWIONE PAUZOWANIE
 *
 * NAPRAWIONE W V3.6:
 * - TRYB 1 (Filtr): Maszyna SAMA szuka targetów BEZ SPRZEDAŻY (Orders=0)
 *   według kryteriów clicks/spend i je pauzuje
 * - TRYB 2 (Ręczne): Użytkownik zaznacza wiersze PRZED otwarciem dialogu
 *   i te dokładnie zostają spauzowane (bez sprawdzania kryteriów)
 * - Ostrzeżenie gdy wśród ręcznie zaznaczonych są targety Z zamówieniami
 * - Checkbox Apply ustawiany na FALSE po spauzowaniu
 *
 * NAPRAWIONE W V3.4:
 * - Entity detection: akceptuje różne formaty (keyword, targeting, etc.)
 * - Bid change: wartość dodatnia/ujemna określa kierunek
 * - ChangesDONE: ZAWSZE ustawia 'DONE' (dla eksportu)
 *
 * NAPRAWIONE W V3.0:
 * - Dialog bid pokazuje wartości ACOS (break-even, low, high)
 * - Podświetlenie zmienionej kolumny Bid (jak przy pause)
 * - Weryfikacja API przez UserProperties
 * - Faktyczna modyfikacja kolumn Amazon (State, Bid, Budget)
 *
 * Dwie strefy operacyjne:
 * 1. STREFA SUGEROWANA: Aplikuje zmiany z analizy (Apply=checked, Action wypełnione)
 * 2. STREFA MANUALNA: Pozwala użytkownikowi ręcznie wybrać targety i zastosować akcje
 *
 * Wspiera: Pause, Bid Changes (up/down), Budget Changes, Negative Keywords
 */

class BulkChangeManager {
  constructor() {
    this.ss = SpreadsheetApp.getActiveSpreadsheet();
    this.builderSheet = this.ss.getSheetByName('BULK_Builder');
    this.parser = typeof universalParser !== 'undefined' ? universalParser : null;

    // Kolory dla wizualizacji zmian
    this.colors = {
      PAUSED: '#ffcccc',        // Jasny czerwony dla pauzowanych
      BID_INCREASED: '#ccffcc', // Jasny zielony dla zwiększonych stawek
      BID_DECREASED: '#ffe6cc', // Jasny pomarańczowy dla zmniejszonych stawek
      BUDGET_CHANGED: '#e6f2ff', // Jasny niebieski dla zmienionych budżetów
      NEGATIVE_ADDED: '#f0f0f0', // Jasny szary dla dodanych negatywów
      DONE: '#d9f2d9'           // Jasnozielony dla ukończonych
    };

    // Weryfikacja licencji
    this.verifyLicense();
  }

  /**
   * Weryfikacja klucza API - FIXED: używa UserProperties!
   */
  verifyLicense() {
    // FIXED: Używamy UserProperties zamiast ScriptProperties
    const apiKey = PropertiesService.getUserProperties().getProperty('LUKO_API_KEY');

    if (!apiKey || apiKey.trim() === '') {
      throw new Error('⚠️ Brak klucza API. Ustaw przez menu: LUKO → 🔑 Ustaw klucz API');
    }

    // Sprawdzenie formatu klucza
    if (apiKey.length < 10) {
      throw new Error('⚠️ Nieprawidłowy format klucza API.');
    }

    Logger.log('✓ Licencja zweryfikowana');
  }

  /**
   * Główne menu wyboru akcji
   */
  showMainMenu() {
    const html = HtmlService.createHtmlOutput(this.getMainMenuHtml())
      .setWidth(500)
      .setHeight(600);
    SpreadsheetApp.getUi().showModalDialog(html, '🎯 LUKO Bulk Change Manager');
  }

  /**
   * HTML dla głównego menu
   */
  getMainMenuHtml() {
    return `
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
              font-size: 24px;
            }
            .section {
              margin: 25px 0;
              padding: 20px;
              background: #f8f9fa;
              border-radius: 10px;
              border-left: 4px solid #667eea;
            }
            .section h3 {
              margin-top: 0;
              color: #667eea;
              font-size: 18px;
            }
            .section p {
              color: #666;
              font-size: 13px;
              margin: 8px 0;
              line-height: 1.5;
            }
            .button-group {
              display: flex;
              flex-direction: column;
              gap: 10px;
              margin-top: 15px;
            }
            button {
              padding: 12px 20px;
              border: none;
              border-radius: 8px;
              font-size: 14px;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.3s ease;
              text-align: left;
            }
            .btn-primary {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
            }
            .btn-primary:hover {
              transform: translateY(-2px);
              box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
            }
            .btn-secondary {
              background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
              color: white;
            }
            .btn-secondary:hover {
              transform: translateY(-2px);
              box-shadow: 0 5px 15px rgba(245, 87, 108, 0.4);
            }
            .btn-warning {
              background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
              color: #333;
            }
            .btn-warning:hover {
              transform: translateY(-2px);
              box-shadow: 0 5px 15px rgba(250, 112, 154, 0.4);
            }
            .btn-success {
              background: linear-gradient(135deg, #30cfd0 0%, #330867 100%);
              color: white;
            }
            .btn-success:hover {
              transform: translateY(-2px);
              box-shadow: 0 5px 15px rgba(48, 207, 208, 0.4);
            }
            .icon {
              margin-right: 8px;
            }
            .divider {
              height: 1px;
              background: #ddd;
              margin: 25px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>🎯 Bulk Change Manager</h2>

            <div class="section">
              <h3>📊 STREFA 1: Sugerowane Zmiany</h3>
              <p>Aplikuj zmiany zaproponowane przez analizę (z zaznaczonymi checkboxami Apply)</p>
              <div class="button-group">
                <button class="btn-primary" onclick="applySuggestedChanges()">
                  <span class="icon">✓</span>Aplikuj Wszystkie Sugerowane Zmiany
                </button>
              </div>
            </div>

            <!-- STREFA 2 TYMCZASOWO UKRYTA - W BUDOWIE
            <div class="divider"></div>

            <div class="section">
              <h3>🎮 STREFA 2: Zmiany Manualne</h3>
              <p>Wybierz wiersze i zastosuj akcje ręcznie</p>
              <div class="button-group">
                <button class="btn-secondary" onclick="pauseTargetsManual()">
                  <span class="icon">⏸️</span>Pauzuj Wybrane Targety
                </button>
                <button class="btn-warning" onclick="changeBidsManual()">
                  <span class="icon">💰</span>Zmień Stawki (Bid)
                </button>
                <button class="btn-success" onclick="changeBudgetsManual()">
                  <span class="icon">📈</span>Zmień Budżety
                </button>
                <button class="btn-primary" onclick="addNegativeKeywordsManual()">
                  <span class="icon">🚫</span>Dodaj Negatywne Słowa Kluczowe
                </button>
              </div>
            </div>

            <div class="divider"></div>
            KONIEC STREFY 2 -->

            <div style="text-align: center; color: #999; font-size: 12px;">
              <p>⚡ Wszystkie zmiany są zapisywane w kolumnie ChangesDONE</p>
            </div>
          </div>

          <script>
            // NAPRAWIONE: Dialog potwierdzenia przed zastosowaniem zmian
            function applySuggestedChanges() {
              // Najpierw pobierz podsumowanie
              google.script.run
                .withSuccessHandler(summary => {
                  if (summary.count === 0) {
                    alert('ℹ️ Brak wierszy do zmiany\\n\\nNie znaleziono wierszy z zaznaczonym Apply i wypełnionym Action.');
                    return;
                  }

                  // Pokaż dialog potwierdzenia
                  const confirmed = confirm(
                    '⚠️ POTWIERDZENIE ZMIAN\\n\\n' +
                    '📊 Podsumowanie:\\n' +
                    '• Pauzowanie (State → paused): ' + summary.pause + ' targetów\\n' +
                    '• Zwiększenie stawek (Bid): ' + summary.increaseBid + ' targetów\\n' +
                    '• Obniżenie stawek (Bid): ' + summary.decreaseBid + ' targetów\\n' +
                    '• Negatywne słowa: ' + summary.negative + '\\n' +
                    '• Inne akcje: ' + summary.other + '\\n\\n' +
                    '🔢 RAZEM: ' + summary.count + ' zmian\\n\\n' +
                    '⚠️ Kolumny State i Bid zostaną ZMODYFIKOWANE!\\n\\n' +
                    'Czy na pewno chcesz zastosować te zmiany?'
                  );

                  if (confirmed) {
                    google.script.run
                      .withSuccessHandler(result => {
                        alert(result);
                        google.script.host.close();
                      })
                      .withFailureHandler(err => alert('❌ Błąd: ' + err))
                      .applySuggestedChangesFromAnalysis();
                  }
                })
                .withFailureHandler(err => alert('❌ Błąd: ' + err))
                .getSuggestedChangesSummary();
            }

            function pauseTargetsManual() {
              google.script.host.close();
              google.script.run.showPauseDialog();
            }

            function changeBidsManual() {
              google.script.host.close();
              google.script.run.showBidChangeDialog();
            }

            function changeBudgetsManual() {
              google.script.host.close();
              google.script.run.showBudgetChangeDialog();
            }

            function addNegativeKeywordsManual() {
              google.script.host.close();
              google.script.run.showNegativeKeywordsDialog();
            }
          </script>
        </body>
      </html>
    `;
  }

  /**
   * NOWE: Pobierz podsumowanie zmian do potwierdzenia
   */
  getSuggestedChangesSummary() {
    if (!this.builderSheet) {
      return { count: 0, pause: 0, increaseBid: 0, decreaseBid: 0, negative: 0, other: 0 };
    }

    const data = this.builderSheet.getDataRange().getValues();
    const headers = data[0];
    const columns = this.findColumnIndices(headers);

    let summary = { count: 0, pause: 0, increaseBid: 0, decreaseBid: 0, negative: 0, other: 0 };

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const applyValue = row[columns.Apply];
      const action = (row[columns.Action] || '').toString().toUpperCase();

      if ((applyValue === true || applyValue === 'TRUE' || applyValue === '☑') && action) {
        summary.count++;

        if (action.includes('PAUSE')) {
          summary.pause++;
        } else if (action.includes('INCREASE')) {
          summary.increaseBid++;
        } else if (action.includes('DECREASE')) {
          summary.decreaseBid++;
        } else if (action.includes('NEGATIVE')) {
          summary.negative++;
        } else {
          summary.other++;
        }
      }
    }

    return summary;
  }

  /**
   * STREFA 1: Aplikuj wszystkie sugerowane zmiany z analizy
   */
  applySuggestedChangesFromAnalysis() {
    if (!this.builderSheet) {
      throw new Error('⚠️ Arkusz BULK_Builder nie istnieje!');
    }

    const data = this.builderSheet.getDataRange().getValues();
    const headers = data[0];

    // Znajdź indeksy kolumn
    const columns = this.findColumnIndices(headers);

    // Zbierz wiersze do zmiany (Apply=checked)
    const rowsToChange = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const applyValue = row[columns.Apply];
      const action = row[columns.Action];

      // Sprawdź czy Apply jest zaznaczone i Action nie jest puste
      if ((applyValue === true || applyValue === 'TRUE' || applyValue === '☑') && action) {
        rowsToChange.push({
          rowIndex: i,
          data: row,
          action: action,
          reason: row[columns.Reason] || '',
          percentValue: row[columns.PercentValue] || ''
        });
      }
    }

    if (rowsToChange.length === 0) {
      SpreadsheetApp.getUi().alert('ℹ️ Brak wierszy do zmiany',
        'Nie znaleziono wierszy z zaznaczonym Apply i wypełnionym Action.',
        SpreadsheetApp.getUi().ButtonSet.OK);
      return;
    }

    Logger.log(`Znaleziono ${rowsToChange.length} wierszy do zmiany`);

    // Grupuj zmiany według typu akcji
    const changesByAction = this.groupChangesByAction(rowsToChange);

    // Aplikuj zmiany
    let totalChanged = 0;
    const summary = [];

    // Pauzy
    if (changesByAction.PAUSE && changesByAction.PAUSE.length > 0) {
      const count = this.applyPauseChanges(changesByAction.PAUSE, columns);
      totalChanged += count;
      summary.push(`⏸️ Pauzowano: ${count} targetów`);
    }

    // Obniżenia stawek
    if (changesByAction.DECREASE_BID && changesByAction.DECREASE_BID.length > 0) {
      const count = this.applyBidChanges(changesByAction.DECREASE_BID, columns, 'decrease');
      totalChanged += count;
      summary.push(`📉 Obniżono stawki: ${count} targetów`);
    }

    // Podwyższenia stawek
    if (changesByAction.INCREASE_BID && changesByAction.INCREASE_BID.length > 0) {
      const count = this.applyBidChanges(changesByAction.INCREASE_BID, columns, 'increase');
      totalChanged += count;
      summary.push(`📈 Podwyższono stawki: ${count} targetów`);
    }

    // Negatywne słowa kluczowe
    if (changesByAction.ADD_NEGATIVE && changesByAction.ADD_NEGATIVE.length > 0) {
      const count = this.applyNegativeKeywords(changesByAction.ADD_NEGATIVE, columns);
      totalChanged += count;
      summary.push(`🚫 Dodano negatywy: ${count} targetów`);
    }

    // Monitor (tylko oznacz jako DONE)
    if (changesByAction.MONITOR && changesByAction.MONITOR.length > 0) {
      const count = this.markAsMonitored(changesByAction.MONITOR, columns);
      totalChanged += count;
      summary.push(`👁️ Oznaczono do monitoringu: ${count} targetów`);
    }

    // Pokaż podsumowanie
    const summaryText = `✓ Pomyślnie zastosowano ${totalChanged} zmian!\n\n${summary.join('\n')}`;
    SpreadsheetApp.getUi().alert('✓ Zmiany Zastosowane', summaryText, SpreadsheetApp.getUi().ButtonSet.OK);

    Logger.log(summaryText);
  }

  /**
   * Grupuj zmiany według typu akcji
   */
  groupChangesByAction(rows) {
    const groups = {};

    rows.forEach(item => {
      const action = item.action.toUpperCase();

      // Normalizuj nazwę akcji
      let actionKey = action;
      if (action.includes('PAUSE')) actionKey = 'PAUSE';
      else if (action.includes('DECREASE') || action.includes('OBNIŻ')) actionKey = 'DECREASE_BID';
      else if (action.includes('INCREASE') || action.includes('PODWYŻSZ')) actionKey = 'INCREASE_BID';
      else if (action.includes('NEGATIVE') || action.includes('NEGATYW')) actionKey = 'ADD_NEGATIVE';
      else if (action.includes('MONITOR')) actionKey = 'MONITOR';

      if (!groups[actionKey]) {
        groups[actionKey] = [];
      }
      groups[actionKey].push(item);
    });

    return groups;
  }

  /**
   * Aplikuj pauzy - NAPRAWIONE: zmienia faktyczną kolumnę State
   */
  applyPauseChanges(rows, columns) {
    const updates = [];

    rows.forEach(item => {
      const rowIndex = item.rowIndex;
      const row = item.data;

      // Przygotuj aktualizację wiersza
      const updatedRow = [...row];

      // NAPRAWIONE: Zmień faktyczną kolumnę Amazon "State" na "paused"
      if (columns.State !== undefined) {
        updatedRow[columns.State] = 'paused';
      }

      updatedRow[columns.Status] = 'PAUSED';
      updatedRow[columns.ChangesDONE] = 'DONE';
      updatedRow[columns.Apply] = ''; // Wyczyść checkbox

      updates.push({
        rowIndex: rowIndex + 1, // +1 bo getRange jest 1-indexed
        values: [updatedRow],
        color: this.colors.PAUSED,
        stateCol: columns.State  // Przekaż indeks kolumny State do podświetlenia
      });
    });

    // Batch update
    this.applyBatchUpdates(updates, columns);

    return rows.length;
  }

  /**
   * Aplikuj zmiany stawek - NAPRAWIONE: zmienia faktyczną kolumnę Bid
   */
  applyBidChanges(rows, columns, direction) {
    const updates = [];

    rows.forEach(item => {
      const rowIndex = item.rowIndex;
      const row = item.data;
      const percentValue = item.percentValue;

      // Parsuj procent zmiany
      let changePercent = 0;
      if (percentValue) {
        const parsed = this.parser ?
          this.parser.parseNumber(String(percentValue).replace('%', '')) :
          parseFloat(String(percentValue).replace('%', '').replace(',', '.'));
        changePercent = parsed || 0;
      }

      // Jeśli brak procentu w danych, spróbuj wyciągnąć z Action
      if (changePercent === 0) {
        const actionText = item.action;
        const match = actionText.match(/[-+]?\d+%/);
        if (match) {
          changePercent = parseFloat(match[0].replace('%', ''));
        } else {
          // Domyślne wartości
          changePercent = direction === 'increase' ? 15 : -20;
        }
      }

      // Przygotuj aktualizację
      const updatedRow = [...row];
      const changeNote = `Bid ${direction === 'increase' ? '+' : ''}${changePercent}%`;

      // FIX V3.4: ChangesDONE powinno być "DONE" - notatka idzie do Status
      updatedRow[columns.ChangesDONE] = 'DONE';
      updatedRow[columns.Status] = changeNote;  // Notatka o zmianie do Status
      updatedRow[columns.Apply] = ''; // Wyczyść checkbox

      // NAPRAWIONE: Zmień faktyczną kolumnę Amazon "Bid"
      if (columns.Bid !== undefined) {
        const currentBid = this.parseNumber(row[columns.Bid]);
        if (currentBid > 0) {
          const newBid = Math.round(currentBid * (1 + changePercent / 100) * 100) / 100;
          const minBid = 0.02; // Minimalna stawka Amazon
          updatedRow[columns.Bid] = Math.max(newBid, minBid);
        }
      }

      updates.push({
        rowIndex: rowIndex + 1,
        values: [updatedRow],
        color: direction === 'increase' ? this.colors.BID_INCREASED : this.colors.BID_DECREASED,
        bidCol: columns.Bid  // Przekaż indeks kolumny Bid do podświetlenia
      });
    });

    // Batch update
    this.applyBatchUpdates(updates, columns);

    return rows.length;
  }

  /**
   * Aplikuj negatywne słowa kluczowe
   */
  applyNegativeKeywords(rows, columns) {
    const updates = [];

    rows.forEach(item => {
      const rowIndex = item.rowIndex;
      const row = item.data;

      // Przygotuj aktualizację
      const updatedRow = [...row];
      updatedRow[columns.ChangesDONE] = 'DONE';  // FIX V3.4: Zawsze DONE dla eksportu
      updatedRow[columns.Apply] = ''; // Wyczyść checkbox

      updates.push({
        rowIndex: rowIndex + 1,
        values: [updatedRow],
        color: this.colors.NEGATIVE_ADDED
      });
    });

    // Batch update
    this.applyBatchUpdates(updates, columns);

    return rows.length;
  }

  /**
   * Oznacz jako monitorowane
   */
  markAsMonitored(rows, columns) {
    const updates = [];

    rows.forEach(item => {
      const rowIndex = item.rowIndex;
      const row = item.data;

      // Przygotuj aktualizację
      const updatedRow = [...row];
      updatedRow[columns.Status] = 'Monitoring';
      updatedRow[columns.ChangesDONE] = 'DONE';  // FIX V3.4: Też DONE - eksport wymaga DONE
      updatedRow[columns.Apply] = ''; // Wyczyść checkbox

      updates.push({
        rowIndex: rowIndex + 1,
        values: [updatedRow],
        color: this.colors.DONE
      });
    });

    // Batch update
    this.applyBatchUpdates(updates, columns);

    return rows.length;
  }

  /**
   * Aplikuj batch updates (wydajne setValues) - NAPRAWIONE: podświetla zmienione kolumny
   */
  applyBatchUpdates(updates, columns) {
    updates.forEach(update => {
      const range = this.builderSheet.getRange(update.rowIndex, 1, 1, update.values[0].length);
      range.setValues(update.values);

      // Koloruj kolumnę ChangesDONE
      if (columns.ChangesDONE !== undefined) {
        const colorRange = this.builderSheet.getRange(update.rowIndex, columns.ChangesDONE + 1);
        colorRange.setBackground(update.color);
      }

      // NAPRAWIONE: Podświetl zmienioną kolumnę State (pauza)
      if (update.stateCol !== undefined && columns.State !== undefined) {
        const stateRange = this.builderSheet.getRange(update.rowIndex, columns.State + 1);
        stateRange.setBackground(this.colors.PAUSED);
        stateRange.setFontWeight('bold');
      }

      // NAPRAWIONE: Podświetl zmienioną kolumnę Bid (stawka)
      if (update.bidCol !== undefined && columns.Bid !== undefined) {
        const bidRange = this.builderSheet.getRange(update.rowIndex, columns.Bid + 1);
        bidRange.setBackground(update.color);
        bidRange.setFontWeight('bold');
      }

      // NAPRAWIONE: Podświetl zmienioną kolumnę Budget
      if (update.budgetCol !== undefined && columns.Budget !== undefined) {
        const budgetRange = this.builderSheet.getRange(update.rowIndex, columns.Budget + 1);
        budgetRange.setBackground(this.colors.BUDGET_CHANGED);
        budgetRange.setFontWeight('bold');
      }
    });

    SpreadsheetApp.flush();
  }

  /**
   * STREFA 2: Dialog do pauzowania targetów
   * V3.6: Dwa tryby - automatyczny filtr LUB ręczne zaznaczenie
   */
  showPauseDialog() {
    // Sprawdź ile wierszy jest już zaznaczonych PRZED otwarciem dialogu
    const preSelectedInfo = this.countPreSelectedRows();
    const html = HtmlService.createHtmlOutput(this.getPauseDialogHtml(preSelectedInfo))
      .setWidth(550)
      .setHeight(550);
    SpreadsheetApp.getUi().showModalDialog(html, '⏸️ Pauzuj Targety Bez Sprzedaży');
  }

  /**
   * V3.6: Policz wiersze już zaznaczone przed otwarciem dialogu
   */
  countPreSelectedRows() {
    if (!this.builderSheet) {
      return { count: 0, withOrders: 0, withoutOrders: 0 };
    }

    const data = this.builderSheet.getDataRange().getValues();
    const headers = data[0];
    const columns = this.findColumnIndices(headers);

    let count = 0;
    let withOrders = 0;
    let withoutOrders = 0;

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const applyValue = row[columns.Apply];
      const isApplyChecked = (applyValue === true || applyValue === 'TRUE' ||
                              applyValue === '☑' || applyValue === 1);

      if (isApplyChecked) {
        count++;
        const orders = this.parseNumber(row[columns.Orders]);
        if (orders > 0) {
          withOrders++;
        } else {
          withoutOrders++;
        }
      }
    }

    return { count, withOrders, withoutOrders };
  }

  /**
   * HTML dla dialogu pauzowania - V3.6: Dwa tryby działania
   */
  getPauseDialogHtml(preSelectedInfo) {
    const hasPreSelected = preSelectedInfo.count > 0;
    const hasOrdersWarning = preSelectedInfo.withOrders > 0;

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <base target="_top">
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              padding: 20px;
              background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
              margin: 0;
            }
            .container {
              background: white;
              border-radius: 15px;
              padding: 25px;
              box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            }
            h2 { color: #333; margin-top: 0; text-align: center; font-size: 20px; }
            .mode-box {
              padding: 15px;
              margin: 15px 0;
              border-radius: 10px;
              border: 2px solid #ddd;
            }
            .mode-box.active { border-color: #f5576c; background: #fff5f7; }
            .mode-box.inactive { opacity: 0.6; }
            .mode-box h3 { margin: 0 0 10px 0; font-size: 16px; }
            .mode-box p { margin: 5px 0; font-size: 13px; color: #666; }
            .warning-box {
              background: #fff3cd;
              border-left: 4px solid #ffc107;
              padding: 12px;
              margin: 10px 0;
              border-radius: 5px;
            }
            .warning-box.danger {
              background: #f8d7da;
              border-color: #dc3545;
            }
            .warning-box p { margin: 3px 0; color: #856404; font-size: 13px; }
            .warning-box.danger p { color: #721c24; }
            .form-group { margin: 15px 0; }
            label { display: block; font-weight: 600; margin-bottom: 5px; color: #333; font-size: 14px; }
            input[type="number"] {
              width: 100%;
              padding: 10px;
              border: 2px solid #ddd;
              border-radius: 8px;
              font-size: 14px;
              box-sizing: border-box;
            }
            input[type="number"]:focus { outline: none; border-color: #f5576c; }
            .button-group { display: flex; gap: 10px; margin-top: 20px; }
            button {
              flex: 1;
              padding: 12px;
              border: none;
              border-radius: 8px;
              font-size: 14px;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.3s ease;
            }
            .btn-primary {
              background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
              color: white;
            }
            .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(245, 87, 108, 0.4); }
            .btn-secondary { background: #6c757d; color: white; }
            .btn-secondary:hover { background: #5a6268; }
            .count-badge {
              display: inline-block;
              background: #dc3545;
              color: white;
              padding: 2px 8px;
              border-radius: 10px;
              font-size: 12px;
              font-weight: bold;
            }
            .count-badge.success { background: #28a745; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>⏸️ Pauzuj Targety Bez Sprzedaży</h2>

            ${hasPreSelected ? `
            <!-- TRYB 2: Ręczne zaznaczenie (przed otwarciem dialogu) -->
            <div class="mode-box active">
              <h3>✋ TRYB: Ręczne Zaznaczenie</h3>
              <p>Zaznaczono <span class="count-badge${hasOrdersWarning ? '' : ' success'}">${preSelectedInfo.count}</span> wierszy przed otwarciem okienka.</p>
              <p>Te i tylko te wiersze zostaną spauzowane.</p>

              ${hasOrdersWarning ? `
              <div class="warning-box danger">
                <p><strong>⚠️ UWAGA!</strong></p>
                <p>Wśród zaznaczonych jest <strong>${preSelectedInfo.withOrders}</strong> targetów z zamówieniami (mają sprzedaż)!</p>
                <p>Czy na pewno chcesz je spauzować?</p>
              </div>
              ` : `
              <div class="warning-box">
                <p>✓ Wszystkie ${preSelectedInfo.count} targety są bez sprzedaży (Orders = 0)</p>
              </div>
              `}
            </div>

            <div class="button-group">
              <button class="btn-secondary" onclick="google.script.host.close()">Anuluj</button>
              <button class="btn-primary" onclick="pausePreSelected()">
                ⏸️ Pauzuj ${preSelectedInfo.count} Zaznaczonych
              </button>
            </div>

            ` : `
            <!-- TRYB 1: Automatyczny filtr (brak wcześniejszego zaznaczenia) -->
            <div class="mode-box active">
              <h3>🔍 TRYB: Automatyczny Filtr</h3>
              <p>Znajdę targety <strong>BEZ SPRZEDAŻY</strong> (Orders = 0) które spełniają poniższe kryteria:</p>

              <div class="form-group">
                <label>Minimalna liczba kliknięć:</label>
                <input type="number" id="minClicks" value="10" min="0">
              </div>

              <div class="form-group">
                <label>Minimalna kwota wydatków (€):</label>
                <input type="number" id="minSpend" value="5" min="0" step="0.01">
              </div>

              <div class="warning-box">
                <p><strong>ℹ️ Jak to działa:</strong></p>
                <p>1. Znajdę targety z Clicks ≥ X i Spend ≥ Y i Orders = 0</p>
                <p>2. Zaznaczę je automatycznie (Apply = TRUE)</p>
                <p>3. Spauzuję i oznaczę jako DONE</p>
              </div>
            </div>

            <div class="button-group">
              <button class="btn-secondary" onclick="google.script.host.close()">Anuluj</button>
              <button class="btn-primary" onclick="pauseByFilter()">
                🔍 Znajdź i Pauzuj
              </button>
            </div>
            `}
          </div>

          <script>
            // TRYB 1: Automatyczny filtr - znajdź targety bez sprzedaży według kryteriów
            function pauseByFilter() {
              const minClicks = parseInt(document.getElementById('minClicks').value) || 0;
              const minSpend = parseFloat(document.getElementById('minSpend').value) || 0;

              if (minClicks === 0 && minSpend === 0) {
                if (!confirm('Ustawiono oba progi na 0. To spauzuje WSZYSTKIE targety bez sprzedaży. Kontynuować?')) {
                  return;
                }
              }

              google.script.run
                .withSuccessHandler(result => {
                  alert(result);
                  google.script.host.close();
                })
                .withFailureHandler(err => alert('Błąd: ' + err))
                .pauseZeroSalesByFilter(minClicks, minSpend);
            }

            // TRYB 2: Ręczne zaznaczenie - pauzuj tylko te zaznaczone przed otwarciem
            function pausePreSelected() {
              ${hasOrdersWarning ? `
              if (!confirm('UWAGA! Wśród zaznaczonych są ${preSelectedInfo.withOrders} targety z zamówieniami!\\n\\nCzy NA PEWNO chcesz je spauzować?')) {
                return;
              }
              ` : ''}

              google.script.run
                .withSuccessHandler(result => {
                  alert(result);
                  google.script.host.close();
                })
                .withFailureHandler(err => alert('Błąd: ' + err))
                .pausePreSelectedTargets();
            }
          </script>
        </body>
      </html>
    `;
  }

  /**
   * V3.6 TRYB 1: Pauzuj targety BEZ SPRZEDAŻY według kryteriów (automatyczny filtr)
   * Maszyna SAMA zaznacza i pauzuje targety gdzie Orders = 0
   */
  pauseZeroSalesByFilter(minClicks, minSpend) {
    if (!this.builderSheet) {
      return '⚠️ Arkusz BULK_Builder nie istnieje!';
    }

    const data = this.builderSheet.getDataRange().getValues();
    const headers = data[0];
    const columns = this.findColumnIndices(headers);

    let foundCount = 0;
    let pausedCount = 0;
    const updates = [];

    // Szukamy targetów BEZ SPRZEDAŻY (Orders = 0) spełniających kryteria
    for (let i = 1; i < data.length; i++) {
      const row = data[i];

      // Pomiń puste wiersze
      if (!row[0]) continue;

      // KLUCZOWE: Sprawdź czy target ma sprzedaż
      const orders = this.parseNumber(row[columns.Orders]);
      if (orders > 0) {
        // Ma sprzedaż - NIE pauzujemy!
        continue;
      }

      // Sprawdź kryteria clicks i spend
      const clicks = this.parseNumber(row[columns.Clicks]);
      const spend = this.parseNumber(row[columns.Spend]);

      if (minClicks > 0 && clicks < minClicks) continue;
      if (minSpend > 0 && spend < minSpend) continue;

      foundCount++;

      // Przygotuj aktualizację
      const updatedRow = [...row];

      // Zmień State na paused
      if (columns.State !== undefined) {
        updatedRow[columns.State] = 'paused';
      }

      updatedRow[columns.Status] = 'PAUSED';
      updatedRow[columns.ChangesDONE] = 'DONE';
      updatedRow[columns.Action] = 'PAUSE';
      updatedRow[columns.Reason] = `Zero sprzedaży (Clicks: ${clicks}, Spend: ${spend.toFixed(2)}€)`;
      updatedRow[columns.Apply] = false; // Wyczyść checkbox (FALSE)

      updates.push({
        rowIndex: i + 1,
        values: [updatedRow],
        color: this.colors.PAUSED,
        stateCol: columns.State
      });

      pausedCount++;
    }

    if (updates.length === 0) {
      return `ℹ️ Nie znaleziono targetów do spauzowania.\n\nKryteria: Clicks ≥ ${minClicks}, Spend ≥ ${minSpend}€, Orders = 0`;
    }

    // Aplikuj zmiany
    this.applyBatchUpdates(updates, columns);

    return `✓ Spauzowano ${pausedCount} targetów BEZ SPRZEDAŻY!\n\nKryteria: Clicks ≥ ${minClicks}, Spend ≥ ${minSpend}€, Orders = 0`;
  }

  /**
   * V3.6 TRYB 2: Pauzuj tylko te targety które były zaznaczone PRZED otwarciem dialogu
   * Bez sprawdzania kryteriów - użytkownik sam wybrał co chce spauzować
   */
  pausePreSelectedTargets() {
    if (!this.builderSheet) {
      return '⚠️ Arkusz BULK_Builder nie istnieje!';
    }

    const data = this.builderSheet.getDataRange().getValues();
    const headers = data[0];
    const columns = this.findColumnIndices(headers);

    let pausedCount = 0;
    const updates = [];

    // Pauzuj TYLKO te które mają Apply = TRUE (zaznaczone przez użytkownika)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];

      const applyValue = row[columns.Apply];
      const isApplyChecked = (applyValue === true || applyValue === 'TRUE' ||
                              applyValue === '☑' || applyValue === 1);

      if (!isApplyChecked) continue;

      // Przygotuj aktualizację
      const updatedRow = [...row];

      if (columns.State !== undefined) {
        updatedRow[columns.State] = 'paused';
      }

      updatedRow[columns.Status] = 'PAUSED';
      updatedRow[columns.ChangesDONE] = 'DONE';
      updatedRow[columns.Action] = 'PAUSE';
      updatedRow[columns.Reason] = 'Ręczne zaznaczenie';
      updatedRow[columns.Apply] = false; // Wyczyść checkbox (FALSE)

      updates.push({
        rowIndex: i + 1,
        values: [updatedRow],
        color: this.colors.PAUSED,
        stateCol: columns.State
      });

      pausedCount++;
    }

    if (updates.length === 0) {
      return 'ℹ️ Nie znaleziono zaznaczonych wierszy do spauzowania.';
    }

    // Aplikuj zmiany
    this.applyBatchUpdates(updates, columns);

    return `✓ Spauzowano ${pausedCount} ręcznie zaznaczonych targetów!`;
  }

  /**
   * LEGACY: Stara funkcja dla kompatybilności wstecznej
   */
  pauseSelectedTargetsManual(minClicks, minSpend) {
    // Przekieruj do nowej funkcji z filtrem
    return this.pauseZeroSalesByFilter(minClicks, minSpend);
  }

  /**
   * STREFA 2: Dialog do zmiany stawek
   */
  showBidChangeDialog() {
    const html = HtmlService.createHtmlOutput(this.getBidChangeDialogHtml())
      .setWidth(550)
      .setHeight(500);
    SpreadsheetApp.getUi().showModalDialog(html, '💰 Zmień Stawki (Bid)');
  }

  /**
   * HTML dla dialogu zmiany stawek - V3.0 z opcjami Apply=TRUE/ALL
   */
  getBidChangeDialogHtml() {
    // Pobierz ustawienia ACOS do wyświetlenia
    let acosSettings = { breakEven: 25, low: 15, high: 40 };
    try {
      if (typeof getAcosSettings === 'function') {
        acosSettings = getAcosSettings();
      }
    } catch (e) {
      Logger.log('Could not get ACOS settings: ' + e.message);
    }

    // Policz wiersze z Apply=TRUE
    let applyTrueCount = 0;
    let totalRows = 0;
    try {
      if (this.builderSheet) {
        const data = this.builderSheet.getDataRange().getValues();
        const headers = data[0];
        const applyCol = headers.findIndex(h => String(h).toLowerCase().includes('apply'));

        for (let i = 1; i < data.length; i++) {
          if (data[i][0]) { // Ma dane
            totalRows++;
            const applyVal = data[i][applyCol];
            if (applyVal === true || applyVal === 'TRUE' || applyVal === '☑') {
              applyTrueCount++;
            }
          }
        }
      }
    } catch (e) {
      Logger.log('Could not count rows: ' + e.message);
    }

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <base target="_top">
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              padding: 20px;
              background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
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
            .info-box {
              background: #d1ecf1;
              border-left: 4px solid #0c5460;
              padding: 15px;
              margin: 15px 0;
              border-radius: 5px;
            }
            .info-box p {
              margin: 5px 0;
              color: #0c5460;
            }
            .acos-box {
              background: #fff3cd;
              border-left: 4px solid #ffc107;
              padding: 12px;
              margin: 15px 0;
              border-radius: 5px;
              font-size: 13px;
            }
            .acos-box strong {
              color: #856404;
            }
            .acos-values {
              display: flex;
              justify-content: space-around;
              margin-top: 8px;
            }
            .acos-item {
              text-align: center;
            }
            .acos-item .value {
              font-size: 18px;
              font-weight: bold;
            }
            .acos-item .label {
              font-size: 11px;
              color: #666;
            }
            .radio-group {
              margin: 15px 0;
              padding: 12px;
              background: #f8f9fa;
              border-radius: 8px;
            }
            .radio-group h4 {
              margin: 0 0 10px 0;
              font-size: 14px;
              color: #495057;
            }
            .radio-group label {
              display: block;
              padding: 8px 10px;
              margin: 4px 0;
              cursor: pointer;
              border-radius: 5px;
              transition: background 0.2s;
              font-size: 13px;
            }
            .radio-group label:hover {
              background: #e9ecef;
            }
            .radio-group input[type="radio"] {
              margin-right: 8px;
            }
            .form-group {
              margin: 15px 0;
            }
            label {
              display: block;
              font-weight: 600;
              margin-bottom: 8px;
              color: #333;
              font-size: 14px;
            }
            select, input[type="number"] {
              width: 100%;
              padding: 10px;
              border: 2px solid #ddd;
              border-radius: 8px;
              font-size: 14px;
              box-sizing: border-box;
            }
            select:focus, input[type="number"]:focus {
              outline: none;
              border-color: #fa709a;
            }
            .button-group {
              display: flex;
              gap: 10px;
              margin-top: 20px;
            }
            button {
              flex: 1;
              padding: 12px;
              border: none;
              border-radius: 8px;
              font-size: 14px;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.3s ease;
            }
            .btn-primary {
              background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
              color: #333;
            }
            .btn-primary:hover {
              transform: translateY(-2px);
              box-shadow: 0 5px 15px rgba(250, 112, 154, 0.4);
            }
            .btn-secondary {
              background: #6c757d;
              color: white;
            }
            .btn-secondary:hover {
              background: #5a6268;
            }
            #customPercentGroup {
              display: none;
              margin-top: 15px;
            }
            .count-badge {
              display: inline-block;
              background: #28a745;
              color: white;
              padding: 2px 8px;
              border-radius: 10px;
              font-size: 12px;
              font-weight: bold;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>💰 Zmień Stawki (Bid)</h2>

            <!-- NOWE: Wyświetlanie wartości ACOS -->
            <div class="acos-box">
              <strong>📊 Twoje ustawienia ACOS:</strong>
              <div class="acos-values">
                <div class="acos-item">
                  <div class="value" style="color: #28a745;">${acosSettings.low}%</div>
                  <div class="label">Doskonały</div>
                </div>
                <div class="acos-item">
                  <div class="value" style="color: #ffc107;">${acosSettings.breakEven}%</div>
                  <div class="label">Break-Even</div>
                </div>
                <div class="acos-item">
                  <div class="value" style="color: #dc3545;">${acosSettings.high}%</div>
                  <div class="label">Za wysoki</div>
                </div>
              </div>
            </div>

            <!-- UPROSZCZONE: Jeden wybór zakresu -->
            <div class="radio-group" style="border: 2px solid #667eea; background: #f0f4ff;">
              <h4>🎯 KROK 1: Które wiersze zmienić? (wybierz JEDEN)</h4>
              <label style="background: #e8f0fe;">
                <input type="radio" name="scope" value="apply_true" checked>
                ✅ <strong>Tylko zaznaczone</strong> (Apply=TRUE) <span class="count-badge">${applyTrueCount} wierszy</span>
              </label>
              <label>
                <input type="radio" name="scope" value="all">
                📋 Wszystkie wiersze <span class="count-badge">${totalRows} wierszy</span>
              </label>
            </div>

            <!-- UPROSZCZONE: Tryb zmiany (bez osobnego kierunku) -->
            <div class="radio-group" style="border: 2px solid #fa709a; background: #fff5f5;">
              <h4>💱 KROK 2: Jak zmienić stawkę? (wybierz JEDEN)</h4>
              <label style="background: #ffe8e8;">
                <input type="radio" name="changeMode" value="percent" checked onchange="toggleChangeMode()">
                📊 <strong>Procentowo</strong> (np. +15% zwiększ, -20% obniż)
              </label>
              <label>
                <input type="radio" name="changeMode" value="fixed" onchange="toggleChangeMode()">
                💵 Kwotowo (np. +0.10€ zwiększ, -0.05€ obniż)
              </label>
              <label>
                <input type="radio" name="changeMode" value="set" onchange="toggleChangeMode()">
                🎯 Ustaw stałą wartość (np. 0.50€)
              </label>
            </div>

            <div class="form-group" id="percentGroup">
              <label>Wybierz procent zmiany:</label>
              <select id="percentChange" onchange="toggleCustomInput()">
                <option value="10">+10% (delikatne zwiększenie)</option>
                <option value="15" selected>+15% (standardowe zwiększenie)</option>
                <option value="25">+25% (mocne zwiększenie)</option>
                <option value="-10">-10% (delikatne obniżenie)</option>
                <option value="-20">-20% (standardowe obniżenie)</option>
                <option value="-30">-30% (mocne obniżenie)</option>
                <option value="custom">Własny procent...</option>
              </select>
            </div>

            <div class="form-group" id="customPercentGroup">
              <label>Podaj własny procent zmiany (np. 12 lub -18):</label>
              <input type="number" id="customPercent" value="15" step="1">
            </div>

            <!-- NOWE: Pola dla trybu kwotowego -->
            <div class="form-group" id="fixedAmountGroup" style="display:none;">
              <label>Zmień stawkę o kwotę (€):</label>
              <input type="number" id="fixedAmount" value="0.10" step="0.01" min="-10" max="10">
              <div style="font-size:12px;color:#666;margin-top:5px;">
                Wartość dodatnia = zwiększenie, ujemna = obniżenie
              </div>
            </div>

            <div class="form-group" id="setValueGroup" style="display:none;">
              <label>Ustaw stawkę na wartość (€):</label>
              <input type="number" id="setValue" value="0.50" step="0.01" min="0.02" max="100">
              <div style="font-size:12px;color:#666;margin-top:5px;">
                Minimalna stawka Amazon: 0.02€
              </div>
            </div>

            <div class="button-group">
              <button class="btn-secondary" onclick="google.script.host.close()">Anuluj</button>
              <button class="btn-primary" onclick="changeBids()">💰 Zmień Stawki</button>
            </div>
          </div>

          <script>
            function toggleCustomInput() {
              const select = document.getElementById('percentChange');
              const customGroup = document.getElementById('customPercentGroup');
              customGroup.style.display = select.value === 'custom' ? 'block' : 'none';
            }

            // NOWE: Przełączanie widoczności pól w zależności od trybu
            function toggleChangeMode() {
              const mode = document.querySelector('input[name="changeMode"]:checked').value;
              document.getElementById('percentGroup').style.display = mode === 'percent' ? 'block' : 'none';
              document.getElementById('customPercentGroup').style.display = 'none';
              document.getElementById('fixedAmountGroup').style.display = mode === 'fixed' ? 'block' : 'none';
              document.getElementById('setValueGroup').style.display = mode === 'set' ? 'block' : 'none';
            }

            function changeBids() {
              const scope = document.querySelector('input[name="scope"]:checked').value;
              const mode = document.querySelector('input[name="changeMode"]:checked').value;

              let changeData = { mode: mode, scope: scope };

              if (mode === 'percent') {
                let percent = document.getElementById('percentChange').value;
                if (percent === 'custom') {
                  percent = parseFloat(document.getElementById('customPercent').value);
                } else {
                  percent = parseFloat(percent);
                }
                // FIX V3.3: Znak wartości określa kierunek (+ = zwiększ, - = obniż)
                changeData.value = percent;
              } else if (mode === 'fixed') {
                let amount = parseFloat(document.getElementById('fixedAmount').value);
                // FIX V3.3: Znak wartości określa kierunek
                changeData.value = amount;
              } else if (mode === 'set') {
                changeData.value = parseFloat(document.getElementById('setValue').value);
              }

              // Wywołaj funkcję z nowymi parametrami
              google.script.run
                .withSuccessHandler(result => {
                  alert(result);
                  google.script.host.close();
                })
                .withFailureHandler(err => alert('Błąd: ' + err))
                .changeBidsAdvanced(changeData);
            }
          </script>
        </body>
      </html>
    `;
  }

  /**
   * Zmień stawki dla wybranych targetów (manual) - legacy dla kompatybilności
   */
  changeBidsManual(percentChange) {
    // Wywołaj nową metodę z domyślnym scope = cursor selection
    return this.changeBidsWithScope(percentChange, 'cursor');
  }

  /**
   * NOWE V3.2: Zmień stawki z wyborem zakresu (Apply=TRUE, ALL lub cursor)
   * FIXED: Stawki (Bid) można zmieniać TYLKO dla targetów (Keyword, Product Targeting)!
   */
  changeBidsWithScope(percentChange, scope = 'apply_true') {
    if (!this.builderSheet) {
      return '⚠️ Arkusz BULK_Builder nie istnieje!';
    }

    const data = this.builderSheet.getDataRange().getValues();
    const headers = data[0];
    const columns = this.findColumnIndices(headers);

    let changedCount = 0;
    let skippedNotTarget = 0;
    const updates = [];
    const direction = percentChange > 0 ? 'increase' : 'decrease';

    // Określ które wiersze przetwarzać
    for (let i = 1; i < data.length; i++) {
      const row = data[i];

      // Pomiń puste wiersze
      if (!row[0]) continue;

      // Sprawdź czy wiersz pasuje do wybranego zakresu
      let shouldProcess = false;

      if (scope === 'apply_true') {
        // NOWE: Tylko wiersze z Apply=TRUE
        const applyValue = row[columns.Apply];
        shouldProcess = (applyValue === true || applyValue === 'TRUE' || applyValue === '☑');
      } else if (scope === 'all') {
        // NOWE: Wszystkie wiersze
        shouldProcess = true;
      } else if (scope === 'cursor') {
        // Legacy: Zaznaczenie kursorem
        const selection = this.builderSheet.getActiveRange();
        const selectedStart = selection.getRow() - 1;
        const selectedEnd = selectedStart + selection.getNumRows();
        shouldProcess = (i >= selectedStart && i < selectedEnd);
      }

      if (!shouldProcess) continue;

      // FIXED V3.3: Stawki (Bid) można zmieniać dla targetów (Keyword, Product Targeting)
      const entity = (row[columns.Entity] || '').toString().trim().toLowerCase();

      // Targety które mają stawkę Bid
      const bidEntities = ['keyword', 'product targeting', 'targeting'];
      const isTarget = bidEntities.some(e => entity.includes(e) || e.includes(entity));

      // FIX V3.3: Jeśli entity puste ale ma kolumnę Bid z wartością - to target
      const hasBidValue = this.parseNumber(row[columns.Bid]) > 0;

      if (!isTarget && !hasBidValue) {
        skippedNotTarget++;
        Logger.log(`Pominięto bid dla: Entity="${entity}" (wiersz ${i+1})`);
        continue;
      }

      // Parsuj aktualną stawkę
      const currentBid = this.parseNumber(row[columns.Bid]);

      // Oblicz nową stawkę
      let newBid = currentBid;
      if (currentBid > 0) {
        newBid = Math.round(currentBid * (1 + percentChange / 100) * 100) / 100;
        const minBid = 0.02; // Minimalna stawka Amazon
        newBid = Math.max(newBid, minBid);
      }

      // Przygotuj aktualizację
      const updatedRow = [...row];
      const changeNote = `Bid ${currentBid.toFixed(2)}€ → ${newBid.toFixed(2)}€ (${percentChange > 0 ? '+' : ''}${percentChange}%)`;

      // NOWE: Zaktualizuj kolumnę Bid
      if (columns.Bid !== undefined && currentBid > 0) {
        updatedRow[columns.Bid] = newBid;
      }

      updatedRow[columns.ChangesDONE] = 'DONE';
      updatedRow[columns.Status] = changeNote;
      updatedRow[columns.Action] = percentChange > 0 ? 'INCREASE_BID' : 'DECREASE_BID';
      updatedRow[columns.Reason] = `Zmiana stawki o ${percentChange}%`;
      updatedRow[columns.PercentValue] = `${percentChange}%`;
      updatedRow[columns.Apply] = ''; // Wyczyść checkbox

      updates.push({
        rowIndex: i + 1,
        values: [updatedRow],
        color: direction === 'increase' ? this.colors.BID_INCREASED : this.colors.BID_DECREASED,
        bidCol: columns.Bid  // NOWE: Przekaż indeks kolumny Bid do podświetlenia
      });

      changedCount++;
    }

    if (updates.length === 0) {
      let reason = 'ℹ️ Nie znaleziono targetów do zmiany stawek\n\n';
      reason += '📋 Sprawdź:\n';
      reason += '• Czy zaznaczono checkboxy w kolumnie Apply?\n';
      reason += '• Czy zaznaczone wiersze to Keyword lub Product Targeting?\n';
      if (skippedNotTarget > 0) {
        reason += `\n⚠️ Pominięto ${skippedNotTarget} wierszy (Campaign/Ad Group/Product Ad - stawka Bid dotyczy tylko targetów!)`;
      }
      return reason;
    }

    // Aplikuj zmiany z podświetleniem
    this.applyBatchUpdates(updates, columns);

    const scopeText = scope === 'apply_true' ? '(Apply=TRUE)' : scope === 'all' ? '(wszystkie)' : '(zaznaczone)';
    let result = `✓ Zmieniono stawki dla ${changedCount} targetów ${scopeText}\n\nZmiana: ${percentChange > 0 ? '+' : ''}${percentChange}%`;
    if (skippedNotTarget > 0) {
      result += `\n\n⚠️ Pominięto ${skippedNotTarget} wierszy (Campaign/Ad Group - stawka Bid dotyczy tylko targetów!)`;
    }
    return result;
  }

  /**
   * NOWE V3.2: Zaawansowana zmiana stawek (procent, kwota stała, ustaw wartość)
   * FIXED: Stawki (Bid) można zmieniać TYLKO dla targetów (Keyword, Product Targeting)!
   */
  changeBidsAdvanced(changeData) {
    if (!this.builderSheet) {
      return '⚠️ Arkusz BULK_Builder nie istnieje!';
    }

    const { mode, scope, value } = changeData;
    const data = this.builderSheet.getDataRange().getValues();
    const headers = data[0];
    const columns = this.findColumnIndices(headers);

    let changedCount = 0;
    let skippedNotTarget = 0;
    const updates = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue;

      // Sprawdź czy wiersz pasuje do zakresu
      let shouldProcess = false;
      if (scope === 'apply_true') {
        const applyValue = row[columns.Apply];
        shouldProcess = (applyValue === true || applyValue === 'TRUE' || applyValue === '☑');
      } else if (scope === 'all') {
        shouldProcess = true;
      } else if (scope === 'cursor') {
        const selection = this.builderSheet.getActiveRange();
        const selectedStart = selection.getRow() - 1;
        const selectedEnd = selectedStart + selection.getNumRows();
        shouldProcess = (i >= selectedStart && i < selectedEnd);
      }

      if (!shouldProcess) continue;

      // FIXED V3.3: Stawki (Bid) można zmieniać dla targetów (Keyword, Product Targeting)
      const entity = (row[columns.Entity] || '').toString().trim().toLowerCase();

      // Targety które mają stawkę Bid
      const bidEntities = ['keyword', 'product targeting', 'targeting'];
      const isTarget = bidEntities.some(e => entity.includes(e) || e.includes(entity));

      // FIX V3.3: Jeśli entity puste ale ma kolumnę Bid z wartością - to target
      const hasBidValue = this.parseNumber(row[columns.Bid]) > 0;

      if (!isTarget && !hasBidValue) {
        skippedNotTarget++;
        Logger.log(`Pominięto bid dla: Entity="${entity}" (wiersz ${i+1})`);
        continue;
      }

      const currentBid = this.parseNumber(row[columns.Bid]);
      if (currentBid <= 0 && mode !== 'set') continue;

      let newBid = currentBid;
      let changeNote = '';

      if (mode === 'percent') {
        // Zmiana procentowa
        newBid = Math.round(currentBid * (1 + value / 100) * 100) / 100;
        changeNote = `${currentBid.toFixed(2)}€ → ${newBid.toFixed(2)}€ (${value > 0 ? '+' : ''}${value}%)`;
      } else if (mode === 'fixed') {
        // Zmiana o stałą kwotę
        newBid = Math.round((currentBid + value) * 100) / 100;
        changeNote = `${currentBid.toFixed(2)}€ → ${newBid.toFixed(2)}€ (${value > 0 ? '+' : ''}${value.toFixed(2)}€)`;
      } else if (mode === 'set') {
        // Ustaw na konkretną wartość
        newBid = value;
        changeNote = `${currentBid.toFixed(2)}€ → ${newBid.toFixed(2)}€ (SET)`;
      }

      // Minimalna stawka Amazon
      const minBid = 0.02;
      newBid = Math.max(newBid, minBid);

      // Przygotuj aktualizację
      const updatedRow = [...row];
      if (columns.Bid !== undefined) {
        updatedRow[columns.Bid] = newBid;
      }

      updatedRow[columns.ChangesDONE] = 'DONE';
      updatedRow[columns.Status] = changeNote;
      updatedRow[columns.Action] = newBid > currentBid ? 'INCREASE_BID' : 'DECREASE_BID';
      updatedRow[columns.Reason] = `Zmiana stawki: ${changeNote}`;
      updatedRow[columns.Apply] = '';

      const direction = newBid > currentBid ? 'increase' : 'decrease';

      updates.push({
        rowIndex: i + 1,
        values: [updatedRow],
        color: direction === 'increase' ? this.colors.BID_INCREASED : this.colors.BID_DECREASED,
        bidCol: columns.Bid
      });

      changedCount++;
    }

    if (updates.length === 0) {
      let reason = 'ℹ️ Nie znaleziono targetów do zmiany stawek\n\n';
      reason += '📋 Sprawdź:\n';
      reason += '• Czy zaznaczono checkboxy w kolumnie Apply?\n';
      reason += '• Czy zaznaczone wiersze to Keyword lub Product Targeting?\n';
      if (skippedNotTarget > 0) {
        reason += `\n⚠️ Pominięto ${skippedNotTarget} wierszy (Campaign/Ad Group/Product Ad - stawka Bid dotyczy tylko targetów!)`;
      }
      return reason;
    }

    this.applyBatchUpdates(updates, columns);

    const scopeText = scope === 'apply_true' ? '(Apply=TRUE)' : scope === 'all' ? '(wszystkie)' : '(zaznaczone)';
    const modeText = mode === 'percent' ? `${value > 0 ? '+' : ''}${value}%` :
                     mode === 'fixed' ? `${value > 0 ? '+' : ''}${value.toFixed(2)}€` :
                     `= ${value.toFixed(2)}€`;

    let result = `✓ Zmieniono stawki dla ${changedCount} targetów ${scopeText}\n\nZmiana: ${modeText}`;
    if (skippedNotTarget > 0) {
      result += `\n\n⚠️ Pominięto ${skippedNotTarget} wierszy (Campaign/Ad Group - stawka Bid dotyczy tylko targetów!)`;
    }
    return result;
  }

  /**
   * STREFA 2: Dialog do zmiany budżetów
   */
  showBudgetChangeDialog() {
    const html = HtmlService.createHtmlOutput(this.getBudgetChangeDialogHtml())
      .setWidth(550)
      .setHeight(500);
    SpreadsheetApp.getUi().showModalDialog(html, '📈 Zmień Budżety');
  }

  /**
   * HTML dla dialogu zmiany budżetów
   */
  getBudgetChangeDialogHtml() {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <base target="_top">
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              padding: 20px;
              background: linear-gradient(135deg, #30cfd0 0%, #330867 100%);
              margin: 0;
            }
            .container {
              background: white;
              border-radius: 15px;
              padding: 30px;
              box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            }
            h2 { color: #333; margin-top: 0; text-align: center; }
            .info-box {
              background: #d4edda;
              border-left: 4px solid #28a745;
              padding: 15px;
              margin: 20px 0;
              border-radius: 5px;
            }
            .info-box p { margin: 5px 0; color: #155724; }
            .radio-group {
              margin: 20px 0;
              padding: 15px;
              background: #f8f9fa;
              border-radius: 8px;
            }
            .radio-group label {
              display: block;
              padding: 10px;
              margin: 5px 0;
              cursor: pointer;
              border-radius: 5px;
              transition: background 0.2s;
            }
            .radio-group label:hover { background: #e9ecef; }
            .radio-group input[type="radio"] { margin-right: 10px; }
            .form-group { margin: 20px 0; }
            label {
              display: block;
              font-weight: 600;
              margin-bottom: 8px;
              color: #333;
            }
            input[type="number"] {
              width: 100%;
              padding: 10px;
              border: 2px solid #ddd;
              border-radius: 8px;
              font-size: 14px;
              box-sizing: border-box;
            }
            input[type="number"]:focus {
              outline: none;
              border-color: #30cfd0;
            }
            .button-group {
              display: flex;
              gap: 10px;
              margin-top: 25px;
            }
            button {
              flex: 1;
              padding: 12px;
              border: none;
              border-radius: 8px;
              font-size: 14px;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.3s ease;
            }
            .btn-primary {
              background: linear-gradient(135deg, #30cfd0 0%, #330867 100%);
              color: white;
            }
            .btn-primary:hover {
              transform: translateY(-2px);
              box-shadow: 0 5px 15px rgba(48, 207, 208, 0.4);
            }
            .btn-secondary { background: #6c757d; color: white; }
            .btn-secondary:hover { background: #5a6268; }
            #percentGroup, #fixedGroup { display: none; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>📈 Zmień Budżety</h2>
            <div class="info-box">
              <p><strong>ℹ️ Instrukcja:</strong></p>
              <p>1. Zaznacz kampanie w arkuszu BULK_Builder</p>
              <p>2. Wybierz sposób zmiany budżetu</p>
              <p>3. Podaj wartość zmiany</p>
            </div>
            <div class="radio-group">
              <label>
                <input type="radio" name="changeType" value="percent" checked onchange="updateInputVisibility()">
                📊 Zmień o procent (np. +20% lub -15%)
              </label>
              <label>
                <input type="radio" name="changeType" value="fixed" onchange="updateInputVisibility()">
                💰 Ustaw stałą wartość (np. 50€)
              </label>
            </div>
            <div class="form-group" id="percentGroup" style="display: block;">
              <label>Procent zmiany (dodatni = zwiększenie, ujemny = zmniejszenie):</label>
              <input type="number" id="percentValue" value="20" step="1">
            </div>
            <div class="form-group" id="fixedGroup">
              <label>Nowa wartość budżetu (€):</label>
              <input type="number" id="fixedValue" value="50" step="0.01" min="1">
            </div>
            <div class="button-group">
              <button class="btn-secondary" onclick="google.script.host.close()">Anuluj</button>
              <button class="btn-primary" onclick="changeBudgets()">📈 Zmień Budżety</button>
            </div>
          </div>
          <script>
            function updateInputVisibility() {
              const changeType = document.querySelector('input[name="changeType"]:checked').value;
              document.getElementById('percentGroup').style.display = changeType === 'percent' ? 'block' : 'none';
              document.getElementById('fixedGroup').style.display = changeType === 'fixed' ? 'block' : 'none';
            }
            function changeBudgets() {
              const changeType = document.querySelector('input[name="changeType"]:checked').value;
              let value;
              if (changeType === 'percent') {
                value = parseFloat(document.getElementById('percentValue').value);
              } else {
                value = parseFloat(document.getElementById('fixedValue').value);
              }
              google.script.run
                .withSuccessHandler(result => {
                  alert(result);
                  google.script.host.close();
                })
                .withFailureHandler(err => alert('Błąd: ' + err))
                .changeBudgetsManual(changeType, value);
            }
          </script>
        </body>
      </html>
    `;
  }

  /**
   * Zmień budżety dla wybranych kampanii (manual)
   * FIXED V3.2: Używa Apply=TRUE i TYLKO Entity=Campaign!
   * Budżet dzienny (Daily Budget) można zmieniać TYLKO dla kampanii!
   */
  changeBudgetsManual(changeType, value) {
    if (!this.builderSheet) {
      return '⚠️ Arkusz BULK_Builder nie istnieje!';
    }

    const data = this.builderSheet.getDataRange().getValues();
    const headers = data[0];
    const columns = this.findColumnIndices(headers);

    let changedCount = 0;
    let skippedNotCampaign = 0;
    const updates = [];

    // FIXED V3.2: Iteruj przez WSZYSTKIE wiersze i sprawdź Apply=TRUE
    for (let i = 1; i < data.length; i++) {
      const row = data[i];

      // FIXED: Sprawdź czy Apply jest zaznaczone (TRUE/checkbox)
      const applyValue = row[columns.Apply];
      const isApplyChecked = (applyValue === true || applyValue === 'TRUE' || applyValue === '☑');

      if (!isApplyChecked) continue;

      // FIXED V3.2: Budżet można zmieniać TYLKO dla Campaign!
      const entity = row[columns.Entity];
      if (entity !== 'Campaign') {
        skippedNotCampaign++;
        continue;
      }

      const updatedRow = [...row];
      let changeNote = '';

      // Pobierz aktualny budżet
      const currentBudget = this.parseNumber(row[columns.Budget]);

      if (changeType === 'percent') {
        // Zmiana procentowa
        const newBudget = Math.round(currentBudget * (1 + value / 100) * 100) / 100;
        changeNote = `Budget ${currentBudget}€ → ${newBudget}€ (${value > 0 ? '+' : ''}${value}%)`;

        // FIXED: Zaktualizuj faktyczną kolumnę Amazon "Daily Budget"
        if (columns.Budget !== undefined && currentBudget > 0) {
          updatedRow[columns.Budget] = Math.max(newBudget, 1); // Min 1€
        }
      } else {
        // Stała wartość
        changeNote = `Budget ${currentBudget}€ → ${value}€`;

        // FIXED: Zaktualizuj faktyczną kolumnę Amazon "Daily Budget"
        if (columns.Budget !== undefined) {
          updatedRow[columns.Budget] = Math.max(value, 1); // Min 1€
        }
      }

      updatedRow[columns.ChangesDONE] = 'DONE';
      updatedRow[columns.Status] = changeNote;
      updatedRow[columns.Action] = 'CHANGE_BUDGET';
      updatedRow[columns.Reason] = `Zmiana budżetu: ${changeNote}`;
      updatedRow[columns.PercentValue] = changeType === 'percent' ? `${value}%` : `${value}€`;
      updatedRow[columns.Apply] = ''; // Wyczyść checkbox

      updates.push({
        rowIndex: i + 1,
        values: [updatedRow],
        color: this.colors.BUDGET_CHANGED,
        budgetCol: columns.Budget
      });

      changedCount++;
    }

    if (updates.length === 0) {
      let reason = 'ℹ️ Nie znaleziono kampanii do zmiany budżetów\n\n';
      reason += '📋 Sprawdź:\n';
      reason += '• Czy zaznaczono checkboxy w kolumnie Apply?\n';
      reason += '• Czy zaznaczone wiersze mają Entity = "Campaign"?\n';
      if (skippedNotCampaign > 0) {
        reason += `\n⚠️ Pominięto ${skippedNotCampaign} wierszy (nie są kampaniami - budżet dotyczy tylko Campaign!)`;
      }
      return reason;
    }

    this.applyBatchUpdates(updates, columns);

    let result = `✓ Pomyślnie zmieniono budżety dla ${changedCount} kampanii!`;
    if (skippedNotCampaign > 0) {
      result += `\n\n⚠️ Pominięto ${skippedNotCampaign} wierszy (Ad Group/Keyword/Product Targeting - budżet dotyczy tylko Campaign!)`;
    }
    return result;
  }

  /**
   * STREFA 2: Dialog do dodawania negatywnych słów kluczowych
   */
  showNegativeKeywordsDialog() {
    const html = HtmlService.createHtmlOutput(this.getNegativeKeywordsDialogHtml())
      .setWidth(600)
      .setHeight(550);
    SpreadsheetApp.getUi().showModalDialog(html, '🚫 Dodaj Negatywne Słowa Kluczowe');
  }

  /**
   * HTML dla dialogu negatywnych słów kluczowych
   */
  getNegativeKeywordsDialogHtml() {
    return `
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
            h2 { color: #333; margin-top: 0; text-align: center; }
            .info-box {
              background: #f8d7da;
              border-left: 4px solid #dc3545;
              padding: 15px;
              margin: 20px 0;
              border-radius: 5px;
            }
            .info-box p { margin: 5px 0; color: #721c24; }
            .radio-group {
              margin: 20px 0;
              padding: 15px;
              background: #f8f9fa;
              border-radius: 8px;
            }
            .radio-group label {
              display: block;
              padding: 10px;
              margin: 5px 0;
              cursor: pointer;
              border-radius: 5px;
              transition: background 0.2s;
            }
            .radio-group label:hover { background: #e9ecef; }
            .radio-group input[type="radio"] { margin-right: 10px; }
            .form-group { margin: 20px 0; }
            label {
              display: block;
              font-weight: 600;
              margin-bottom: 8px;
              color: #333;
            }
            textarea {
              width: 100%;
              padding: 10px;
              border: 2px solid #ddd;
              border-radius: 8px;
              font-size: 14px;
              box-sizing: border-box;
              min-height: 100px;
              font-family: inherit;
            }
            textarea:focus {
              outline: none;
              border-color: #667eea;
            }
            .hint { font-size: 12px; color: #666; margin-top: 5px; }
            .button-group {
              display: flex;
              gap: 10px;
              margin-top: 25px;
            }
            button {
              flex: 1;
              padding: 12px;
              border: none;
              border-radius: 8px;
              font-size: 14px;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.3s ease;
            }
            .btn-primary {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
            }
            .btn-primary:hover {
              transform: translateY(-2px);
              box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
            }
            .btn-secondary { background: #6c757d; color: white; }
            .btn-secondary:hover { background: #5a6268; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>🚫 Dodaj Negatywne Słowa Kluczowe</h2>
            <div class="info-box">
              <p><strong>⚠️ Ważne:</strong></p>
              <p>Negatywne słowa kluczowe zapobiegają wyświetlaniu reklam dla niepożądanych wyszukiwań.</p>
            </div>
            <div class="radio-group">
              <label>
                <input type="radio" name="matchType" value="negative_exact" checked>
                🎯 Negative Exact (dokładne dopasowanie)
              </label>
              <label>
                <input type="radio" name="matchType" value="negative_phrase">
                📝 Negative Phrase (fraza)
              </label>
            </div>
            <div class="form-group">
              <label>Słowa kluczowe do zablokowania:</label>
              <textarea id="keywords" placeholder="Wpisz słowa kluczowe (jedno na linię lub oddzielone przecinkami)"></textarea>
              <div class="hint">💡 Każde słowo/fraza w nowej linii lub oddzielone przecinkami</div>
            </div>
            <div class="button-group">
              <button class="btn-secondary" onclick="google.script.host.close()">Anuluj</button>
              <button class="btn-primary" onclick="addNegatives()">🚫 Dodaj Negatywy</button>
            </div>
          </div>
          <script>
            function addNegatives() {
              const matchType = document.querySelector('input[name="matchType"]:checked').value;
              const keywords = document.getElementById('keywords').value.trim();
              if (!keywords) {
                alert('⚠️ Proszę podać przynajmniej jedno słowo kluczowe');
                return;
              }
              google.script.run
                .withSuccessHandler(result => {
                  alert(result);
                  google.script.host.close();
                })
                .withFailureHandler(err => alert('Błąd: ' + err))
                .addNegativeKeywordsManual(matchType, keywords);
            }
          </script>
        </body>
      </html>
    `;
  }

  /**
   * Dodaj negatywne słowa kluczowe dla wybranych targetów (manual)
   */
  addNegativeKeywordsManual(matchType, keywordsText) {
    const selection = this.builderSheet.getActiveRange();
    const selectedRows = selection.getRow();
    const numRows = selection.getNumRows();

    if (selectedRows === 1) {
      return '⚠️ Zaznacz wiersze targetów do dodania negatywów (nie nagłówek)';
    }

    const keywords = keywordsText
      .split(/[\n,]/)
      .map(k => k.trim())
      .filter(k => k.length > 0);

    if (keywords.length === 0) {
      return '⚠️ Nie znaleziono żadnych słów kluczowych do dodania';
    }

    const data = this.builderSheet.getDataRange().getValues();
    const headers = data[0];
    const columns = this.findColumnIndices(headers);

    let changedCount = 0;
    const updates = [];

    for (let i = selectedRows - 1; i < selectedRows - 1 + numRows; i++) {
      if (i === 0) continue;

      const row = data[i];
      const updatedRow = [...row];
      updatedRow[columns.ChangesDONE] = 'DONE';  // FIX V3.4: Zawsze DONE
      updatedRow[columns.Action] = 'ADD_NEGATIVE';
      updatedRow[columns.Reason] = `Dodano ${keywords.length} negatywnych słów: ${keywords.slice(0, 3).join(', ')}${keywords.length > 3 ? '...' : ''}`;

      updates.push({
        rowIndex: i + 1,
        values: [updatedRow],
        color: this.colors.NEGATIVE_ADDED
      });

      changedCount++;
    }

    if (updates.length === 0) {
      return 'ℹ️ Nie zaznaczono żadnych wierszy';
    }

    this.applyBatchUpdates(updates, columns);
    return `✓ Pomyślnie dodano ${keywords.length} negatywnych słów kluczowych (${matchType}) do ${changedCount} targetów!`;
  }

  /**
   * Znajdź indeksy kolumn
   */
  findColumnIndices(headers) {
    const columns = {};

    const columnMappings = {
      // Kolumny Amazon - DO MODYFIKACJI
      'State': ['State'],  // AMAZON: kolumna do pauzowania (wartość: "paused")
      'Bid': ['Bid'],      // AMAZON: kolumna stawki
      'Budget': ['Daily Budget', 'Budget'],  // AMAZON: kolumna budżetu
      'Entity': ['Entity'],

      // Dane kampanii
      'Campaign': ['Campaign', 'Campaign Name', 'Nazwa kampanii'],
      'Ad Group': ['Ad Group', 'Ad Group Name', 'Grupa reklam'],
      'Targeting': ['Targeting', 'Keyword', 'Search term', 'Targeting Expression', 'Target'],
      'Match Type': ['Match Type', 'Match type', 'Typ dopasowania'],

      // Metryki
      'Impressions': ['Impressions', 'Wyświetlenia'],
      'Clicks': ['Clicks', 'Kliknięcia'],
      'Spend': ['Spend', 'Cost', 'Koszt'],
      'Sales': ['Sales', '7 Day Total Sales', 'Sprzedaż'],
      'Orders': ['Orders', '7 Day Total Orders', 'Zamówienia'],
      'ACOS': ['ACOS', 'ACoS'],
      'CPC': ['CPC', 'Cost Per Click'],
      'CTR': ['CTR', 'Click-Thru Rate'],
      'CVR': ['CVR', 'Conversion Rate'],

      // Kolumny pomocnicze LUKO
      'Apply': ['Apply', 'Zastosuj'],
      'Action': ['Action', 'Akcja'],
      'Reason': ['Reason', 'Powód', 'Why'],
      'PercentValue': ['PercentValue', 'Percent'],
      'Confidence': ['Confidence', 'Pewność'],
      'Source': ['Source', 'Źródło'],
      'Status': ['Status'],
      'ChangesDONE': ['ChangesDONE', 'Changes', 'Zmiany']
    };

    Object.keys(columnMappings).forEach(key => {
      const aliases = columnMappings[key];
      for (let i = 0; i < headers.length; i++) {
        const header = String(headers[i]).trim();
        if (aliases.some(alias => header.toLowerCase().includes(alias.toLowerCase()))) {
          columns[key] = i;
          break;
        }
      }
    });

    return columns;
  }

  /**
   * Parsuj liczbę (wspiera EU i US formaty)
   */
  parseNumber(value) {
    if (this.parser) {
      return this.parser.parseNumber(value);
    }

    // Fallback - prosty parser
    if (typeof value === 'number') return value;
    if (!value) return 0;

    const str = String(value)
      .replace(/[^\d,.-]/g, '')
      .replace(',', '.');

    return parseFloat(str) || 0;
  }
}

// ===== FUNKCJE GLOBALNE DO WYWOŁYWANIA Z MENU I HTML =====

function showBulkChangeManager() {
  const manager = new BulkChangeManager();
  manager.showMainMenu();
}

// NOWE: Funkcja do pobierania podsumowania przed potwierdzeniem
function getSuggestedChangesSummary() {
  const manager = new BulkChangeManager();
  return manager.getSuggestedChangesSummary();
}

function applySuggestedChangesFromAnalysis() {
  const manager = new BulkChangeManager();
  return manager.applySuggestedChangesFromAnalysis();
}

function showPauseDialog() {
  const manager = new BulkChangeManager();
  manager.showPauseDialog();
}

function pauseSelectedTargetsManual(minClicks, minSpend) {
  const manager = new BulkChangeManager();
  return manager.pauseSelectedTargetsManual(minClicks, minSpend);
}

/**
 * V3.6: Pauzuj targety BEZ SPRZEDAŻY według filtra (Tryb 1)
 */
function pauseZeroSalesByFilter(minClicks, minSpend) {
  const manager = new BulkChangeManager();
  return manager.pauseZeroSalesByFilter(minClicks, minSpend);
}

/**
 * V3.6: Pauzuj ręcznie zaznaczone targety (Tryb 2)
 */
function pausePreSelectedTargets() {
  const manager = new BulkChangeManager();
  return manager.pausePreSelectedTargets();
}

function showBidChangeDialog() {
  const manager = new BulkChangeManager();
  manager.showBidChangeDialog();
}

function changeBidsManual(percentChange) {
  const manager = new BulkChangeManager();
  return manager.changeBidsManual(percentChange);
}

/**
 * NOWE V3.0: Zmiana stawek z wyborem zakresu
 */
function changeBidsWithScope(percentChange, scope) {
  const manager = new BulkChangeManager();
  return manager.changeBidsWithScope(percentChange, scope);
}

/**
 * NOWE V3.1: Zaawansowana zmiana stawek (procent, kwota, stała wartość)
 */
function changeBidsAdvanced(changeData) {
  const manager = new BulkChangeManager();
  return manager.changeBidsAdvanced(changeData);
}

function showBudgetChangeDialog() {
  const manager = new BulkChangeManager();
  manager.showBudgetChangeDialog();
}

function changeBudgetsManual(changeType, value) {
  const manager = new BulkChangeManager();
  return manager.changeBudgetsManual(changeType, value);
}

function showNegativeKeywordsDialog() {
  const manager = new BulkChangeManager();
  manager.showNegativeKeywordsDialog();
}

function addNegativeKeywordsManual(matchType, keywordsText) {
  const manager = new BulkChangeManager();
  return manager.addNegativeKeywordsManual(matchType, keywordsText);
}
// Re-pushed Thu Nov 27 20:50:04 UTC 2025

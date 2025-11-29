// // ===== 01-MAIN.GS - GŁÓWNY KONTROLER LUKO ANALYZER =====
// // ====================================
// // LUKO AMZ Ads Optimizer
// // Version: 6.1 COMPLETE WITH ALL FIXES
// // Author: Łukasz Koronczok, NetAnaliza
// // ====================================

// const LUKO_CONFIG = {
//   VERSION: '6.1',
//   SHEET_PREFIX: 'LUKO_',
//   BREAK_EVEN_ACOS: 25,
//   PAUSE_THRESHOLDS: {
//     MIN_CLICKS: 30,
//     MIN_SPEND: 5,
//     MAX_ACOS: 60
//   },
//   SHEETS: {
//     TEXTUAL_REPORT: 'LUKO_Textual_Report',
//     FULL_ANALYSIS: 'LUKO_Full_Analysis',
//     SNAPSHOT: 'LUKO_Snapshot',
//     DEBUG: 'LUKO_Debug_Log',
//     BULK_SOURCE: 'BULK_Source',
//     BULK_BUILDER: 'BULK_Builder',
//     BULK_MAPPING: 'BULK_Mapping',
//     BULK_NEGATIVES: 'BULK_Negatives',
//     BULK_EXPORT: 'BULK_Export',
//     BULK_CHANGES_LOG: 'BULK_Changes_Log'
//   }
// };

// // ===== POPRAWKA 5: UPORZĄDKOWANE MENU =====
// function onOpen() {
//   const ui = SpreadsheetApp.getUi();
  
//   ui.createMenu('🚀 LUKO ANALYZER V6.1')
//     .addSubMenu(ui.createMenu('📊 Analizy')
//       .addItem('📄 Raport tekstowy', 'generateTextualReport')
//       .addItem('📊 Pełna analiza', 'generateFullAnalysis')
//       .addItem('📷 Snapshot', 'generateSnapshot'))
    
//     .addSubMenu(ui.createMenu('🔧 BULK Operations')
//       .addItem('📥 Inicjalizuj BULK', 'initializeBulkWithHeaders')
//       .addItem('🔄 Mapowanie', 'runBulkMapping')
//       .addItem('🎯 Analiza', 'runBulkAnalysisOnly')
//       .addItem('🔗 Zastosuj z Full Analysis', 'applyFullAnalysisRecommendations') // NOWE!
//       .addSeparator()
//       .addItem('✏️ Zmień stawki - wszystkie', 'changeBidsAllDialog')
//       .addItem('✏️ Zmień stawki - wybrane', 'changeBidsSelectedDialog')
//       .addItem('⏸️ Pauzuj targety', 'pauseZeroSalesTargetsDialog')
//       .addItem('🚫 Dodaj negatywy', 'addNegativeKeywords')
//       .addItem('💰 Budżety kampanii', 'adjustCampaignBudgetsDialog'))
    
//     .addSubMenu(ui.createMenu('✅ Zaznaczanie')
//       .addItem('✅ Zaznacz wszystkie', 'selectAllTargets')
//       .addItem('❌ Odznacz wszystkie', 'deselectAllTargets')
//       .addItem('🎯 Zaznacz według kryterium', 'selectTargetsByCriteria'))
    
//     .addSubMenu(ui.createMenu('💾 Eksport')
//       .addItem('📤 Eksport do Amazon', 'exportBulkFileDialog')
//       .addItem('✅ Waliduj przed eksportem', 'validateBulkData')
//       .addItem('📊 Pokaż statystyki', 'showBulkStats'))
    
//     .addSeparator()
//     .addItem('⚙️ Ustawienia ACOS', 'showAcosSettings')
//     .addItem('🐛 Debug Log', 'showDebugLog')
//     .addItem('🗑️ Wyczyść dane', 'clearAllData')
//     .addToUi();
// }

// // ===== FUNKCJE DIALOGOWE Z POPRAWKAMI =====

// /**
//  * Dialog pauzy targetów z CUSTOM PROGAMI
//  */
// function pauseZeroSalesTargetsDialog() {
//   const ui = SpreadsheetApp.getUi();
  
//   const html = HtmlService.createHtmlOutput(`
//     <div style="font-family: Arial, sans-serif; padding: 20px;">
//       <h3>⏸️ Pauzowanie targetów bez sprzedaży</h3>
      
//       <p><strong>Kryteria domyślne:</strong></p>
//       <ul>
//         <li>Minimum kliknięć: 30</li>
//         <li>Minimum wydatków: 5€</li>
//         <li>Brak zamówień (0 orders)</li>
//       </ul>
      
//       <p style="color: #666;">
//         <em>Zalecane przez Amazon: 20-30 kliknięć bez konwersji to sygnał do pauzy.</em>
//       </p>
      
//       <hr>
      
//       <label>Min. kliknięć: <input type="number" id="minClicks" value="30" min="10" max="100"></label><br><br>
//       <label>Min. wydatków (€): <input type="number" id="minSpend" value="5" min="1" max="50" step="0.5"></label><br><br>
      
//       <button onclick="applyPause()" style="background: #ea4335; color: white; padding: 10px 20px; border: none; cursor: pointer;">
//         Zastosuj pauzy
//       </button>
//       <button onclick="google.script.host.close()" style="padding: 10px 20px; margin-left: 10px;">
//         Anuluj
//       </button>
      
//       <script>
//         function applyPause() {
//           const minClicks = document.getElementById('minClicks').value;
//           const minSpend = document.getElementById('minSpend').value;
//           google.script.run
//             .withSuccessHandler(() => google.script.host.close())
//             .pauseTargetsWithThresholds(minClicks, minSpend);
//         }
//       </script>
//     </div>
//   `)
//   .setWidth(400)
//   .setHeight(350);
  
//   ui.showModalDialog(html, 'Pauzowanie targetów');
// }

// /**
//  * Pauza targetów z custom progami + CHECKBOXY
//  */
// function pauseTargetsWithThresholds(minClicks, minSpend) {
//   try {
//     const ss = SpreadsheetApp.getActiveSpreadsheet();
//     const sheet = ss.getSheetByName('BULK_Builder');
    
//     if (!sheet) {
//       throw new Error('Brak arkusza BULK_Builder');
//     }
    
//     const data = sheet.getDataRange().getValues();
//     const headers = data[0];
    
//     // Znajdź kolumny
//     const cols = {};
//     headers.forEach((h, i) => {
//       const header = h.toString();
//       const headerLower = header.toLowerCase();
      
//       if (headerLower.includes('apply')) cols.apply = i;
//       if (headerLower.includes('action')) cols.action = i;
//       if (headerLower.includes('reason')) cols.reason = i;
//       if (headerLower.includes('entity')) cols.entity = i;
//       if (headerLower.includes('orders')) cols.orders = i;
//       if (headerLower.includes('clicks')) cols.clicks = i;
//       if (headerLower.includes('spend')) cols.spend = i;
      
//       // Szukaj dokładnie "State"
//       if (header === 'State' || (headerLower === 'state' && !headerLower.includes('informational'))) {
//         cols.state = i;
//       }
//     });
    
//     let paused = 0;
//     const minClicksNum = parseFloat(minClicks) || 0;
//     const minSpendNum = parseFloat(minSpend) || 0;
    
//     if (cols.apply >= 0) {
//       const checkboxRule = SpreadsheetApp.newDataValidation()
//         .requireCheckbox()
//         .build();
//       sheet.getRange(2, cols.apply + 1, data.length - 1, 1).setDataValidation(checkboxRule);
//     }
    
//     for (let i = 1; i < data.length; i++) {
//       const entity = data[i][cols.entity];
      
//       if (entity !== 'Keyword' && entity !== 'Product Targeting') continue;
      
//       const orders = parseFloat(data[i][cols.orders]) || 0;
//       const clicks = parseFloat(data[i][cols.clicks]) || 0;
//       const spend = parseFloat(data[i][cols.spend]) || 0;
      
//       let shouldPause = false;
      
//       if (orders === 0 && clicks >= minClicksNum) {
//         if (minSpendNum > 0) {
//           if (spend >= minSpendNum) {
//             shouldPause = true;
//           }
//         } else {
//           shouldPause = true;
//         }
//       }
      
//       if (shouldPause) {
//         sheet.getRange(i + 1, cols.apply + 1).setValue(true);
//         sheet.getRange(i + 1, cols.action + 1).setValue('PAUSE');
        
//         let reason = `Brak sprzedaży: ${clicks} kliknięć`;
//         if (minSpendNum > 0) {
//           reason += `, ${spend.toFixed(2)}€ wydatków`;
//         }
//         sheet.getRange(i + 1, cols.reason + 1).setValue(reason);
        
//         if (cols.state >= 0) {
//           sheet.getRange(i + 1, cols.state + 1).setValue('paused');
//         }
        
//         sheet.getRange(i + 1, 1, 1, headers.length).setBackground('#ffcccc');
//         paused++;
//       }
//     }
    
//     let message = `Zaznaczono ${paused} targetów:\n`;
//     message += `• 0 zamówień\n`;
//     message += `• Min. ${minClicksNum} kliknięć`;
//     if (minSpendNum > 0) {
//       message += `\n• Min. ${minSpendNum}€ wydatków`;
//     }
    
//     SpreadsheetApp.getUi().alert('✅ Zaznaczono do pauzy', message, SpreadsheetApp.getUi().ButtonSet.OK);
//     logChange('PAUSE', paused, `Clicks>=${minClicksNum}` + (minSpendNum > 0 ? `, Spend>=${minSpendNum}€` : ''));
    
//   } catch (error) {
//     SpreadsheetApp.getUi().alert('❌ Błąd', error.toString(), SpreadsheetApp.getUi().ButtonSet.OK);
//   }
// }

// /**
//  * Dialog zmiany stawek z dynamicznymi progami
//  */
// function changeBidsAllDialog() {
//   const ui = SpreadsheetApp.getUi();
  
//   // Pobierz ustawienia ACOS
//   const settings = getAcosSettings();
//   const breakEven = settings.breakEven || 25;
  
//   // Oblicz progi dynamicznie
//   const profitThreshold = Math.round(breakEven * 0.5);
//   const lossThreshold = Math.round(breakEven * 2);
  
//   const html = HtmlService.createHtmlOutput(`
//     <div style="font-family: Arial, sans-serif; padding: 20px;">
//       <h3>📈 Zmiana stawek - wszystkie targety</h3>
      
//       <div style="background: #e8f4f8; padding: 10px; margin: 10px 0; border-radius: 5px;">
//         <strong>Break-Even ACOS:</strong>
//         <input type="number" id="breakEven" value="${breakEven}" min="5" max="100" style="width: 60px;">%
//         <button onclick="updateThresholds()" style="margin-left: 10px;">Przelicz progi</button>
//       </div>
      
//       <div style="margin: 15px 0;">
//         <label style="display: block; margin: 8px 0;">
//           <input type="radio" name="group" value="profit" checked> 
//           <strong>Zyskowne</strong> <span id="profitLabel">(ACOS < ${profitThreshold}%)</span>
//         </label>
        
//         <label style="display: block; margin: 8px 0;">
//           <input type="radio" name="group" value="neutral"> 
//           <strong>Neutralne</strong> <span id="neutralLabel">(ACOS ${profitThreshold}%-${breakEven}%)</span>
//         </label>
        
//         <label style="display: block; margin: 8px 0;">
//           <input type="radio" name="group" value="loss"> 
//           <strong>Stratne</strong> <span id="lossLabel">(ACOS > ${lossThreshold}%)</span>
//         </label>
        
//         <label style="display: block; margin: 8px 0;">
//           <input type="radio" name="group" value="all"> 
//           <strong>Wszystkie</strong>
//         </label>
//       </div>
      
//       <hr>
      
//       <div style="background: #f5f5f5; padding: 10px; margin: 10px 0; border-radius: 5px;">
//         <strong>Sugerowane zmiany (najlepsze praktyki):</strong>
//         <ul style="margin: 5px 0; padding-left: 20px; font-size: 12px;">
//           <li>Zyskowne: +10% do +20% (zwiększ widoczność)</li>
//           <li>Neutralne: 0% do -5% (optymalizacja)</li>
//           <li>Stratne: -15% do -30% (redukcja kosztów)</li>
//         </ul>
//       </div>
      
//       <label><strong>Zmiana (%):</strong></label><br>
//       <input type="number" id="percentage" value="15" min="-50" max="50" step="5" style="width: 100px;">
//       <span id="preview" style="font-weight: bold; color: #4285f4;">+15%</span><br><br>
      
//       <button onclick="applyChanges()" style="background: #4285f4; color: white; padding: 10px 20px; border: none; cursor: pointer;">
//         Zastosuj zmiany
//       </button>
//       <button onclick="google.script.host.close()" style="padding: 10px 20px; margin-left: 10px;">
//         Anuluj
//       </button>
      
//       <script>
//         function updateThresholds() {
//           const breakEven = parseFloat(document.getElementById('breakEven').value) || 25;
//           const profitThreshold = Math.round(breakEven * 0.5);
//           const lossThreshold = Math.round(breakEven * 2);
          
//           document.getElementById('profitLabel').textContent = '(ACOS < ' + profitThreshold + '%)';
//           document.getElementById('neutralLabel').textContent = '(ACOS ' + profitThreshold + '%-' + breakEven + '%)';
//           document.getElementById('lossLabel').textContent = '(ACOS > ' + lossThreshold + '%)';
//         }
        
//         document.getElementById('percentage').oninput = function() {
//           const val = this.value;
//           const preview = document.getElementById('preview');
//           preview.textContent = (val >= 0 ? '+' : '') + val + '%';
//           preview.style.color = val >= 0 ? '#34a853' : '#ea4335';
//         }
        
//         document.querySelectorAll('input[name="group"]').forEach(radio => {
//           radio.onchange = function() {
//             let suggested = 0;
//             switch(this.value) {
//               case 'profit': suggested = 15; break;
//               case 'neutral': suggested = -5; break;
//               case 'loss': suggested = -20; break;
//               case 'all': suggested = 0; break;
//             }
//             document.getElementById('percentage').value = suggested;
//             document.getElementById('percentage').oninput();
//           }
//         });
        
//         function applyChanges() {
//           const group = document.querySelector('input[name="group"]:checked').value;
//           const percentage = document.getElementById('percentage').value;
//           const breakEven = document.getElementById('breakEven').value;
          
//           google.script.run
//             .withSuccessHandler(() => google.script.host.close())
//             .changeBidsAll(group, percentage, breakEven);
//         }
//       </script>
//     </div>
//   `)
//   .setWidth(450)
//   .setHeight(600);
  
//   ui.showModalDialog(html, 'Zmiana stawek - dynamiczne progi');
// }

// /**
//  * Zmiana stawek z dynamicznymi progami
//  */
// function changeBidsAll(group, percentage, breakEvenOverride) {
//   try {
//     const ss = SpreadsheetApp.getActiveSpreadsheet();
//     const sheet = ss.getSheetByName('BULK_Builder');
    
//     if (!sheet) {
//       throw new Error('Brak arkusza BULK_Builder');
//     }
    
//     const data = sheet.getDataRange().getValues();
//     const headers = data[0];
    
//     // Znajdź kolumny
//     const cols = {};
//     headers.forEach((h, i) => {
//       const header = h.toString().toLowerCase();
//       if (header.includes('apply')) cols.apply = i;
//       if (header.includes('action')) cols.action = i;
//       if (header.includes('reason')) cols.reason = i;
//       if (header.includes('change')) cols.change = i;
//       if (header.includes('entity')) cols.entity = i;
//       if (header.includes('acos')) cols.acos = i;
//       if (header.includes('bid') && !header.includes('strategy')) cols.bid = i;
//     });
    
//     // Ustaw checkboxy
//     if (cols.apply >= 0) {
//       const checkboxRule = SpreadsheetApp.newDataValidation()
//         .requireCheckbox()
//         .build();
//       sheet.getRange(2, cols.apply + 1, data.length - 1, 1).setDataValidation(checkboxRule);
//     }
    
//     let changed = 0;
//     const breakEven = parseFloat(breakEvenOverride) || 25;
//     const percentNum = parseFloat(percentage);
    
//     // Progi dynamiczne
//     const profitThreshold = breakEven * 0.5;
//     const lossThreshold = breakEven * 2;
    
//     for (let i = 1; i < data.length; i++) {
//       const entity = data[i][cols.entity];
      
//       // Tylko Keywords i Product Targeting
//       if (entity !== 'Keyword' && entity !== 'Product Targeting') continue;
      
//       let acosRaw = data[i][cols.acos];
//       if (!acosRaw || acosRaw === '') continue;
      
//       let acos = parseFloat(acosRaw.toString().replace(',', '.'));
      
//       if (acos > 0 && acos < 2) {
//         acos = acos * 100;
//       }
      
//       let shouldChange = false;
      
//       if (group === 'all') {
//         shouldChange = true;
//       } else if (group === 'profit' && acos > 0 && acos < profitThreshold) {
//         shouldChange = true;
//       } else if (group === 'neutral' && acos >= profitThreshold && acos <= breakEven) {
//         shouldChange = true;
//       } else if (group === 'loss' && acos > lossThreshold) {
//         shouldChange = true;
//       }
      
//       if (shouldChange) {
//         const action = percentNum >= 0 ? 'INCREASE_BID' : 'DECREASE_BID';
//         sheet.getRange(i + 1, cols.action + 1).setValue(action);
//         sheet.getRange(i + 1, cols.reason + 1).setValue(
//           `${group}: ACOS ${acos.toFixed(1)}% (BE: ${breakEven}%)`
//         );
        
//         if (cols.change >= 0) {
//           sheet.getRange(i + 1, cols.change + 1).setValue(percentNum);
//         }
        
//         if (cols.bid >= 0) {
//           const currentBidRaw = data[i][cols.bid];
//           const currentBid = parseFloat(currentBidRaw.toString().replace(',', '.')) || 0;
          
//           if (currentBid > 0) {
//             const newBid = currentBid * (1 + percentNum / 100);
//             const newBidFormatted = newBid.toFixed(2).replace('.', ',');
            
//             const bidCell = sheet.getRange(i + 1, cols.bid + 1);
//             bidCell.setNumberFormat('@STRING@');
//             bidCell.setValue(newBidFormatted);
//           }
//         }
        
//         let color = '#ffffff';
//         if (group === 'profit') {
//           color = '#e8f5e9';
//         } else if (group === 'loss') {
//           color = '#ffebee';
//         } else if (group === 'neutral') {
//           color = '#fff3e0';
//         } else if (group === 'all') {
//           color = '#e3f2fd';
//         }
        
//         sheet.getRange(i + 1, 1, 1, headers.length).setBackground(color);
        
//         changed++;
//       }
//     }
    
//     // Odznacz wszystkie checkboxy
//     if (cols.apply >= 0) {
//       const numRows = sheet.getLastRow();
//       if (numRows > 1) {
//         const falseValues = new Array(numRows - 1).fill([false]);
//         sheet.getRange(2, cols.apply + 1, numRows - 1, 1).setValues(falseValues);
//       }
//     }
    
//     SpreadsheetApp.getUi().alert(
//       '✅ Zmieniono stawki',
//       `Zmieniono ${changed} targetów\nGrupa: ${group}\nZmiana: ${percentage}%\nBreak-Even: ${breakEven}%`,
//       SpreadsheetApp.getUi().ButtonSet.OK
//     );
    
//     logChange('BID_CHANGE', changed, `${percentage}% dla: ${group}, BE-ACOS: ${breakEven}%`);
    
//   } catch (error) {
//     SpreadsheetApp.getUi().alert('❌ Błąd', error.toString(), SpreadsheetApp.getUi().ButtonSet.OK);
//   }
// }

// function applySelectedBidChanges() {
//   try {
//     const ss = SpreadsheetApp.getActiveSpreadsheet();
//     const sheet = ss.getSheetByName('BULK_Builder');
    
//     if (!sheet) return;
    
//     const data = sheet.getDataRange().getValues();
//     const headers = data[0];
    
//     const cols = {};
//     headers.forEach((h, i) => {
//       const header = h.toString().toLowerCase();
//       if (header.includes('apply')) cols.apply = i;
//       if (header.includes('change')) cols.change = i;
//       if (header.includes('bid') && !header.includes('strategy')) cols.bid = i;
//       if (header.includes('action')) cols.action = i;
//     });
    
//     let changed = 0;
    
//     for (let i = 1; i < data.length; i++) {
//       const apply = data[i][cols.apply];
//       const changePercent = parseFloat(data[i][cols.change]) || 0;
      
//       if (apply && changePercent !== 0 && cols.bid >= 0) {
//         const currentBid = parseFloat(data[i][cols.bid]) || 0;
//         if (currentBid > 0) {
//           const newBid = currentBid * (1 + changePercent / 100);
//           sheet.getRange(i + 1, cols.bid + 1).setValue(newBid.toFixed(2));
          
//           const action = changePercent > 0 ? 'INCREASE_BID' : 'DECREASE_BID';
//           sheet.getRange(i + 1, cols.action + 1).setValue(action);
          
//           changed++;
//         }
//       }
//     }
    
//     if (changed > 0) {
//       SpreadsheetApp.getUi().alert('✅ Zastosowano', `Zmieniono ${changed} stawek`, SpreadsheetApp.getUi().ButtonSet.OK);
//     }
    
//   } catch (error) {
//     console.error('Błąd zmiany stawek:', error);
//   }
// }

// function adjustCampaignBudgetsDialog() {
//   const ui = SpreadsheetApp.getUi();
  
//   const html = HtmlService.createHtmlOutput(`
//     <div style="font-family: Arial, sans-serif; padding: 20px;">
//       <h3>💰 Zmiana budżetów kampanii</h3>
      
//       <p>Wybierz typ zmiany:</p>
      
//       <label>
//         <input type="radio" name="type" value="percentage" checked>
//         Procentowa zmiana
//       </label><br><br>
      
//       <label>
//         <input type="radio" name="type" value="fixed">
//         Stała kwota
//       </label><br><br>
      
//       <div id="percentageDiv">
//         <label>Zmiana (%):</label><br>
//         <input type="number" id="percent" value="20" min="-50" max="100" step="10">
//       </div>
      
//       <div id="fixedDiv" style="display:none;">
//         <label>Nowy budżet (€):</label><br>
//         <input type="number" id="fixed" value="50" min="1" max="1000" step="10">
//       </div>
      
//       <br><br>
      
//       <button onclick="applyBudget()" style="background: #34a853; color: white; padding: 10px 20px; border: none; cursor: pointer;">
//         Zastosuj
//       </button>
      
//       <script>
//         document.querySelectorAll('input[name="type"]').forEach(r => {
//           r.onchange = function() {
//             document.getElementById('percentageDiv').style.display = 
//               this.value === 'percentage' ? 'block' : 'none';
//             document.getElementById('fixedDiv').style.display = 
//               this.value === 'fixed' ? 'block' : 'none';
//           }
//         });
        
//         function applyBudget() {
//           const type = document.querySelector('input[name="type"]:checked').value;
//           const value = type === 'percentage' ? 
//             document.getElementById('percent').value :
//             document.getElementById('fixed').value;
          
//           google.script.run
//             .withSuccessHandler(() => google.script.host.close())
//             .changeCampaignBudgets(type, value);
//         }
//       </script>
//     </div>
//   `)
//   .setWidth(350)
//   .setHeight(400);
  
//   ui.showModalDialog(html, 'Budżety kampanii');
// }

// /**
//  * GŁÓWNY DIALOG EKSPORTU
//  */
// function exportBulkFileDialog() {
//   const ui = SpreadsheetApp.getUi();
  
//   const html = HtmlService.createHtmlOutput(`
//     <div style="font-family: Arial, sans-serif; padding: 20px;">
//       <h3>📤 Eksport do Amazon</h3>
      
//       <p style="background: #fef7e0; padding: 10px; border-left: 4px solid #fbbc04;">
//         <strong>⚠️ WAŻNE:</strong><br>
//         Eksportuj TYLKO do tego samego marketplace,<br>
//         z którego pobrano dane (DE→DE, FR→FR, etc.)
//       </p>
      
//       <p><strong>Wybierz format eksportu:</strong></p>
      
//       <label style="display: block; margin: 10px 0;">
//         <input type="radio" name="format" value="sheet" checked>
//         <strong>Nowa karta w tym arkuszu</strong><br>
//         <span style="color: #666; font-size: 12px;">
//           Utworzy kartę "BULK_Export_[data]"
//         </span>
//       </label>
      
//       <label style="display: block; margin: 10px 0;">
//         <input type="radio" name="format" value="new">
//         <strong>Nowy arkusz Google Sheets</strong><br>
//         <span style="color: #666; font-size: 12px;">
//           Łatwiej pobrać jako XLSX
//         </span>
//       </label>
      
//       <hr>
      
//       <label>Marketplace:</label>
//       <select id="marketplace" style="margin-left: 10px;">
//         <option value="DE">DE - Niemcy</option>
//         <option value="FR">FR - Francja</option>
//         <option value="IT">IT - Włochy</option>
//         <option value="ES">ES - Hiszpania</option>
//         <option value="UK">UK - Wielka Brytania</option>
//         <option value="PL">PL - Polska</option>
//       </select>
      
//       <br><br>
      
//       <button onclick="doExport()" style="background: #34a853; color: white; padding: 10px 20px; border: none; cursor: pointer;">
//         Eksportuj
//       </button>
      
//       <script>
//         function doExport() {
//           const format = document.querySelector('input[name="format"]:checked').value;
//           const marketplace = document.getElementById('marketplace').value;
          
//           google.script.run
//             .withSuccessHandler(result => {
//               if (result && result.newSpreadsheetUrl) {
//                 window.open(result.newSpreadsheetUrl, '_blank');
//               }
//               google.script.host.close();
//             })
//             .exportFinalBulk(format, marketplace);
//         }
//       </script>
//     </div>
//   `)
//   .setWidth(450)
//   .setHeight(450);
  
//   ui.showModalDialog(html, 'Eksport do Amazon');
// }

// /**
//  * POPRAWKA 4: FINALNY EKSPORT Z FILTROWANIEM PO ACTION
//  */
// function exportFinalBulk(format, marketplace) {
//   try {
//     const ss = SpreadsheetApp.getActiveSpreadsheet();
//     const builderSheet = ss.getSheetByName('BULK_Builder');
    
//     if (!builderSheet) {
//       throw new Error('Brak arkusza BULK_Builder');
//     }
    
//     const data = builderSheet.getDataRange().getValues();
//     const headers = data[0];
    
//     // Znajdź kolumny
//     const applyCol = headers.indexOf('✅ Apply');
//     const actionCol = headers.indexOf('💡 Action');
//     const stateCol = headers.findIndex(h => h.toString().toLowerCase().includes('state'));
//     const operationCol = headers.findIndex(h => h.toString().toLowerCase().includes('operation'));
//     const originalColumnsEnd = applyCol > 0 ? applyCol : headers.length;
    
//     // Przygotuj dane do eksportu
//     const exportData = [];
//     const exportHeaders = headers.slice(0, originalColumnsEnd);
//     exportData.push(exportHeaders);
    
//     let pausedCount = 0;
//     let exportedCount = 0;
//     let skippedCount = 0;
    
//     // POPRAWKA 4: Filtruj tylko wiersze ze zmianami
//     for (let i = 1; i < data.length; i++) {
//       const action = data[i][actionCol];
//       const applyChecked = data[i][applyCol];
      
//       // Eksportuj tylko jeśli:
//       // 1. Checkbox jest zaznaczony
//       // 2. Action nie jest pusty
//       // 3. Action nie jest MONITOR ani REVIEW
//       if (applyChecked && action && action !== '' && action !== 'MONITOR' && action !== 'REVIEW') {
//         const row = data[i].slice(0, originalColumnsEnd);
        
//         // Ustaw Operation na "update" dla wszystkich zmian
//         if (operationCol >= 0) {
//           row[operationCol] = 'update';
//         }
        
//         // Jeśli akcja to PAUSE, zmień State na "paused"
//         if (action === 'PAUSE' && stateCol >= 0) {
//           row[stateCol] = 'paused';
//           pausedCount++;
//         }
        
//         exportData.push(row);
//         exportedCount++;
//       } else if (applyChecked && (action === 'MONITOR' || action === 'REVIEW')) {
//         skippedCount++;
//       }
//     }
    
//     // Sprawdź czy są dane do eksportu
//     if (exportedCount === 0) {
//       SpreadsheetApp.getUi().alert(
//         '⚠️ Brak danych do eksportu',
//         'Nie znaleziono zaznaczonych zmian do eksportu.\n\n' +
//         `Pominięto ${skippedCount} wierszy z akcją MONITOR/REVIEW`,
//         SpreadsheetApp.getUi().ButtonSet.OK
//       );
//       return;
//     }
    
//     let targetSheet;
//     let result = {};
    
//     if (format === 'new') {
//       // Nowy arkusz Google Sheets
//       const now = new Date();
//       const timestamp = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}-${String(now.getMinutes()).padStart(2,'0')}`;
//       const newSS = SpreadsheetApp.create(`Amazon_BULK_${marketplace}_${timestamp}`);
//       targetSheet = newSS.getActiveSheet();
//       targetSheet.setName('BULK_Export');
//       result.newSpreadsheetUrl = newSS.getUrl();
      
//       // Dodaj arkusz z instrukcjami
//       const instrSheet = newSS.insertSheet('INSTRUKCJE');
//       const instructions = [
//         ['📋 INSTRUKCJA EKSPORTU DO AMAZON'],
//         [''],
//         ['1. Plik → Pobierz → Microsoft Excel (.xlsx)'],
//         ['2. ⚠️ NIE WYBIERAJ CSV!'],
//         ['3. Wgraj do Amazon Ads → Campaign Manager → Bulk Operations'],
//         [`4. MARKETPLACE: ${marketplace}`],
//         [''],
//         ['PODSUMOWANIE ZMIAN:'],
//         [`• Wyeksportowano: ${exportedCount} zmian`],
//         [`• Zapauzowano: ${pausedCount} targetów`],
//         [`• Pominięto: ${skippedCount} (MONITOR/REVIEW)`],
//         [''],
//         ['⚠️ WAŻNE:'],
//         ['• Sprawdź preview przed zatwierdzeniem'],
//         ['• Zmiany wejdą w życie po 5-15 minutach']
//       ];
      
//       instrSheet.getRange(1, 1, instructions.length, 1)
//         .setValues(instructions.map(i => [i[0] || i]))
//         .setFontWeight('bold');
      
//       instrSheet.getRange(1, 1).setFontSize(16).setBackground('#4285f4').setFontColor('#ffffff');
//       instrSheet.setColumnWidth(1, 600);
      
//     } else {
//       // Nowa karta w tym arkuszu
//       const timestamp = new Date().toISOString().split('T')[0];
//       const sheetName = `BULK_Export_${timestamp}`;
//       targetSheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
//       targetSheet.clear();
//       result.sheetName = sheetName;
//     }
    
//     // Wstaw dane
//     if (exportData.length > 1) {
//       targetSheet.getRange(1, 1, exportData.length, exportData[0].length).setValues(exportData);
      
//       // Formatowanie nagłówków
//       targetSheet.getRange(1, 1, 1, exportData[0].length)
//         .setBackground('#34a853')
//         .setFontColor('#ffffff')
//         .setFontWeight('bold');
      
//       // Podświetl wiersze z pauzą
//       for (let i = 1; i < exportData.length; i++) {
//         if (stateCol >= 0 && exportData[i][stateCol] === 'paused') {
//           targetSheet.getRange(i + 1, 1, 1, exportData[0].length).setBackground('#ffe6e6');
//         }
//       }
      
//       targetSheet.autoResizeColumns(1, exportData[0].length);
//     }
    
//     // Pokaż podsumowanie
//     const ui = SpreadsheetApp.getUi();
    
//     if (format === 'new') {
//       ui.alert(
//         '✅ Eksport zakończony',
//         `Utworzono nowy arkusz.\n\n` +
//         `📊 PODSUMOWANIE:\n` +
//         `• Wyeksportowano: ${exportedCount} zmian\n` +
//         `• Zapauzowano: ${pausedCount} targetów\n` +
//         `• Pominięto: ${skippedCount} (MONITOR/REVIEW)\n\n` +
//         `📋 INSTRUKCJA:\n` +
//         `1. Arkusz otworzy się w nowej karcie\n` +
//         `2. Plik → Pobierz → Microsoft Excel (.xlsx)\n` +
//         `3. Wgraj do Amazon ${marketplace}`,
//         ui.ButtonSet.OK
//       );
//     } else {
//       ui.alert(
//         '✅ Eksport zakończony',
//         `Dane w arkuszu: ${result.sheetName}\n\n` +
//         `📊 PODSUMOWANIE:\n` +
//         `• Wyeksportowano: ${exportedCount} zmian\n` +
//         `• Zapauzowano: ${pausedCount} targetów\n` +
//         `• Pominięto: ${skippedCount} (MONITOR/REVIEW)`,
//         ui.ButtonSet.OK
//       );
      
//       ss.setActiveSheet(targetSheet);
//     }
    
//     logChange('EXPORT', exportedCount, `Marketplace: ${marketplace}, Paused: ${pausedCount}, Skipped: ${skippedCount}`);
    
//     return result;
    
//   } catch (error) {
//     SpreadsheetApp.getUi().alert('❌ Błąd eksportu', error.toString(), SpreadsheetApp.getUi().ButtonSet.OK);
//     throw error;
//   }
// }

// function changeCampaignBudgets(type, value) {
//   try {
//     const ss = SpreadsheetApp.getActiveSpreadsheet();
//     const sheet = ss.getSheetByName('BULK_Builder');
    
//     if (!sheet) {
//       throw new Error('Brak arkusza BULK_Builder');
//     }
    
//     const data = sheet.getDataRange().getValues();
//     const headers = data[0];
    
//     // Znajdź kolumny
//     const cols = {};
//     headers.forEach((h, i) => {
//       const header = h.toString().toLowerCase();
//       if (header.includes('entity')) cols.entity = i;
//       if (header.includes('budget') && !header.includes('type')) cols.budget = i;
//       if (header.includes('daily budget')) cols.budget = i;
//       if (header.includes('apply')) cols.apply = i;
//       if (header === '✅ apply') cols.apply = i;
//     });
    
//     if (cols.entity === undefined || cols.budget === undefined) {
//       throw new Error('Nie znaleziono wymaganych kolumn (Entity/Budget)');
//     }
    
//     let changed = 0;
    
//     for (let i = 1; i < data.length; i++) {
//       const entity = data[i][cols.entity];
      
//       if (entity === 'Campaign') {
//         const currentBudget = parseFloat(data[i][cols.budget]) || 0;
        
//         if (currentBudget > 0) {
//           let newBudget;
          
//           if (type === 'percentage') {
//             newBudget = currentBudget * (1 + parseFloat(value) / 100);
//           } else {
//             newBudget = parseFloat(value);
//           }
          
//           sheet.getRange(i + 1, cols.budget + 1).setValue(newBudget.toFixed(2));
          
//           if (cols.apply >= 0) {
//             sheet.getRange(i + 1, cols.apply + 1).setValue(true);
//           }
          
//           sheet.getRange(i + 1, 1, 1, headers.length).setBackground('#e6f4ea');
          
//           changed++;
//         }
//       }
//     }
    
//     if (changed === 0) {
//       throw new Error('Nie znaleziono kampanii do zmiany budżetu');
//     }
    
//     SpreadsheetApp.getUi().alert(
//       '✅ Zmieniono budżety',
//       `Zaktualizowano ${changed} kampanii\n` +
//       `Typ: ${type === 'percentage' ? 'Procentowa' : 'Stała kwota'}\n` +
//       `Wartość: ${type === 'percentage' ? value + '%' : value + '€'}`,
//       SpreadsheetApp.getUi().ButtonSet.OK
//     );
    
//     logChange('BUDGET_CHANGE', changed, `Type: ${type}, Value: ${value}`);
    
//   } catch (error) {
//     SpreadsheetApp.getUi().alert('❌ Błąd zmiany budżetów', error.toString(), SpreadsheetApp.getUi().ButtonSet.OK);
//   }
// }

// // ===== FUNKCJA LOGOWANIA ZMIAN =====
// function logChange(type, count, details) {
//   try {
//     const ss = SpreadsheetApp.getActiveSpreadsheet();
//     let logSheet = ss.getSheetByName('BULK_Changes_Log');
    
//     if (!logSheet) {
//       logSheet = ss.insertSheet('BULK_Changes_Log');
//       logSheet.getRange(1, 1, 1, 4).setValues([['Timestamp', 'Type', 'Count', 'Details']]);
//       logSheet.getRange(1, 1, 1, 4)
//         .setBackground('#4285f4')
//         .setFontColor('#ffffff')
//         .setFontWeight('bold');
//     }
    
//     const timestamp = new Date().toLocaleString('pl-PL');
//     logSheet.appendRow([timestamp, type, count, details]);
    
//   } catch (error) {
//     console.error('Log error:', error);
//   }
// }

// // ===== KRYTYCZNE FUNKCJE BULK =====

// /**
//  * GŁÓWNA FUNKCJA MAPOWANIA - BEZ TIMEOUT
//  */
// function runBulkMapping() {
//   try {
//     const ui = SpreadsheetApp.getUi();
    
//     ui.alert(
//       '🔄 Mapowanie BULK',
//       'Rozpoczynam mapowanie w trybie batch.\n' +
//       'To może potrwać kilka minut.\n\n' +
//       'Jeśli pojawi się timeout, uruchom ponownie.',
//       ui.ButtonSet.OK
//     );
    
//     const mapper = new BulkMapper();
//     const result = mapper.runMappingBatch();
    
//     ui.alert(
//       '✅ Mapowanie zakończone',
//       `Przetworzono: ${result.total || 0} wierszy\n` +
//       `Zmapowano: ${result.mapped || 0}\n` +
//       `Tylko BULK: ${result.bulkOnly || 0}`,
//       ui.ButtonSet.OK
//     );
    
//     return result;
    
//   } catch (error) {
//     Logger.log('BŁĄD w runBulkMapping: ' + error.toString());
    
//     if (error.toString().includes('execution time')) {
//       SpreadsheetApp.getUi().alert(
//         '⏱️ Timeout',
//         'Przekroczono limit czasu.\n' +
//         'Częściowe wyniki zostały zapisane.\n' +
//         'Uruchom mapowanie ponownie.',
//         SpreadsheetApp.getUi().ButtonSet.OK
//       );
//     } else {
//       SpreadsheetApp.getUi().alert(
//         '❌ Błąd',
//         'Wystąpił błąd: ' + error.toString(),
//         SpreadsheetApp.getUi().ButtonSet.OK
//       );
//     }
//   }
// }

// function runLocalMapping() {
//   const ss = SpreadsheetApp.getActiveSpreadsheet();
//   const bulkSheet = ss.getSheetByName('BULK_Source');
  
//   if (!bulkSheet) {
//     throw new Error('Brak arkusza BULK_Source');
//   }
  
//   const bulkData = bulkSheet.getDataRange().getValues();
  
//   let builderSheet = ss.getSheetByName('BULK_Builder');
//   if (!builderSheet) {
//     builderSheet = ss.insertSheet('BULK_Builder');
//   }
  
//   builderSheet.clear();
  
//   const headers = bulkData[0];
//   const extendedHeaders = [...headers, '✅ Apply', '💡 Action', '📝 Reason', '% Change', '🎯 Confidence'];
  
//   builderSheet.getRange(1, 1, 1, extendedHeaders.length).setValues([extendedHeaders]);
//   builderSheet.getRange(1, 1, 1, extendedHeaders.length)
//     .setBackground('#4285f4')
//     .setFontColor('#ffffff')
//     .setFontWeight('bold');
  
//   const results = [];
//   const applyCol = headers.length;
  
//   for (let i = 1; i < Math.min(bulkData.length, 1000); i++) {
//     const row = [...bulkData[i]];
    
//     row.push(false);
//     row.push('');
//     row.push('');
//     row.push('');
//     row.push('');
    
//     results.push(row);
//   }
  
//   if (results.length > 0) {
//     builderSheet.getRange(2, 1, results.length, results[0].length).setValues(results);
    
//     const checkboxRule = SpreadsheetApp.newDataValidation()
//       .requireCheckbox()
//       .build();
//     builderSheet.getRange(2, applyCol + 1, results.length, 1).setDataValidation(checkboxRule);
//   }
  
//   SpreadsheetApp.getUi().alert('✅ Mapowanie zakończone', `Skopiowano ${results.length} wierszy`, SpreadsheetApp.getUi().ButtonSet.OK);
// }

// function runBulkAnalysisOnly() {
//   try {
//     Logger.log('=== URUCHAMIAM TYLKO ANALIZĘ ===');
    
//     const ui = SpreadsheetApp.getUi();
//     const response = ui.alert(
//       '⚠️ Ostrzeżenie',
//       'Analiza może nadpisać istniejące rekomendacje!\n\n' +
//       'Czy na pewno chcesz kontynuować?',
//       ui.ButtonSet.YES_NO
//     );
    
//     if (response === ui.Button.YES) {
//       if (typeof BulkAnalyzer !== 'undefined') {
//         const result = BulkAnalyzer.runAnalysis();
//         ui.alert('✅ Analiza zakończona', 
//           `Przeanalizowano ${result.enhanced || 0} targetów.\n` +
//           `Pominięto ${result.skipped || 0} z istniejącymi rekomendacjami.`,
//           ui.ButtonSet.OK);
//         return result;
//       } else {
//         ui.alert('ℹ️ Info', 'Moduł analizy niedostępny', ui.ButtonSet.OK);
//       }
//     } else {
//       Logger.log('Użytkownik anulował analizę');
//     }
//   } catch (error) {
//     Logger.log('BŁĄD w runBulkAnalysisOnly: ' + error.toString());
//     SpreadsheetApp.getUi().alert(
//       '❌ Błąd',
//       'Wystąpił błąd: ' + error.toString(),
//       SpreadsheetApp.getUi().ButtonSet.OK
//     );
//   }
// }

// function fixProductAdRecommendations() {
//   const ss = SpreadsheetApp.getActiveSpreadsheet();
//   const sheet = ss.getSheetByName('BULK_Builder');
  
//   if (!sheet) {
//     SpreadsheetApp.getUi().alert('❌ Błąd', 'Brak arkusza BULK_Builder', SpreadsheetApp.getUi().ButtonSet.OK);
//     return;
//   }
  
//   const data = sheet.getDataRange().getValues();
//   const headers = data[0];
  
//   const columns = {};
//   headers.forEach((h, i) => {
//     const header = h.toString().toLowerCase();
//     if (header.includes('entity')) columns.entity = i;
//     if (header.includes('action') || header.includes('recommendation')) columns.action = i;
//     if (header.includes('reason')) columns.reason = i;
//   });
  
//   let fixed = 0;
  
//   for (let i = 1; i < data.length; i++) {
//     const entity = (data[i][columns.entity] || '').toString().trim();
//     const currentAction = (data[i][columns.action] || '').toString();
    
//     if (entity === 'Product Ad' && currentAction.includes('BID')) {
//       sheet.getRange(i + 1, columns.action + 1).setValue('MONITOR');
//       sheet.getRange(i + 1, columns.reason + 1).setValue('Product Ad - brak kontroli bid');
//       sheet.getRange(i + 1, 1, 1, headers.length).setBackground('#f0f0f0');
//       fixed++;
//     }
    
//     if ((entity === 'Campaign' || entity === 'Ad Group' || entity === 'Bidding Adjustment') 
//         && currentAction && currentAction !== '') {
//       sheet.getRange(i + 1, columns.action + 1).setValue('');
//       sheet.getRange(i + 1, columns.reason + 1).setValue('Nie dotyczy - ' + entity);
//       fixed++;
//     }
    
//     if ((entity === 'Negative Keyword' || entity === 'Campaign Negative Keyword') 
//         && currentAction.includes('BID')) {
//       sheet.getRange(i + 1, columns.action + 1).setValue('ACTIVE_NEGATIVE');
//       sheet.getRange(i + 1, columns.reason + 1).setValue('Aktywny negatyw - działa poprawnie');
//       sheet.getRange(i + 1, 1, 1, headers.length).setBackground('#ffeeee');
//       fixed++;
//     }
//   }
  
//   SpreadsheetApp.getUi().alert(
//     fixed > 0 ? '✅ Naprawiono' : 'ℹ️ Info',
//     fixed > 0 ? `Poprawiono ${fixed} błędnych rekomendacji` : 'Nie znaleziono błędów do naprawienia',
//     SpreadsheetApp.getUi().ButtonSet.OK
//   );
// }

// // ===== FUNKCJE POMOCNICZE BULK =====

// function createBulkSheets() {
//   const ss = SpreadsheetApp.getActiveSpreadsheet();
//   const ui = SpreadsheetApp.getUi();
  
//   const sheetsToCreate = ['BULK_Source', 'BULK_Builder', 'BULK_Mapping', 'BULK_Negatives'];
//   let created = 0;
  
//   sheetsToCreate.forEach(sheetName => {
//     if (!ss.getSheetByName(sheetName)) {
//       ss.insertSheet(sheetName);
//       created++;
//     }
//   });
  
//   ui.alert(`✅ Utworzono ${created} arkuszy BULK`);
// }

// function openBulkSource() {
//   const ss = SpreadsheetApp.getActiveSpreadsheet();
//   const sheet = ss.getSheetByName('BULK_Source');
  
//   if (sheet) {
//     ss.setActiveSheet(sheet);
//     SpreadsheetApp.getUi().alert(
//       'ℹ️ BULK_Source',
//       'Wklej tu swój bulksheet pobrany z Amazon.\n\n' +
//       '⚠️ WAŻNE: Musi zawierać kolumnę "Entity" i ID kampanii!',
//       SpreadsheetApp.getUi().ButtonSet.OK
//     );
//   } else {
//     SpreadsheetApp.getUi().alert(
//       '❌ Błąd',
//       'Najpierw utwórz karty BULK (menu → BULK v2 Tools → 1)',
//       SpreadsheetApp.getUi().ButtonSet.OK
//     );
//   }
// }

// function initializeBulkWithHeaders() {
//   const ss = SpreadsheetApp.getActiveSpreadsheet();
//   const sourceSheet = ss.getSheetByName('BULK_Source');
  
//   if (!sourceSheet) {
//     SpreadsheetApp.getUi().alert('❌ Błąd', 'Brak arkusza BULK_Source', SpreadsheetApp.getUi().ButtonSet.OK);
//     return;
//   }
  
//   const data = sourceSheet.getDataRange().getValues();
//   if (data.length === 0) {
//     SpreadsheetApp.getUi().alert('❌ Błąd', 'BULK_Source jest pusty', SpreadsheetApp.getUi().ButtonSet.OK);
//     return;
//   }
  
//   let builderSheet = ss.getSheetByName('BULK_Builder');
//   if (!builderSheet) {
//     builderSheet = ss.insertSheet('BULK_Builder');
//   }
  
//   const headers = data[0];
//   const extendedHeaders = [...headers, '✅ Apply', '💡 Action', '📝 Reason', '% Change', '🎯 Confidence'];
  
//   builderSheet.clear();
//   builderSheet.getRange(1, 1, 1, extendedHeaders.length).setValues([extendedHeaders]);
//   builderSheet.getRange(1, 1, 1, extendedHeaders.length)
//     .setBackground('#4285f4')
//     .setFontColor('#ffffff')
//     .setFontWeight('bold');
  
//   SpreadsheetApp.getUi().alert('✅ Sukces', 'Zainicjalizowano BULK_Builder z nagłówkami', SpreadsheetApp.getUi().ButtonSet.OK);
// }

// function addNegativeKeywords() {
//   SpreadsheetApp.getUi().alert(
//     'ℹ️ W budowie',
//     'Funkcja dodawania negatywów będzie dostępna wkrótce',
//     SpreadsheetApp.getUi().ButtonSet.OK
//   );
// }

// function moveToPositiveKeywords() {
//   SpreadsheetApp.getUi().alert(
//     'ℹ️ W budowie',
//     'Funkcja przenoszenia do pozytywnych będzie dostępna wkrótce',
//     SpreadsheetApp.getUi().ButtonSet.OK
//   );
// }

// function selectAllTargets() {
//   try {
//     const manager = new BulkChangeManager();
//     const selected = manager.selectAll();
    
//     SpreadsheetApp.getUi().alert(
//       '✅ Zaznaczono',
//       `Zaznaczono ${selected} targetów (Keywords i Product Targeting)`,
//       SpreadsheetApp.getUi().ButtonSet.OK
//     );
//   } catch (error) {
//     SpreadsheetApp.getUi().alert('❌ Błąd', error.toString(), SpreadsheetApp.getUi().ButtonSet.OK);
//   }
// }

// function deselectAllTargets() {
//   try {
//     const manager = new BulkChangeManager();
//     manager.deselectAll();
    
//     SpreadsheetApp.getUi().alert(
//       '✅ Odznaczono',
//       'Wszystkie checkboxy zostały odznaczone',
//       SpreadsheetApp.getUi().ButtonSet.OK
//     );
//   } catch (error) {
//     SpreadsheetApp.getUi().alert('❌ Błąd', error.toString(), SpreadsheetApp.getUi().ButtonSet.OK);
//   }
// }

// function selectTargetsByCriteria() {
//   const ui = SpreadsheetApp.getUi();
  
//   const result = ui.alert(
//     '🎯 Zaznacz według kryterium',
//     'Wybierz kryterium:\n\n' +
//     '1️⃣ = Zyskowne (ACOS < 50% BE)\n' +
//     '2️⃣ = Stratne (ACOS > 200% BE)\n' +
//     '3️⃣ = Bez sprzedaży (0 orders, >20 clicks)\n\n' +
//     'Wybierz opcję:',
//     ui.ButtonSet.YES_NO_CANCEL
//   );
  
//   if (result === ui.Button.CANCEL) return;
  
//   let criteria;
//   if (result === ui.Button.YES) {
//     criteria = 'profitable';
//   } else if (result === ui.Button.NO) {
//     criteria = 'unprofitable';
//   } else {
//     return;
//   }
  
//   try {
//     const manager = new BulkChangeManager();
//     const selected = manager.selectByCriteria(criteria);
    
//     ui.alert('✅ Zaznaczono', `Zaznaczono ${selected} targetów`, ui.ButtonSet.OK);
//   } catch (error) {
//     ui.alert('❌ Błąd', error.toString(), ui.ButtonSet.OK);
//   }
// }

// function validateBulkData() {
//   const ss = SpreadsheetApp.getActiveSpreadsheet();
//   const sheet = ss.getSheetByName('BULK_Builder');
  
//   if (!sheet) {
//     SpreadsheetApp.getUi().alert('❌ Błąd', 'Brak arkusza BULK_Builder', SpreadsheetApp.getUi().ButtonSet.OK);
//     return;
//   }
  
//   const data = sheet.getDataRange().getValues();
//   let errors = [];
//   let warnings = [];
  
//   for (let i = 1; i < data.length; i++) {
//     const entity = data[i][1];
//     const action = data[i][data[0].length - 4];
    
//     if (entity === 'Product Ad' && action && action.includes('BID')) {
//       errors.push(`Wiersz ${i+1}: Product Ad nie może mieć zmian bid!`);
//     }
    
//     if (entity === 'Negative Keyword' && action && action.includes('BID')) {
//       warnings.push(`Wiersz ${i+1}: Negatyw nie powinien mieć zmian bid`);
//     }
//   }
  
//   const ui = SpreadsheetApp.getUi();
  
//   if (errors.length > 0 || warnings.length > 0) {
//     let message = '';
//     if (errors.length > 0) {
//       message += '❌ BŁĘDY:\n' + errors.slice(0, 5).join('\n') + '\n\n';
//     }
//     if (warnings.length > 0) {
//       message += '⚠️ OSTRZEŻENIA:\n' + warnings.slice(0, 5).join('\n');
//     }
    
//     ui.alert('Walidacja', message, ui.ButtonSet.OK);
//     return false;
//   } else {
//     ui.alert('✅ Walidacja OK', 'Dane są gotowe do eksportu', ui.ButtonSet.OK);
//     return true;
//   }
// }

// function clearAllBulkSheets() {
//   const ui = SpreadsheetApp.getUi();
//   const response = ui.alert(
//     '⚠️ Potwierdzenie',
//     'Czy na pewno chcesz wyczyścić wszystkie arkusze BULK?',
//     ui.ButtonSet.YES_NO
//   );
  
//   if (response === ui.Button.YES) {
//     const ss = SpreadsheetApp.getActiveSpreadsheet();
//     const sheetsToDelete = ['BULK_Source', 'BULK_Builder', 'BULK_Mapping', 'BULK_Negatives', 'BULK_Export', 'BULK_Changes_Log'];
//     let deleted = 0;
    
//     sheetsToDelete.forEach(sheetName => {
//       const sheet = ss.getSheetByName(sheetName);
//       if (sheet) {
//         ss.deleteSheet(sheet);
//         deleted++;
//       }
//     });
    
//     ui.alert('✅ Wyczyszczono', `Usunięto ${deleted} arkuszy BULK`, ui.ButtonSet.OK);
//   }
// }

// function showBulkStats() {
//   try {
//     const ss = SpreadsheetApp.getActiveSpreadsheet();
//     const sheet = ss.getSheetByName('BULK_Builder');
    
//     if (!sheet) {
//       throw new Error('Brak arkusza BULK_Builder');
//     }
    
//     const data = sheet.getDataRange().getValues();
//     const headers = data[0];
    
//     const entityCol = headers.findIndex(h => h.toString().toLowerCase().includes('entity'));
//     const actionCol = headers.indexOf('💡 Action');
//     const applyCol = headers.indexOf('✅ Apply');
    
//     const stats = {
//       total: data.length - 1,
//       byEntity: {},
//       byAction: {},
//       marked: 0
//     };
    
//     for (let i = 1; i < data.length; i++) {
//       const entity = data[i][entityCol];
//       const action = data[i][actionCol];
//       const apply = data[i][applyCol];
      
//       stats.byEntity[entity] = (stats.byEntity[entity] || 0) + 1;
      
//       if (action) {
//         stats.byAction[action] = (stats.byAction[action] || 0) + 1;
//       }
      
//       if (apply) stats.marked++;
//     }
    
//     let message = `📊 STATYSTYKI BULK\n\n`;
//     message += `Łącznie targetów: ${stats.total}\n`;
//     message += `Zaznaczonych do zmian: ${stats.marked}\n\n`;
    
//     message += `📋 PO TYPACH:\n`;
//     for (const [entity, count] of Object.entries(stats.byEntity).slice(0, 5)) {
//       message += `• ${entity}: ${count}\n`;
//     }
    
//     message += `\n💡 PO AKCJACH:\n`;
//     for (const [action, count] of Object.entries(stats.byAction).slice(0, 5)) {
//       message += `• ${action}: ${count}\n`;
//     }
    
//     SpreadsheetApp.getUi().alert('📊 Statystyki', message, SpreadsheetApp.getUi().ButtonSet.OK);
    
//   } catch (error) {
//     SpreadsheetApp.getUi().alert('❌ Błąd', error.toString(), SpreadsheetApp.getUi().ButtonSet.OK);
//   }
// }

// // ===== MAIN ANALYZER CLASS =====
// class LukoAnalyzer {
//   constructor() {
//     this.logger = new LukoLogger();
//     this.detector = new UltraReportDetector(this.logger);
//     this.integrator = new UltraDataIntegrator(this.logger);
//     this.calculator = new MetricsCalculator(this.logger);
//     this.reporter = null;
    
//     this.logger.log('✅ LukoAnalyzer V6.1 initialized', 'SUCCESS');
//   }
  
//   run(analysisType = 'textual') {
//     try {
//       this.logger.log(`🚀 STARTING ${analysisType.toUpperCase()} ANALYSIS - LUKO V6.1`, 'INFO');
      
//       // STEP 1: Wykrywanie raportów
//       this.logger.log('🔍 STEP 1: Report detection...', 'INFO');
//       const detectedReports = this.detector.detectReports();
      
//       if (detectedReports.length === 0) {
//         throw new Error('No valid reports found in the spreadsheet');
//       }
      
//       this.logger.log(`✅ Found ${detectedReports.length} reports`, 'SUCCESS');
      
//       // STEP 2: Walidacja jakości raportów
//       this.logger.log('📊 STEP 2: Validating report quality...', 'INFO');
//       const validReports = this.detector.validateReports(detectedReports);
//       this.logger.log(`✅ ${validReports.length} reports passed validation`, 'SUCCESS');
      
//       // STEP 3: Integracja danych
//       this.logger.log('🔗 STEP 3: Data integration...', 'INFO');
//       const integratedData = this.integrator.integrateData(validReports);
//       this.logger.log(`✅ Integration successful - Sales: ${integratedData.totals.sales}€, Spend: ${integratedData.totals.spend}€`, 'SUCCESS');
      
//       // STEP 4: Obliczanie metryk
//       this.logger.log('📊 STEP 4: Calculating metrics...', 'INFO');
//       const calculatedMetrics = this.calculator.calculateMetrics(integratedData);
//       this.logger.log(`✅ Metrics calculated - ACOS: ${calculatedMetrics.totals.acos.toFixed(1)}%`, 'SUCCESS');
      
//       // STEP 5: Generowanie raportu
//       this.logger.log('📝 STEP 5: Generating report...', 'INFO');
//       this.generateReport(calculatedMetrics, integratedData, analysisType);
      
//       this.logger.log('✅ ANALYSIS COMPLETED SUCCESSFULLY', 'SUCCESS');
//       this.logger.saveToSheet();
      
//       return calculatedMetrics;
      
//     } catch (error) {
//       this.logger.log(`💥 ANALYSIS FAILED: ${error.message}`, 'ERROR');
//       this.logger.saveToSheet();
//       throw error;
//     }
//   }
  
//   generateReport(metrics, integratedData, analysisType) {
//     try {
//       switch (analysisType.toLowerCase()) {
//         case 'textual':
//           this.reporter = new TextualReporter(this.logger);
//           this.reporter.generateReport(metrics, integratedData);
//           break;
          
//         case 'full':
//           this.reporter = new FullAnalyzer(this.logger);
//           this.reporter.generateFull(metrics, integratedData);
//           break;
          
//         case 'snapshot':
//           this.reporter = new SnapshotAnalyzer(this.logger);
//           this.reporter.generateSnapshot(metrics, integratedData);
//           break;
          
//         default:
//           throw new Error(`Unknown analysis type: ${analysisType}`);
//       }
//     } catch (error) {
//       this.logger.log(`Report generation failed: ${error.message}`, 'ERROR');
//       throw error;
//     }
//   }
// }

// // ===== MAIN MENU FUNCTIONS =====
// function generateTextualReport() {
//   try {
//     const analyzer = new LukoAnalyzer();
//     analyzer.run('textual');
//     SpreadsheetApp.getUi().alert('✅ Raport tekstowy wygenerowany pomyślnie!');
//   } catch (error) {
//     SpreadsheetApp.getUi().alert(`❌ Błąd: ${error.message}`);
//     console.error('Error in generateTextualReport:', error);
//   }
// }

// function generateFullAnalysis() {
//   try {
//     const analyzer = new LukoAnalyzer();
//     analyzer.run('full');
//     SpreadsheetApp.getUi().alert('✅ Pełna analiza wygenerowana pomyślnie!');
//   } catch (error) {
//     SpreadsheetApp.getUi().alert(`❌ Błąd: ${error.message}`);
//     console.error('Error in generateFullAnalysis:', error);
//   }
// }

// function generateSnapshot() {
//   try {
//     const analyzer = new LukoAnalyzer();
//     analyzer.run('snapshot');
//     SpreadsheetApp.getUi().alert('✅ Snapshot wygenerowany pomyślnie!');
//   } catch (error) {
//     SpreadsheetApp.getUi().alert(`❌ Błąd: ${error.message}`);
//     console.error('Error in generateSnapshot:', error);
//   }
// }

// // ===== ACOS SETTINGS =====
// function showAcosSettings() {
//   try {
//     const htmlOutput = HtmlService.createHtmlOutputFromFile('AcosSettings')
//       .setWidth(450)
//       .setHeight(400);
//     SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Ustawienia ACOS');
//   } catch (error) {
//     // Jeśli nie ma pliku HTML, pokaż prosty dialog
//     const ui = SpreadsheetApp.getUi();
//     const response = ui.prompt('Ustawienia ACOS', 
//       'Podaj wartość Break-Even ACOS (%):', 
//       ui.ButtonSet.OK_CANCEL);
    
//     if (response.getSelectedButton() == ui.Button.OK) {
//       const value = parseInt(response.getResponseText());
//       if (!isNaN(value) && value > 0 && value < 100) {
//         PropertiesService.getDocumentProperties().setProperty('ACOS_BREAK_EVEN', value.toString());
//         ui.alert(`✅ Zapisano Break-Even ACOS: ${value}%`);
//       } else {
//         ui.alert('❌ Nieprawidłowa wartość. Podaj liczbę między 1 a 99.');
//       }
//     }
//   }
// }

// function getAcosSettings() {
//   try {
//     const p = PropertiesService.getDocumentProperties();
//     let breakEven = Number(p.getProperty('ACOS_BREAK_EVEN') || 25);
//     let low = Number(p.getProperty('ACOS_LOW') || 15);
//     let high = Number(p.getProperty('ACOS_HIGH') || 40);

//     // Walidacja
//     if (!isFinite(breakEven) || breakEven <= 0 || breakEven >= 100) breakEven = 25;
//     if (!isFinite(low) || low < 0 || low >= 100) low = 15;
//     if (!isFinite(high) || high <= 0 || high > 100) high = 40;

//     // Upewnij się że low < breakEven < high
//     if (low >= breakEven) low = Math.max(0, breakEven - 10);
//     if (high <= breakEven) high = Math.min(100, breakEven + 15);

//     return { breakEven, low, high };
//   } catch (error) {
//     console.error('Error getting ACOS settings:', error);
//     return { breakEven: 25, low: 15, high: 40 };
//   }
// }

// function saveAcosSettings(breakEven, low, high) {
//   try {
//     let be = Number(breakEven), lo = Number(low), hi = Number(high);

//     if (!isFinite(be) || be <= 0 || be >= 100) return '❌ Nieprawidłowy break-even (1–99).';
//     if (!isFinite(lo) || lo < 0 || lo >= 100) return '❌ Nieprawidłowy niski ACOS (0–99).';
//     if (!isFinite(hi) || hi <= 0 || hi > 100) return '❌ Nieprawidłowy wysoki ACOS (1–100).';

//     // Upewnij się że low < breakEven < high
//     if (lo >= be) lo = Math.max(0, be - 10);
//     if (hi <= be) hi = Math.min(100, be + 15);

//     PropertiesService.getDocumentProperties().setProperties({
//       'ACOS_BREAK_EVEN': String(be),
//       'ACOS_LOW': String(lo),
//       'ACOS_HIGH': String(hi),
//     }, true);

//     return `✅ Ustawienia zapisane: Break-even=${be}%, Niski=${lo}%, Wysoki=${hi}%`;
//   } catch (error) {
//     return `❌ Błąd zapisu: ${error.message}`;
//   }
// }

// // ===== UTILITY FUNCTIONS =====
// function showDebugLog() {
//   try {
//     const ss = SpreadsheetApp.getActiveSpreadsheet();
//     const debugSheet = ss.getSheetByName(LUKO_CONFIG.SHEETS.DEBUG);
    
//     if (debugSheet) {
//       ss.setActiveSheet(debugSheet);
//       SpreadsheetApp.getUi().alert('✅ Debug log opened!');
//     } else {
//       SpreadsheetApp.getUi().alert('No debug log found. Run an analysis first.');
//     }
//   } catch (error) {
//     SpreadsheetApp.getUi().alert(`❌ Błąd: ${error.message}`);
//     console.error('Error showing debug log:', error);
//   }
// }

// function clearAllData() {
//   try {
//     const ui = SpreadsheetApp.getUi();
//     const result = ui.alert(
//       'Potwierdzenie',
//       'Czy na pewno chcesz usunąć wszystkie arkusze LUKO?',
//       ui.ButtonSet.YES_NO
//     );
    
//     if (result == ui.Button.YES) {
//       const ss = SpreadsheetApp.getActiveSpreadsheet();
//       const sheets = ss.getSheets();
      
//       let deletedCount = 0;
//       sheets.forEach(sheet => {
//         if (sheet.getName().startsWith(LUKO_CONFIG.SHEET_PREFIX)) {
//           try {
//             ss.deleteSheet(sheet);
//             deletedCount++;
//           } catch (error) {
//             console.error(`Error deleting sheet ${sheet.getName()}:`, error);
//           }
//         }
//       });
      
//       ui.alert(`✅ Usunięto ${deletedCount} arkuszy LUKO`);
//     }
//   } catch (error) {
//     SpreadsheetApp.getUi().alert(`❌ Błąd: ${error.message}`);
//     console.error('Error clearing data:', error);
//   }
// }

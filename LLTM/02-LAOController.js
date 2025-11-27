/**
 * LLTM LAO Controller
 * Controls LAO spreadsheet operations for testing
 * @version 1.0
 */

const LAOController = {

  /**
   * Initialize LAO sheets for testing
   * Creates or clears test sheets
   */
  initializeTestEnvironment() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const requiredSheets = [
      LLTM_CONFIG.LAO_SHEETS.BULK_SOURCE,
      LLTM_CONFIG.LAO_SHEETS.BULK_BUILDER
    ];

    const result = {
      success: true,
      sheetsReady: [],
      errors: []
    };

    requiredSheets.forEach(sheetName => {
      try {
        let sheet = ss.getSheetByName(sheetName);
        if (!sheet) {
          sheet = ss.insertSheet(sheetName);
        } else {
          sheet.clear();
        }
        result.sheetsReady.push(sheetName);
      } catch (error) {
        result.success = false;
        result.errors.push(`Failed to initialize ${sheetName}: ${error.message}`);
      }
    });

    return result;
  },

  /**
   * Paste test data into BULK_Source
   * @param {Array} data - 2D array of data
   * @returns {Object} Result with timing
   */
  pasteTestData(data, targetSheet = 'BULK_Source') {
    const startTime = new Date().getTime();
    const result = {
      success: false,
      rowsPasted: 0,
      columnsPasted: 0,
      duration: 0,
      error: null
    };

    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      let sheet = ss.getSheetByName(targetSheet);

      if (!sheet) {
        sheet = ss.insertSheet(targetSheet);
      }

      // Clear existing data
      sheet.clear();

      // Paste data
      if (data && data.length > 0 && data[0].length > 0) {
        const range = sheet.getRange(1, 1, data.length, data[0].length);
        range.setValues(data);

        result.rowsPasted = data.length;
        result.columnsPasted = data[0].length;
        result.success = true;
      }

    } catch (error) {
      result.error = error.message;
    }

    result.duration = new Date().getTime() - startTime;
    return result;
  },

  /**
   * Execute a LAO function and capture results
   * @param {string} functionName - Name of the LAO function to call
   * @param {Object} params - Parameters for the function
   * @returns {Object} Execution result with timing
   */
  executeLAOFunction(functionName, params = {}) {
    const startTime = new Date().getTime();
    const result = {
      success: false,
      functionName: functionName,
      duration: 0,
      output: null,
      error: null,
      timeout: false
    };

    try {
      // Map function names to actual LAO functions
      const functionMap = {
        // BULK operations
        'pauseZeroSales': () => this.simulatePauseZeroSales(params),
        'applyBidChanges': () => this.simulateBidChanges(params),
        'addNegatives': () => this.simulateAddNegatives(params),
        'adjustBudgets': () => this.simulateBudgetChanges(params),
        'runBulkAnalysis': () => this.simulateBulkAnalysis(params),
        'validateBulkData': () => this.simulateValidation(params),
        'exportToAmazon': () => this.simulateExport(params),

        // Analysis operations
        'generateFullAnalysis': () => this.simulateFullAnalysis(params),
        'generateTextualReport': () => this.simulateTextualReport(params),
        'generateSnapshot': () => this.simulateSnapshot(params),

        // Mapping operations
        'mapColumns': () => this.simulateColumnMapping(params),
        'detectReportType': () => this.simulateReportDetection(params)
      };

      if (!functionMap[functionName]) {
        throw new Error(`Unknown function: ${functionName}`);
      }

      // Execute with timeout check
      const timeoutMs = params.timeout || LLTM_CONFIG.TIMEOUTS.FUNCTION_TIMEOUT;
      result.output = functionMap[functionName]();

      // Check if we're approaching timeout
      const elapsed = new Date().getTime() - startTime;
      if (elapsed > timeoutMs) {
        result.timeout = true;
      }

      result.success = true;

    } catch (error) {
      result.error = error.message;
      result.success = false;
    }

    result.duration = new Date().getTime() - startTime;
    return result;
  },

  /**
   * Simulate pause zero sales operation
   */
  simulatePauseZeroSales(params) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(LLTM_CONFIG.LAO_SHEETS.BULK_BUILDER);

    if (!sheet || sheet.getLastRow() < 2) {
      return { pausedCount: 0, error: 'No data in BULK_Builder' };
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    // Find columns
    const stateCol = this.findColumn(headers, ['State', 'Status']);
    const recommendationCol = this.findColumn(headers, ['💡 Recommendation', 'Recommendation']);
    const checkboxCol = this.findColumn(headers, ['✅ Apply Change', 'Apply Change', 'Apply']);
    const salesCol = this.findColumn(headers, ['7 Day Total Sales', 'Sales', 'Total Sales']);

    if (stateCol === -1) {
      return { pausedCount: 0, error: 'State column not found' };
    }

    // Collect rows to pause
    const rowsToPause = [];
    const updates = {
      states: [],
      checkboxes: [],
      backgrounds: []
    };

    for (let i = 1; i < data.length; i++) {
      const recommendation = recommendationCol >= 0 ? data[i][recommendationCol] : '';
      const sales = salesCol >= 0 ? this.parseNumber(data[i][salesCol]) : -1;

      // Check if row should be paused
      const shouldPause = recommendation === 'PAUSE' ||
                         (sales === 0 && params.pauseZeroSales !== false);

      if (shouldPause) {
        rowsToPause.push(i + 1);
        updates.states.push([i + 1, stateCol + 1, 'paused']);
        if (checkboxCol >= 0) {
          updates.checkboxes.push([i + 1, checkboxCol + 1, true]);
        }
      }
    }

    // Apply changes in batch
    updates.states.forEach(([row, col, value]) => {
      sheet.getRange(row, col).setValue(value);
      sheet.getRange(row, col).setBackground(LLTM_CONFIG.COLORS.FAILURE);
    });

    updates.checkboxes.forEach(([row, col, value]) => {
      sheet.getRange(row, col).setValue(value);
    });

    return {
      pausedCount: rowsToPause.length,
      pausedRows: rowsToPause,
      totalRows: data.length - 1
    };
  },

  /**
   * Simulate bid changes operation
   */
  simulateBidChanges(params) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(LLTM_CONFIG.LAO_SHEETS.BULK_BUILDER);

    if (!sheet || sheet.getLastRow() < 2) {
      return { changedCount: 0, error: 'No data in BULK_Builder' };
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    const bidCol = this.findColumn(headers, ['Bid']);
    const checkboxCol = this.findColumn(headers, ['✅ Apply Change', 'Apply Change', 'Apply']);

    if (bidCol === -1) {
      return { changedCount: 0, error: 'Bid column not found' };
    }

    const changeType = params.changeType || 'percent_increase';
    const changeValue = params.value || 15;

    let changedCount = 0;
    const originalBids = [];
    const newBids = [];

    // Find rows to change (with checkbox or all)
    for (let i = 1; i < data.length; i++) {
      const shouldChange = checkboxCol >= 0 ? data[i][checkboxCol] === true : true;

      if (shouldChange) {
        const currentBid = this.parseNumber(data[i][bidCol]);
        originalBids.push(currentBid);

        if (currentBid > 0) {
          let newBid = currentBid;

          switch (changeType) {
            case 'percent_increase':
              newBid = currentBid * (1 + changeValue / 100);
              break;
            case 'percent_decrease':
              newBid = currentBid * (1 - changeValue / 100);
              break;
            case 'amount_increase':
              newBid = currentBid + changeValue;
              break;
            case 'amount_decrease':
              newBid = currentBid - changeValue;
              break;
            case 'set_bid':
              newBid = changeValue;
              break;
          }

          // Validate range
          newBid = Math.max(0.02, Math.min(100, newBid));
          newBid = Math.round(newBid * 100) / 100;

          sheet.getRange(i + 1, bidCol + 1).setValue(newBid);
          newBids.push(newBid);
          changedCount++;

          // Color coding
          if (newBid > currentBid) {
            sheet.getRange(i + 1, bidCol + 1).setBackground(LLTM_CONFIG.COLORS.SUCCESS);
          } else if (newBid < currentBid) {
            sheet.getRange(i + 1, bidCol + 1).setBackground('#ffe6cc');
          }
        }
      }
    }

    return {
      changedCount: changedCount,
      originalBids: originalBids,
      newBids: newBids,
      changeType: changeType,
      changeValue: changeValue,
      totalRows: data.length - 1
    };
  },

  /**
   * Simulate add negatives operation
   */
  simulateAddNegatives(params) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(LLTM_CONFIG.LAO_SHEETS.BULK_BUILDER);

    if (!sheet || sheet.getLastRow() < 2) {
      return { addedCount: 0, error: 'No data in BULK_Builder' };
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    const recommendationCol = this.findColumn(headers, ['💡 Recommendation', 'Recommendation']);
    const keywordCol = this.findColumn(headers, ['Keyword Text', 'Customer Search Term']);
    const adGroupCol = this.findColumn(headers, ['Ad Group Name']);
    const campaignCol = this.findColumn(headers, ['Campaign Name']);

    const negativesToAdd = [];

    for (let i = 1; i < data.length; i++) {
      const recommendation = recommendationCol >= 0 ? data[i][recommendationCol] : '';

      if (recommendation === 'ADD_NEGATIVE') {
        negativesToAdd.push({
          keyword: keywordCol >= 0 ? data[i][keywordCol] : '',
          adGroup: adGroupCol >= 0 ? data[i][adGroupCol] : '',
          campaign: campaignCol >= 0 ? data[i][campaignCol] : '',
          row: i + 1
        });
      }
    }

    // Create negatives sheet
    if (negativesToAdd.length > 0) {
      let negativesSheet = ss.getSheetByName(LLTM_CONFIG.LAO_SHEETS.BULK_NEGATIVES);
      if (!negativesSheet) {
        negativesSheet = ss.insertSheet(LLTM_CONFIG.LAO_SHEETS.BULK_NEGATIVES);
      } else {
        negativesSheet.clear();
      }

      const negHeaders = [
        'Product', 'Entity', 'Operation', 'Campaign ID', 'Ad Group ID',
        'Campaign Name', 'Ad Group Name', 'Keyword Text', 'Match Type', 'State'
      ];

      const negData = [negHeaders];
      negativesToAdd.forEach(item => {
        negData.push([
          'Sponsored Products',
          'Negative Keyword',
          'create',
          '',
          '',
          item.campaign,
          item.adGroup,
          item.keyword,
          'negative exact',
          'enabled'
        ]);
      });

      negativesSheet.getRange(1, 1, negData.length, negData[0].length).setValues(negData);
    }

    return {
      addedCount: negativesToAdd.length,
      negatives: negativesToAdd,
      totalRows: data.length - 1
    };
  },

  /**
   * Simulate budget changes operation
   */
  simulateBudgetChanges(params) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(LLTM_CONFIG.LAO_SHEETS.BULK_BUILDER);

    if (!sheet || sheet.getLastRow() < 2) {
      return { changedCount: 0, error: 'No data in BULK_Builder' };
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    const campaignCol = this.findColumn(headers, ['Campaign Name']);
    const budgetCol = this.findColumn(headers, ['Daily Budget', 'Budget', 'Campaign Daily Budget']);
    const acosCol = this.findColumn(headers, ['ACOS', 'Total ACOS']);

    if (budgetCol === -1) {
      return { changedCount: 0, error: 'Budget column not found' };
    }

    const changePercent = params.changePercent || 20;
    const acosThreshold = params.acosThreshold || 20;

    // Aggregate by campaign
    const campaigns = {};

    for (let i = 1; i < data.length; i++) {
      const campaignName = campaignCol >= 0 ? data[i][campaignCol] : `Campaign_${i}`;
      const budget = this.parseNumber(data[i][budgetCol]);
      const acos = this.parseNumber(data[i][acosCol]);

      if (!campaigns[campaignName]) {
        campaigns[campaignName] = {
          budget: budget,
          acos: acos,
          rows: []
        };
      }
      campaigns[campaignName].rows.push(i + 1);
    }

    // Apply changes
    let changedCount = 0;
    const changes = [];

    Object.entries(campaigns).forEach(([name, campaign]) => {
      if (campaign.acos > acosThreshold) {
        const newBudget = Math.round(campaign.budget * (1 + changePercent / 100) * 100) / 100;

        campaign.rows.forEach(row => {
          sheet.getRange(row, budgetCol + 1).setValue(newBudget);
          sheet.getRange(row, budgetCol + 1).setBackground(LLTM_CONFIG.COLORS.SUCCESS);
        });

        changes.push({
          campaign: name,
          oldBudget: campaign.budget,
          newBudget: newBudget,
          acos: campaign.acos
        });

        changedCount++;
      }
    });

    return {
      changedCount: changedCount,
      changes: changes,
      totalCampaigns: Object.keys(campaigns).length
    };
  },

  /**
   * Simulate bulk analysis operation
   */
  simulateBulkAnalysis(params) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sourceSheet = ss.getSheetByName(LLTM_CONFIG.LAO_SHEETS.BULK_SOURCE);
    let builderSheet = ss.getSheetByName(LLTM_CONFIG.LAO_SHEETS.BULK_BUILDER);

    if (!sourceSheet || sourceSheet.getLastRow() < 2) {
      return { success: false, error: 'No data in BULK_Source' };
    }

    // Create builder if not exists
    if (!builderSheet) {
      builderSheet = ss.insertSheet(LLTM_CONFIG.LAO_SHEETS.BULK_BUILDER);
    }

    const sourceData = sourceSheet.getDataRange().getValues();
    const headers = sourceData[0];

    // Add analysis columns
    const analysisColumns = ['💡 Recommendation', '📊 Confidence', '📝 Reason', '✅ Apply Change'];
    const newHeaders = [...headers, ...analysisColumns];

    const builderData = [newHeaders];

    for (let i = 1; i < sourceData.length; i++) {
      const row = [...sourceData[i]];

      // Analyze row
      const analysis = this.analyzeRow(sourceData[i], headers);
      row.push(analysis.recommendation);
      row.push(analysis.confidence);
      row.push(analysis.reason);
      row.push(false);

      builderData.push(row);
    }

    // Write to builder
    builderSheet.clear();
    builderSheet.getRange(1, 1, builderData.length, builderData[0].length).setValues(builderData);

    return {
      success: true,
      rowsAnalyzed: builderData.length - 1,
      recommendations: {
        INCREASE_BID: builderData.filter(r => r[newHeaders.indexOf('💡 Recommendation')] === 'INCREASE_BID').length - 1,
        DECREASE_BID: builderData.filter(r => r[newHeaders.indexOf('💡 Recommendation')] === 'DECREASE_BID').length - 1,
        PAUSE: builderData.filter(r => r[newHeaders.indexOf('💡 Recommendation')] === 'PAUSE').length - 1,
        ADD_NEGATIVE: builderData.filter(r => r[newHeaders.indexOf('💡 Recommendation')] === 'ADD_NEGATIVE').length - 1,
        KEEP: builderData.filter(r => r[newHeaders.indexOf('💡 Recommendation')] === 'KEEP').length - 1
      }
    };
  },

  /**
   * Analyze a single row and return recommendation
   */
  analyzeRow(row, headers) {
    const salesCol = this.findColumn(headers, ['7 Day Total Sales', 'Sales']);
    const spendCol = this.findColumn(headers, ['Spend', 'Cost']);
    const clicksCol = this.findColumn(headers, ['Clicks']);
    const acosCol = this.findColumn(headers, ['ACOS', 'Total ACOS']);

    const sales = salesCol >= 0 ? this.parseNumber(row[salesCol]) : 0;
    const spend = spendCol >= 0 ? this.parseNumber(row[spendCol]) : 0;
    const clicks = clicksCol >= 0 ? this.parseNumber(row[clicksCol]) : 0;
    const acos = acosCol >= 0 ? this.parseNumber(row[acosCol]) : 0;

    // Simple analysis logic
    if (sales === 0 && clicks >= 10 && spend >= 5) {
      return {
        recommendation: 'PAUSE',
        confidence: '95%',
        reason: 'Zero sales with significant spend'
      };
    }

    if (acos > 50) {
      return {
        recommendation: 'DECREASE_BID',
        confidence: '85%',
        reason: 'High ACOS - reduce bid'
      };
    }

    if (acos > 0 && acos < 15) {
      return {
        recommendation: 'INCREASE_BID',
        confidence: '80%',
        reason: 'Low ACOS - profitable target'
      };
    }

    if (clicks >= 50 && sales === 0) {
      return {
        recommendation: 'ADD_NEGATIVE',
        confidence: '90%',
        reason: 'Many clicks, no conversion'
      };
    }

    return {
      recommendation: 'KEEP',
      confidence: '70%',
      reason: 'Normal performance'
    };
  },

  /**
   * Simulate column mapping validation
   */
  simulateColumnMapping(params) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(params.sheetName || LLTM_CONFIG.LAO_SHEETS.BULK_SOURCE);

    if (!sheet || sheet.getLastRow() < 1) {
      return { success: false, error: 'Sheet not found or empty' };
    }

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const mappingResults = {};

    // Try to map each required column
    Object.entries(LLTM_CONFIG.COLUMN_ALIASES).forEach(([key, aliases]) => {
      const foundCol = this.findColumn(headers, aliases);
      mappingResults[key] = {
        found: foundCol >= 0,
        columnIndex: foundCol,
        matchedAlias: foundCol >= 0 ? headers[foundCol] : null,
        testedAliases: aliases
      };
    });

    const foundCount = Object.values(mappingResults).filter(r => r.found).length;
    const totalCount = Object.keys(mappingResults).length;

    return {
      success: foundCount > 0,
      mappingResults: mappingResults,
      foundCount: foundCount,
      totalCount: totalCount,
      percentage: Math.round((foundCount / totalCount) * 100)
    };
  },

  /**
   * Simulate validation operation
   */
  simulateValidation(params) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(LLTM_CONFIG.LAO_SHEETS.BULK_BUILDER);

    if (!sheet || sheet.getLastRow() < 2) {
      return { valid: false, error: 'No data in BULK_Builder' };
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    const errors = [];
    const warnings = [];

    // Check for required columns
    const requiredColumns = ['Campaign Name', 'Ad Group Name', 'Bid', 'State'];
    requiredColumns.forEach(col => {
      if (this.findColumn(headers, [col]) === -1) {
        errors.push(`Missing required column: ${col}`);
      }
    });

    // Check data validity
    const bidCol = this.findColumn(headers, ['Bid']);
    const stateCol = this.findColumn(headers, ['State', 'Status']);

    for (let i = 1; i < data.length; i++) {
      // Check bid range
      if (bidCol >= 0) {
        const bid = this.parseNumber(data[i][bidCol]);
        if (bid < 0.02 || bid > 100) {
          warnings.push(`Row ${i + 1}: Bid out of range (${bid})`);
        }
      }

      // Check state values
      if (stateCol >= 0) {
        const state = data[i][stateCol];
        if (state && !['enabled', 'paused', 'archived'].includes(state.toLowerCase())) {
          warnings.push(`Row ${i + 1}: Invalid state value (${state})`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors,
      warnings: warnings,
      rowsValidated: data.length - 1
    };
  },

  /**
   * Simulate export operation
   */
  simulateExport(params) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(LLTM_CONFIG.LAO_SHEETS.BULK_BUILDER);

    if (!sheet || sheet.getLastRow() < 2) {
      return { success: false, error: 'No data in BULK_Builder' };
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    // Filter rows with changes (checkbox checked)
    const checkboxCol = this.findColumn(headers, ['✅ Apply Change', 'Apply Change', 'Apply']);

    let rowsToExport = [];
    for (let i = 1; i < data.length; i++) {
      const shouldExport = checkboxCol >= 0 ? data[i][checkboxCol] === true : true;
      if (shouldExport) {
        rowsToExport.push(data[i]);
      }
    }

    // Remove analysis columns (emoji-prefixed)
    const exportHeaders = headers.filter(h => !h.startsWith('💡') && !h.startsWith('📊') && !h.startsWith('📝') && !h.startsWith('✅'));
    const exportColIndices = headers.map((h, i) => exportHeaders.includes(h) ? i : -1).filter(i => i >= 0);

    const exportData = [exportHeaders];
    rowsToExport.forEach(row => {
      const exportRow = exportColIndices.map(i => row[i]);
      exportData.push(exportRow);
    });

    // Check if required Amazon columns are present
    const requiredAmazonColumns = ['Product', 'Entity', 'Operation', 'Campaign Id', 'Campaign Name', 'State'];
    const missingColumns = requiredAmazonColumns.filter(col =>
      this.findColumn(exportHeaders, [col]) === -1
    );

    return {
      success: missingColumns.length === 0,
      exportedRows: rowsToExport.length,
      totalRows: data.length - 1,
      exportHeaders: exportHeaders,
      missingColumns: missingColumns,
      exportData: exportData
    };
  },

  /**
   * Simulate full analysis operation
   */
  simulateFullAnalysis(params) {
    // This would call the actual LukoAnalyzer, but for testing we simulate
    return {
      success: true,
      metrics: {
        impressions: 100000,
        clicks: 5000,
        spend: 2500,
        sales: 7500,
        orders: 150,
        acos: 33.33,
        roas: 3.0
      },
      recommendations: [
        'Optimize high-ACOS targets',
        'Increase bids on profitable keywords',
        'Pause zero-sales targets'
      ]
    };
  },

  /**
   * Simulate textual report operation
   */
  simulateTextualReport(params) {
    return {
      success: true,
      reportGenerated: true,
      sections: ['Summary', 'Performance', 'Recommendations']
    };
  },

  /**
   * Simulate snapshot operation
   */
  simulateSnapshot(params) {
    return {
      success: true,
      snapshotGenerated: true,
      timestamp: new Date().toISOString()
    };
  },

  /**
   * Simulate report type detection
   */
  simulateReportDetection(params) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(params.sheetName || LLTM_CONFIG.LAO_SHEETS.BULK_SOURCE);

    if (!sheet || sheet.getLastRow() < 1) {
      return { success: false, error: 'Sheet not found or empty' };
    }

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const headerString = headers.join('|').toLowerCase();
    const columnCount = headers.length;

    let reportType = 'UNKNOWN';
    let confidence = 0;

    if (headerString.includes('customer search term') && columnCount >= 15) {
      reportType = 'SP_SEARCH_TERM';
      confidence = 95;
    } else if (headerString.includes('keyword id') && columnCount >= 40) {
      reportType = 'SP_CAMPAIGNS';
      confidence = 95;
    } else if (headerString.includes('targeting')) {
      reportType = 'SPONSORED_PRODUCTS';
      confidence = 85;
    }

    return {
      success: true,
      reportType: reportType,
      confidence: confidence,
      columnCount: columnCount,
      headers: headers
    };
  },

  /**
   * Get results from a specific sheet
   * @param {string} sheetName - Sheet to read from
   * @param {Array} columns - Specific columns to read (optional)
   * @returns {Object} Sheet data
   */
  getSheetResults(sheetName, columns = null) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet || sheet.getLastRow() < 1) {
      return { success: false, error: `Sheet ${sheetName} not found or empty` };
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    // If specific columns requested, filter
    if (columns && columns.length > 0) {
      const colIndices = columns.map(col => {
        const idx = this.findColumn(headers, [col]);
        return { name: col, index: idx, found: idx >= 0 };
      });

      const filteredData = data.map(row =>
        colIndices.map(c => c.found ? row[c.index] : null)
      );

      return {
        success: true,
        data: filteredData,
        headers: columns,
        columnInfo: colIndices,
        rowCount: data.length - 1
      };
    }

    return {
      success: true,
      data: data,
      headers: headers,
      rowCount: data.length - 1
    };
  },

  /**
   * Count rows matching criteria
   */
  countRowsWithCriteria(sheetName, criteria) {
    const result = this.getSheetResults(sheetName);
    if (!result.success) return 0;

    let count = 0;
    const headers = result.headers;

    for (let i = 1; i < result.data.length; i++) {
      let matches = true;

      for (const [column, condition] of Object.entries(criteria)) {
        const colIdx = this.findColumn(headers, [column]);
        if (colIdx === -1) {
          matches = false;
          break;
        }

        const value = result.data[i][colIdx];

        if (typeof condition === 'function') {
          if (!condition(value)) matches = false;
        } else if (condition !== value) {
          matches = false;
        }

        if (!matches) break;
      }

      if (matches) count++;
    }

    return count;
  },

  /**
   * Helper: Find column by aliases
   */
  findColumn(headers, aliases) {
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i].toString().toLowerCase().trim();
      for (const alias of aliases) {
        if (header === alias.toLowerCase().trim()) {
          return i;
        }
      }
    }
    return -1;
  },

  /**
   * Helper: Parse number from various formats
   */
  parseNumber(value) {
    if (typeof value === 'number') return value;
    if (!value) return 0;

    const str = value.toString().trim();

    // Remove currency symbols and percentage signs
    let cleaned = str.replace(/[€$£¥%]/g, '').trim();

    // Handle EU format (1.234,56)
    if (cleaned.includes(',') && cleaned.includes('.')) {
      // Determine which is decimal separator
      const lastComma = cleaned.lastIndexOf(',');
      const lastDot = cleaned.lastIndexOf('.');

      if (lastComma > lastDot) {
        // EU format: dot is thousand separator, comma is decimal
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
      } else {
        // US format: comma is thousand separator
        cleaned = cleaned.replace(/,/g, '');
      }
    } else if (cleaned.includes(',') && !cleaned.includes('.')) {
      // Only comma - could be EU decimal
      const parts = cleaned.split(',');
      if (parts.length === 2 && parts[1].length <= 2) {
        cleaned = cleaned.replace(',', '.');
      } else {
        cleaned = cleaned.replace(/,/g, '');
      }
    }

    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  },

  /**
   * Clean up test environment
   */
  cleanupTestEnvironment() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetsToClean = [
      LLTM_CONFIG.LAO_SHEETS.BULK_SOURCE,
      LLTM_CONFIG.LAO_SHEETS.BULK_BUILDER,
      LLTM_CONFIG.LAO_SHEETS.BULK_NEGATIVES
    ];

    sheetsToClean.forEach(sheetName => {
      const sheet = ss.getSheetByName(sheetName);
      if (sheet) {
        sheet.clear();
      }
    });

    return { success: true, cleanedSheets: sheetsToClean };
  }
};

// Export for GAS
if (typeof module !== 'undefined') {
  module.exports = { LAOController };
}

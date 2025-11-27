/**
 * LLTM Main Orchestrator
 * Main entry point for LUKO LAO Test Machine
 * @version 1.0
 */

/**
 * Add LLTM menu to spreadsheet
 */
function onOpen_LLTM() {
  const ui = SpreadsheetApp.getUi();

  ui.createMenu('🧪 LLTM')
    .addItem('▶️ Run All Tests', 'runAllTests')
    .addItem('▶️ Run Critical Tests (Group A)', 'runCriticalTests')
    .addSeparator()
    .addSubMenu(ui.createMenu('Individual Tests')
      .addItem('T001: Row Selection', 'runTest_RowSelection')
      .addItem('T002: Bid Changes', 'runTest_BidChanges')
      .addItem('T003: Pause Targets', 'runTest_PauseTargets')
      .addItem('T004: Full Analysis', 'runTest_FullAnalysis')
      .addItem('T005: Column Mapping', 'runTest_ColumnMapping')
      .addItem('T006: Export to Amazon', 'runTest_Export')
      .addItem('T007: Budget Changes', 'runTest_BudgetChanges')
    )
    .addSeparator()
    .addItem('📊 View Test Results', 'showTestResults')
    .addItem('📈 View History', 'showTestHistory')
    .addItem('🔍 Analyze Failures', 'analyzeLastFailures')
    .addSeparator()
    .addItem('🗑️ Clear Test Data', 'clearTestData')
    .addItem('ℹ️ About LLTM', 'showAbout')
    .addToUi();
}

/**
 * Main LLTM Test Runner class
 */
const LLTMRunner = {

  /**
   * Run all tests
   */
  runAll(options = {}) {
    const startTime = new Date();
    console.log('🚀 LUKO LAO TEST MACHINE - STARTED');
    console.log('━'.repeat(50));

    const results = [];
    const testGroups = options.groups || ['A', 'B'];

    // Initialize test environment
    console.log('📦 Initializing test environment...');
    const initResult = LAOController.initializeTestEnvironment();
    if (!initResult.success) {
      console.log('❌ Failed to initialize: ' + initResult.errors.join(', '));
      return null;
    }

    // Run tests for each group
    testGroups.forEach(group => {
      const groupConfig = LLTM_CONFIG.TEST_GROUPS[group];
      if (!groupConfig) return;

      console.log('');
      console.log(`TEST SUITE: ${groupConfig.name} (Group ${group})`);
      console.log('━'.repeat(50));

      groupConfig.tests.forEach((testId, index) => {
        console.log(`[${index + 1}/${groupConfig.tests.length}] Running ${testId}...`);

        const result = this.runSingleTest(testId, group);
        results.push(result);

        // Log result
        console.log(`   ${result.status} (${result.score}%)`);
        if (result.status !== LLTM_CONFIG.STATUS.PASS && result.anomalies?.length > 0) {
          result.anomalies.forEach(a => console.log(`   ⚠️ ${a}`));
        }
      });
    });

    // Generate report
    const metadata = {
      startTime: startTime,
      endTime: new Date(),
      groups: testGroups
    };

    // Check for regression
    const currentReport = {
      timestamp: new Date(),
      version: LLTM_CONFIG.VERSION,
      results: results,
      summary: Reporter.calculateSummary(results)
    };

    const regression = HistoryManager.detectRegression(currentReport);
    if (regression.isRegression) {
      metadata.regression = regression;
      console.log('');
      console.log('⚠️ REGRESSION DETECTED!');
    }

    // Generate full report
    const report = Reporter.generateReport(results, metadata);

    // Save to history
    HistoryManager.saveToHistory(report);

    // Show completion message
    const duration = (new Date().getTime() - startTime.getTime()) / 1000;
    SpreadsheetApp.getActiveSpreadsheet().toast(
      `Tests completed: ${report.summary.passed}/${report.summary.total} passed (${duration.toFixed(1)}s)`,
      '🧪 LLTM',
      5
    );

    return report;
  },

  /**
   * Run a single test
   */
  runSingleTest(testId, group = 'A') {
    const scenario = TEST_SCENARIOS[testId];
    if (!scenario) {
      return {
        testId: testId,
        testName: 'Unknown Test',
        group: group,
        status: LLTM_CONFIG.STATUS.ERROR,
        score: 0,
        error: 'Test scenario not found'
      };
    }

    const startTime = new Date().getTime();
    const result = {
      testId: scenario.id,
      testName: scenario.name,
      group: group,
      description: scenario.description,
      status: LLTM_CONFIG.STATUS.RUNNING,
      score: 0,
      expected: null,
      actual: null,
      assertions: [],
      anomalies: [],
      possibleCauses: scenario.possibleCauses || [],
      duration: 0
    };

    try {
      // Generate test data
      const testData = this.generateTestData(testId, scenario);

      // Paste test data
      const pasteResult = LAOController.pasteTestData(testData.data);
      if (!pasteResult.success) {
        throw new Error('Failed to paste test data: ' + pasteResult.error);
      }

      // If data goes to BULK_Source, also run analysis to populate BULK_Builder
      if (testId !== 'column_mapping') {
        const analysisResult = LAOController.executeLAOFunction('runBulkAnalysis');
        if (!analysisResult.success) {
          // Continue anyway - some tests don't need analysis
        }
      }

      // Execute the test function
      const functionResult = this.executeLAOTestFunction(testId, scenario);

      // Get results from sheets
      const sheetResults = this.getTestResults(testId, testData.metadata);

      // Set expected and actual
      result.expected = this.getExpectedValue(testId, testData.metadata);
      result.actual = this.getActualValue(testId, sheetResults);

      // Run assertions
      const assertionResult = AssertionEngine.runAssertions(
        scenario.id,
        { ...sheetResults, ...functionResult.output },
        { ...scenario, ...testData.metadata }
      );

      result.assertions = assertionResult.assertions;
      result.score = assertionResult.score;
      result.status = assertionResult.status;
      result.anomalies = assertionResult.anomalies;

      // If test failed, run root cause analysis
      if (result.status === LLTM_CONFIG.STATUS.FAIL) {
        const analysis = RootCauseAnalyzer.analyze(result);
        if (analysis.causes.length > 0) {
          result.possibleCauses = analysis.causes.map(c => c.cause);
        }
      }

    } catch (error) {
      result.status = LLTM_CONFIG.STATUS.ERROR;
      result.score = 0;
      result.anomalies.push('Error: ' + error.message);
    }

    result.duration = new Date().getTime() - startTime;
    return result;
  },

  /**
   * Generate test data for a specific test
   */
  generateTestData(testId, scenario) {
    switch (testId) {
      case 'row_selection':
        return TestDataGenerator.generateRowSelectionData({
          totalRows: 100,
          matchingRows: scenario.expectedRows || 15,
          format: 'EU',
          criteria: scenario.criteria
        });

      case 'bid_changes':
        return TestDataGenerator.generateBidChangeData({
          bids: scenario.testData?.currentBids || [0.50, 0.75, 1.00, 1.25, 1.50],
          changePercent: scenario.testData?.changePercent || 15,
          format: 'EU'
        });

      case 'pause_targets':
        return TestDataGenerator.generatePauseTargetsData({
          totalRows: 100,
          zeroSalesRows: scenario.expectedPaused || 20,
          format: 'EU',
          criteria: scenario.criteria
        });

      case 'full_analysis':
        return TestDataGenerator.generateTestReport({
          rowCount: scenario.testData?.builderRows || 100,
          format: 'EU',
          reportType: 'BULK_BUILDER'
        });

      case 'column_mapping':
        return TestDataGenerator.generateColumnMappingData(true, {
          rowCount: 50,
          format: 'EU'
        });

      case 'export_to_amazon':
        return TestDataGenerator.generateExportData({
          totalRows: scenario.testData?.totalRows || 50,
          pauseRows: scenario.testData?.pauseRows || 10,
          bidChangeRows: scenario.testData?.bidChangeRows || 20,
          budgetChangeRows: scenario.testData?.budgetChangeRows || 20,
          format: 'US'
        });

      case 'budget_changes':
        return TestDataGenerator.generateBudgetChangeData({
          budgets: scenario.testData?.budgets || [10, 20, 30, 40, 50],
          acosValues: [15, 25, 35, 18, 45],
          changePercent: scenario.testData?.changePercent || 20,
          acosThreshold: scenario.testData?.acosThreshold || 20,
          format: 'EU'
        });

      default:
        return TestDataGenerator.generateTestReport({
          rowCount: 50,
          format: 'EU'
        });
    }
  },

  /**
   * Execute LAO function for test
   */
  executeLAOTestFunction(testId, scenario) {
    switch (testId) {
      case 'row_selection':
        // Row selection happens during analysis
        return LAOController.executeLAOFunction('runBulkAnalysis');

      case 'bid_changes':
        return LAOController.executeLAOFunction('applyBidChanges', {
          changeType: 'percent_increase',
          value: scenario.testData?.changePercent || 15
        });

      case 'pause_targets':
        return LAOController.executeLAOFunction('pauseZeroSales');

      case 'full_analysis':
        return LAOController.executeLAOFunction('generateFullAnalysis');

      case 'column_mapping':
        return LAOController.executeLAOFunction('mapColumns', {
          sheetName: LLTM_CONFIG.LAO_SHEETS.BULK_SOURCE
        });

      case 'export_to_amazon':
        return LAOController.executeLAOFunction('exportToAmazon');

      case 'budget_changes':
        return LAOController.executeLAOFunction('adjustBudgets', {
          changePercent: scenario.testData?.changePercent || 20,
          acosThreshold: scenario.testData?.acosThreshold || 20
        });

      default:
        return { success: false, error: 'Unknown test function' };
    }
  },

  /**
   * Get test results from sheets
   */
  getTestResults(testId, metadata) {
    const results = {};

    switch (testId) {
      case 'row_selection':
        const builderData = LAOController.getSheetResults(
          LLTM_CONFIG.LAO_SHEETS.BULK_BUILDER,
          ['✅ Apply Change', 'Clicks', 'Spend']
        );
        if (builderData.success) {
          results.selectedRows = builderData.data.filter((row, i) =>
            i > 0 && row[0] === true
          ).length;
          results.totalRows = builderData.rowCount;
        }
        break;

      case 'bid_changes':
        const bidData = LAOController.getSheetResults(
          LLTM_CONFIG.LAO_SHEETS.BULK_BUILDER,
          ['Bid', '✅ Apply Change']
        );
        if (bidData.success) {
          results.newBids = bidData.data.slice(1)
            .filter(row => row[1] === true)
            .map(row => LAOController.parseNumber(row[0]));
          results.changedCount = results.newBids.length;
        }
        break;

      case 'pause_targets':
        const pauseData = LAOController.getSheetResults(
          LLTM_CONFIG.LAO_SHEETS.BULK_BUILDER,
          ['State', '💡 Recommendation']
        );
        if (pauseData.success) {
          results.pausedCount = pauseData.data.filter((row, i) =>
            i > 0 && row[0] === 'paused'
          ).length;
        }
        break;

      case 'full_analysis':
        const analysisData = LAOController.getSheetResults(
          LLTM_CONFIG.LAO_SHEETS.BULK_BUILDER
        );
        if (analysisData.success) {
          results.columns = analysisData.headers;
          results.matchedRows = analysisData.data.filter((row, i) =>
            i > 0 && row[analysisData.headers.indexOf('💡 Recommendation')]
          ).length;
          results.hasConfidenceValues = analysisData.headers.includes('📊 Confidence');
          results.recommendations = {};
          ['INCREASE_BID', 'DECREASE_BID', 'PAUSE', 'ADD_NEGATIVE', 'KEEP'].forEach(rec => {
            const colIdx = analysisData.headers.indexOf('💡 Recommendation');
            if (colIdx >= 0) {
              results.recommendations[rec] = analysisData.data.filter((row, i) =>
                i > 0 && row[colIdx] === rec
              ).length;
            }
          });
        }
        break;

      case 'column_mapping':
        const mappingResult = LAOController.simulateColumnMapping({
          sheetName: LLTM_CONFIG.LAO_SHEETS.BULK_SOURCE
        });
        results.formats = [{
          found: mappingResult.foundCount > 0,
          matchedColumn: Object.values(mappingResult.mappingResults).find(r => r.found)?.matchedAlias
        }];
        break;

      case 'export_to_amazon':
        const exportResult = LAOController.simulateExport();
        results.exportedRows = exportResult.exportedRows;
        results.exportHeaders = exportResult.exportHeaders;
        results.missingColumns = exportResult.missingColumns;
        results.validFormat = exportResult.success;
        break;

      case 'budget_changes':
        const budgetData = LAOController.getSheetResults(
          LLTM_CONFIG.LAO_SHEETS.BULK_BUILDER,
          ['Campaign Name', 'Daily Budget', 'ACOS']
        );
        if (budgetData.success) {
          // Count unique campaigns with changed budgets
          const campaigns = new Set();
          budgetData.data.slice(1).forEach(row => {
            if (row[0]) campaigns.add(row[0]);
          });
          results.changedCount = campaigns.size;
          results.changes = [];
        }
        break;
    }

    return results;
  },

  /**
   * Get expected value string for display
   */
  getExpectedValue(testId, metadata) {
    switch (testId) {
      case 'row_selection':
        return `${metadata.expectedMatchingRows} rows selected`;
      case 'bid_changes':
        return `${metadata.originalBids?.length || 0} bids changed by ${metadata.changePercent}%`;
      case 'pause_targets':
        return `${metadata.expectedPausedRows} targets paused`;
      case 'full_analysis':
        return 'Analysis columns populated';
      case 'column_mapping':
        return 'Both formats mapped';
      case 'export_to_amazon':
        return `${metadata.totalRows} rows exported`;
      case 'budget_changes':
        return `${metadata.expectedChanges} budgets changed`;
      default:
        return 'Test passes';
    }
  },

  /**
   * Get actual value string for display
   */
  getActualValue(testId, results) {
    switch (testId) {
      case 'row_selection':
        return `${results.selectedRows || 0} rows selected`;
      case 'bid_changes':
        return `${results.changedCount || 0} bids changed`;
      case 'pause_targets':
        return `${results.pausedCount || 0} targets paused`;
      case 'full_analysis':
        return `${results.matchedRows || 0} rows analyzed`;
      case 'column_mapping':
        return results.formats?.[0]?.found ? 'Mapped successfully' : 'Mapping failed';
      case 'export_to_amazon':
        return `${results.exportedRows || 0} rows exported`;
      case 'budget_changes':
        return `${results.changedCount || 0} budgets changed`;
      default:
        return 'N/A';
    }
  }
};

// ============== MENU FUNCTIONS ==============

/**
 * Run all tests
 */
function runAllTests() {
  try {
    const report = LLTMRunner.runAll({ groups: ['A', 'B'] });
    if (report) {
      SpreadsheetApp.getUi().alert(
        '🧪 Tests Complete',
        `Passed: ${report.summary.passed}/${report.summary.total}\n` +
        `Score: ${report.summary.avgScore}%\n\n` +
        `View results in sheet: ${LLTM_CONFIG.SHEETS.TEST_RESULTS}`,
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    }
  } catch (error) {
    SpreadsheetApp.getUi().alert('❌ Error', error.message, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

/**
 * Run critical tests only (Group A)
 */
function runCriticalTests() {
  try {
    const report = LLTMRunner.runAll({ groups: ['A'] });
    if (report) {
      SpreadsheetApp.getUi().alert(
        '🧪 Critical Tests Complete',
        `Passed: ${report.summary.passed}/${report.summary.total}\n` +
        `Score: ${report.summary.avgScore}%`,
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    }
  } catch (error) {
    SpreadsheetApp.getUi().alert('❌ Error', error.message, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

// Individual test functions
function runTest_RowSelection() { runIndividualTest('row_selection'); }
function runTest_BidChanges() { runIndividualTest('bid_changes'); }
function runTest_PauseTargets() { runIndividualTest('pause_targets'); }
function runTest_FullAnalysis() { runIndividualTest('full_analysis'); }
function runTest_ColumnMapping() { runIndividualTest('column_mapping'); }
function runTest_Export() { runIndividualTest('export_to_amazon'); }
function runTest_BudgetChanges() { runIndividualTest('budget_changes'); }

function runIndividualTest(testId) {
  try {
    LAOController.initializeTestEnvironment();
    const result = LLTMRunner.runSingleTest(testId);

    const report = Reporter.generateReport([result], {});
    HistoryManager.saveToHistory(report);

    SpreadsheetApp.getUi().alert(
      `${result.status} - ${result.testName}`,
      `Score: ${result.score}%\n` +
      `Expected: ${result.expected}\n` +
      `Actual: ${result.actual}\n\n` +
      (result.anomalies.length > 0 ? 'Issues: ' + result.anomalies.join(', ') : ''),
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (error) {
    SpreadsheetApp.getUi().alert('❌ Error', error.message, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

/**
 * Show test results sheet
 */
function showTestResults() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(LLTM_CONFIG.SHEETS.TEST_RESULTS);

  if (sheet) {
    ss.setActiveSheet(sheet);
  } else {
    SpreadsheetApp.getUi().alert('No test results yet. Run tests first.');
  }
}

/**
 * Show test history
 */
function showTestHistory() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(LLTM_CONFIG.SHEETS.TEST_HISTORY);

  if (sheet) {
    ss.setActiveSheet(sheet);
  } else {
    SpreadsheetApp.getUi().alert('No test history yet. Run tests first.');
  }
}

/**
 * Analyze last failures
 */
function analyzeLastFailures() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const resultsSheet = ss.getSheetByName(LLTM_CONFIG.SHEETS.TEST_RESULTS);

  if (!resultsSheet || resultsSheet.getLastRow() < 2) {
    SpreadsheetApp.getUi().alert('No test results to analyze. Run tests first.');
    return;
  }

  // Find failed tests
  const data = resultsSheet.getDataRange().getValues();
  const failures = [];

  for (let i = 1; i < data.length; i++) {
    if (data[i][3] && data[i][3].includes('FAIL')) {
      failures.push({
        testId: data[i][0],
        testName: data[i][1],
        score: data[i][4],
        notes: data[i][9]
      });
    }
  }

  if (failures.length === 0) {
    SpreadsheetApp.getUi().alert('✅ No failures to analyze!');
    return;
  }

  // Generate analysis
  let analysisText = '🔍 FAILURE ANALYSIS\n\n';

  failures.forEach((failure, i) => {
    const mockResult = {
      testId: failure.testId,
      testName: failure.testName,
      status: LLTM_CONFIG.STATUS.FAIL
    };

    const analysis = RootCauseAnalyzer.analyze(mockResult);

    analysisText += `${i + 1}. ${failure.testName}\n`;
    analysisText += `   Score: ${failure.score}\n`;

    if (analysis.causes.length > 0) {
      analysisText += `   Likely cause: ${analysis.causes[0].cause}\n`;
      if (analysis.causes[0].solution) {
        analysisText += `   Solution: ${analysis.causes[0].solution}\n`;
      }
    }

    analysisText += '\n';
  });

  SpreadsheetApp.getUi().alert('Failure Analysis', analysisText, SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * Clear test data
 */
function clearTestData() {
  const ui = SpreadsheetApp.getUi();
  const result = ui.alert(
    '🗑️ Clear Test Data',
    'This will remove all LLTM sheets (Test_Results, History, etc.).\n\nContinue?',
    ui.ButtonSet.YES_NO
  );

  if (result === ui.Button.YES) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetsToRemove = [
      LLTM_CONFIG.SHEETS.TEST_RESULTS,
      LLTM_CONFIG.SHEETS.TEST_HISTORY,
      LLTM_CONFIG.SHEETS.TEST_FAILURES,
      LLTM_CONFIG.SHEETS.KNOWN_ISSUES
    ];

    let removed = 0;
    sheetsToRemove.forEach(name => {
      const sheet = ss.getSheetByName(name);
      if (sheet) {
        ss.deleteSheet(sheet);
        removed++;
      }
    });

    // Also clean LAO test sheets
    LAOController.cleanupTestEnvironment();

    ui.alert(`Removed ${removed} LLTM sheets and cleared test data.`);
  }
}

/**
 * Show about dialog
 */
function showAbout() {
  const message =
    `🧪 LUKO LAO Test Machine (LLTM)\n\n` +
    `Version: ${LLTM_CONFIG.VERSION}\n\n` +
    `Purpose: Automated testing system for LUKO Ads Optimizer\n\n` +
    `Features:\n` +
    `• 7 critical function tests (Group A)\n` +
    `• Test data generation (EU/US formats)\n` +
    `• Regression detection\n` +
    `• Root cause analysis\n` +
    `• False positive detection\n\n` +
    `Menu: 🧪 LLTM → Run All Tests`;

  SpreadsheetApp.getUi().alert('About LLTM', message, SpreadsheetApp.getUi().ButtonSet.OK);
}

// ============== EXPORTS ==============

// Export for GAS
if (typeof module !== 'undefined') {
  module.exports = {
    LLTMRunner,
    runAllTests,
    runCriticalTests,
    onOpen_LLTM
  };
}

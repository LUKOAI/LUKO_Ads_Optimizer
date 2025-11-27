/**
 * LLTM Assertion Engine
 * Validates test results and generates scores
 * @version 1.0
 */

const AssertionEngine = {

  /**
   * Run all assertions for a test scenario
   * @param {string} testId - Test scenario ID
   * @param {Object} actual - Actual results from LAO
   * @param {Object} expected - Expected results from test scenario
   * @returns {Object} Assertion result with score
   */
  runAssertions(testId, actual, expected) {
    const startTime = new Date().getTime();

    const result = {
      testId: testId,
      passed: false,
      score: 0,
      status: LLTM_CONFIG.STATUS.FAIL,
      assertions: [],
      summary: '',
      duration: 0,
      falsePositiveCheck: null,
      anomalies: []
    };

    try {
      // Run test-specific assertions
      switch (testId) {
        case 'T001': // Row Selection
          result.assertions = this.assertRowSelection(actual, expected);
          break;
        case 'T002': // Bid Changes
          result.assertions = this.assertBidChanges(actual, expected);
          break;
        case 'T003': // Pause Targets
          result.assertions = this.assertPauseTargets(actual, expected);
          break;
        case 'T004': // Full Analysis
          result.assertions = this.assertFullAnalysis(actual, expected);
          break;
        case 'T005': // Column Mapping
          result.assertions = this.assertColumnMapping(actual, expected);
          break;
        case 'T006': // Export to Amazon
          result.assertions = this.assertExport(actual, expected);
          break;
        case 'T007': // Budget Changes
          result.assertions = this.assertBudgetChanges(actual, expected);
          break;
        default:
          result.assertions = this.assertGeneric(actual, expected);
      }

      // Calculate score
      result.score = this.calculateScore(result.assertions);
      result.status = this.getStatusFromScore(result.score);
      result.passed = result.score === 100;

      // Check for false positives
      result.falsePositiveCheck = this.checkFalsePositives(testId, actual, expected);
      if (result.falsePositiveCheck.isFalsePositive) {
        result.passed = false;
        result.status = LLTM_CONFIG.STATUS.FAIL;
        result.score = Math.min(result.score, 50);
        result.anomalies.push(result.falsePositiveCheck.reason);
      }

      // Detect anomalies
      result.anomalies = [
        ...result.anomalies,
        ...this.detectAnomalies(actual, expected)
      ];

      // Generate summary
      result.summary = this.generateSummary(result);

    } catch (error) {
      result.status = LLTM_CONFIG.STATUS.ERROR;
      result.summary = `Assertion error: ${error.message}`;
    }

    result.duration = new Date().getTime() - startTime;
    return result;
  },

  /**
   * Assert Row Selection test results
   */
  assertRowSelection(actual, expected) {
    const assertions = [];

    // 1. Check count match
    assertions.push({
      name: 'Row Count Match',
      expected: expected.expectedRows,
      actual: actual.selectedRows || 0,
      passed: actual.selectedRows === expected.expectedRows,
      weight: 50,
      message: actual.selectedRows === expected.expectedRows ?
        `Correct: ${actual.selectedRows} rows selected` :
        `Expected ${expected.expectedRows}, got ${actual.selectedRows}`
    });

    // 2. Check no false selections
    assertions.push({
      name: 'No False Selections',
      expected: 0,
      actual: actual.falseSelections || 0,
      passed: (actual.falseSelections || 0) === 0,
      weight: 25,
      message: (actual.falseSelections || 0) === 0 ?
        'No false selections' :
        `${actual.falseSelections} rows incorrectly selected`
    });

    // 3. Check no missed selections
    assertions.push({
      name: 'No Missed Selections',
      expected: 0,
      actual: actual.missedSelections || 0,
      passed: (actual.missedSelections || 0) === 0,
      weight: 25,
      message: (actual.missedSelections || 0) === 0 ?
        'No missed selections' :
        `${actual.missedSelections} rows should have been selected`
    });

    return assertions;
  },

  /**
   * Assert Bid Changes test results
   */
  assertBidChanges(actual, expected) {
    const assertions = [];

    // 1. Check all rows changed
    const expectedCount = expected.testData.currentBids.length;
    const actualCount = actual.changedCount || 0;

    assertions.push({
      name: 'All Bids Changed',
      expected: expectedCount,
      actual: actualCount,
      passed: actualCount === expectedCount,
      weight: 30,
      message: actualCount === expectedCount ?
        `All ${expectedCount} bids changed` :
        `Expected ${expectedCount} changes, got ${actualCount}`
    });

    // 2. Check no zero bids
    const zeroBids = (actual.newBids || []).filter(b => b === 0 || isNaN(b)).length;
    assertions.push({
      name: 'No Zero Bids',
      expected: 0,
      actual: zeroBids,
      passed: zeroBids === 0,
      weight: 25,
      message: zeroBids === 0 ?
        'No zero or NaN bids' :
        `${zeroBids} bids are zero or NaN - possible parsing error`
    });

    // 3. Check calculation accuracy
    if (actual.newBids && expected.expectedBids) {
      let correctCalculations = 0;
      for (let i = 0; i < expected.expectedBids.length; i++) {
        const actualBid = actual.newBids[i] || 0;
        const expectedBid = expected.expectedBids[i];
        // Allow 0.01 tolerance for rounding
        if (Math.abs(actualBid - expectedBid) <= 0.02) {
          correctCalculations++;
        }
      }

      const accuracy = Math.round((correctCalculations / expected.expectedBids.length) * 100);
      assertions.push({
        name: 'Calculation Accuracy',
        expected: 100,
        actual: accuracy,
        passed: accuracy === 100,
        weight: 30,
        message: accuracy === 100 ?
          'All calculations correct' :
          `${accuracy}% calculations correct (${correctCalculations}/${expected.expectedBids.length})`
      });
    }

    // 4. Check no unchanged bids (except if already at boundary)
    const unchangedBids = (actual.newBids || []).filter((newBid, i) =>
      actual.originalBids && newBid === actual.originalBids[i]
    ).length;

    assertions.push({
      name: 'No Unchanged Bids',
      expected: 0,
      actual: unchangedBids,
      passed: unchangedBids === 0,
      weight: 15,
      message: unchangedBids === 0 ?
        'All bids were modified' :
        `${unchangedBids} bids unchanged - function may not have run`
    });

    return assertions;
  },

  /**
   * Assert Pause Targets test results
   */
  assertPauseTargets(actual, expected) {
    const assertions = [];

    // 1. Check pause count
    const expectedPaused = expected.expectedPaused;
    const actualPaused = actual.pausedCount || 0;

    assertions.push({
      name: 'Correct Pause Count',
      expected: expectedPaused,
      actual: actualPaused,
      passed: actualPaused === expectedPaused,
      weight: 40,
      message: actualPaused === expectedPaused ?
        `Correctly paused ${actualPaused} targets` :
        `Expected ${expectedPaused} paused, got ${actualPaused}`
    });

    // 2. Check state values are correct
    const incorrectStates = (actual.pausedRows || []).filter(row =>
      actual.stateValues && actual.stateValues[row] !== 'paused'
    ).length;

    assertions.push({
      name: 'State Values Correct',
      expected: 0,
      actual: incorrectStates,
      passed: incorrectStates === 0,
      weight: 30,
      message: incorrectStates === 0 ?
        'All state values set to "paused"' :
        `${incorrectStates} rows have incorrect state value`
    });

    // 3. Check checkboxes are marked
    if (actual.checkboxesMarked !== undefined) {
      assertions.push({
        name: 'Checkboxes Marked',
        expected: actualPaused,
        actual: actual.checkboxesMarked,
        passed: actual.checkboxesMarked === actualPaused,
        weight: 15,
        message: actual.checkboxesMarked === actualPaused ?
          'All checkboxes marked' :
          `Only ${actual.checkboxesMarked}/${actualPaused} checkboxes marked`
      });
    }

    // 4. Check no timeout
    assertions.push({
      name: 'No Timeout',
      expected: false,
      actual: actual.timeout || false,
      passed: !(actual.timeout),
      weight: 15,
      message: !(actual.timeout) ?
        'Operation completed without timeout' :
        'Operation timed out - possible batch processing issue'
    });

    return assertions;
  },

  /**
   * Assert Full Analysis test results
   */
  assertFullAnalysis(actual, expected) {
    const assertions = [];

    // 1. Check rows analyzed
    const expectedMatches = expected.testData.expectedMatches;
    const actualMatches = actual.matchedRows || 0;

    assertions.push({
      name: 'Target Matching',
      expected: expectedMatches,
      actual: actualMatches,
      passed: actualMatches >= expectedMatches * 0.9, // 90% tolerance
      weight: 35,
      message: actualMatches >= expectedMatches ?
        `Matched ${actualMatches} targets (expected ${expectedMatches})` :
        `Only ${actualMatches}/${expectedMatches} targets matched`
    });

    // 2. Check required columns present
    const missingColumns = [];
    expected.expectedColumns.forEach(col => {
      if (!actual.columns || !actual.columns.includes(col)) {
        missingColumns.push(col);
      }
    });

    assertions.push({
      name: 'Analysis Columns Present',
      expected: 0,
      actual: missingColumns.length,
      passed: missingColumns.length === 0,
      weight: 25,
      message: missingColumns.length === 0 ?
        'All analysis columns present' :
        `Missing columns: ${missingColumns.join(', ')}`
    });

    // 3. Check recommendations generated
    const hasRecommendations = actual.recommendations &&
      Object.values(actual.recommendations).some(v => v > 0);

    assertions.push({
      name: 'Recommendations Generated',
      expected: true,
      actual: hasRecommendations,
      passed: hasRecommendations,
      weight: 20,
      message: hasRecommendations ?
        'Recommendations generated for targets' :
        'No recommendations generated'
    });

    // 4. Check confidence values
    const hasConfidence = actual.hasConfidenceValues !== false;

    assertions.push({
      name: 'Confidence Values Set',
      expected: true,
      actual: hasConfidence,
      passed: hasConfidence,
      weight: 20,
      message: hasConfidence ?
        'Confidence values set' :
        'Missing confidence values'
    });

    return assertions;
  },

  /**
   * Assert Column Mapping test results
   */
  assertColumnMapping(actual, expected) {
    const assertions = [];

    // Check each format
    expected.formats.forEach((format, index) => {
      const formatResult = actual.formats ? actual.formats[index] : null;
      const success = formatResult && formatResult.found;

      assertions.push({
        name: `Format ${index + 1}: ${format.name}`,
        expected: format.keyColumn,
        actual: formatResult ? formatResult.matchedColumn : 'NOT FOUND',
        passed: success,
        weight: 50,
        message: success ?
          `Column "${format.keyColumn}" mapped successfully` :
          `Failed to map column "${format.keyColumn}"`
      });
    });

    return assertions;
  },

  /**
   * Assert Export test results
   */
  assertExport(actual, expected) {
    const assertions = [];

    // 1. Check row count
    const expectedRows = expected.testData.totalRows;
    const actualRows = actual.exportedRows || 0;

    assertions.push({
      name: 'All Rows Exported',
      expected: expectedRows,
      actual: actualRows,
      passed: actualRows >= expectedRows * 0.9,
      weight: 30,
      message: actualRows >= expectedRows ?
        `Exported ${actualRows} rows` :
        `Only ${actualRows}/${expectedRows} rows exported`
    });

    // 2. Check required columns
    const missingColumns = expected.requiredColumns.filter(col =>
      !actual.exportHeaders || !actual.exportHeaders.includes(col)
    );

    assertions.push({
      name: 'Required Columns Present',
      expected: 0,
      actual: missingColumns.length,
      passed: missingColumns.length === 0,
      weight: 30,
      message: missingColumns.length === 0 ?
        'All required columns present' :
        `Missing: ${missingColumns.join(', ')}`
    });

    // 3. Check format validity
    assertions.push({
      name: 'Valid Export Format',
      expected: true,
      actual: actual.validFormat !== false,
      passed: actual.validFormat !== false,
      weight: 25,
      message: actual.validFormat !== false ?
        'Export format is valid' :
        'Export format validation failed'
    });

    // 4. Check no analysis columns leaked
    const analysisColumnsLeaked = (actual.exportHeaders || []).filter(h =>
      h.includes('💡') || h.includes('📊') || h.includes('📝') || h.includes('✅')
    );

    assertions.push({
      name: 'No Analysis Columns Leaked',
      expected: 0,
      actual: analysisColumnsLeaked.length,
      passed: analysisColumnsLeaked.length === 0,
      weight: 15,
      message: analysisColumnsLeaked.length === 0 ?
        'Analysis columns properly removed' :
        `Analysis columns leaked: ${analysisColumnsLeaked.join(', ')}`
    });

    return assertions;
  },

  /**
   * Assert Budget Changes test results
   */
  assertBudgetChanges(actual, expected) {
    const assertions = [];

    // 1. Check correct campaigns changed
    const expectedChanges = expected.expectedChanges;
    const actualChanges = actual.changedCount || 0;

    assertions.push({
      name: 'Correct Campaigns Changed',
      expected: expectedChanges,
      actual: actualChanges,
      passed: actualChanges === expectedChanges,
      weight: 40,
      message: actualChanges === expectedChanges ?
        `Changed ${actualChanges} campaign budgets` :
        `Expected ${expectedChanges}, got ${actualChanges}`
    });

    // 2. Check calculation accuracy
    if (actual.changes && expected.testData.expectedNewBudgets) {
      let correctCalculations = 0;
      actual.changes.forEach(change => {
        const expected = expected.testData.expectedNewBudgets.find(b =>
          Math.abs(b - change.newBudget) <= 0.1
        );
        if (expected) correctCalculations++;
      });

      const accuracy = actualChanges > 0 ?
        Math.round((correctCalculations / actualChanges) * 100) : 0;

      assertions.push({
        name: 'Budget Calculation Accuracy',
        expected: 100,
        actual: accuracy,
        passed: accuracy === 100,
        weight: 35,
        message: accuracy === 100 ?
          'All budget calculations correct' :
          `${accuracy}% calculations correct`
      });
    }

    // 3. Check no zero budgets
    const zeroBudgets = (actual.changes || []).filter(c =>
      c.newBudget === 0 || isNaN(c.newBudget)
    ).length;

    assertions.push({
      name: 'No Zero Budgets',
      expected: 0,
      actual: zeroBudgets,
      passed: zeroBudgets === 0,
      weight: 25,
      message: zeroBudgets === 0 ?
        'No zero or NaN budgets' :
        `${zeroBudgets} budgets are zero - possible parsing error`
    });

    return assertions;
  },

  /**
   * Generic assertions for unknown test types
   */
  assertGeneric(actual, expected) {
    const assertions = [];

    // Compare all expected fields
    Object.entries(expected).forEach(([key, expectedValue]) => {
      const actualValue = actual[key];

      assertions.push({
        name: key,
        expected: expectedValue,
        actual: actualValue,
        passed: this.compareValues(actualValue, expectedValue),
        weight: 100 / Object.keys(expected).length,
        message: this.compareValues(actualValue, expectedValue) ?
          `${key} matches` :
          `${key}: expected ${expectedValue}, got ${actualValue}`
      });
    });

    return assertions;
  },

  /**
   * Calculate overall score from assertions
   */
  calculateScore(assertions) {
    if (assertions.length === 0) return 0;

    let totalWeight = 0;
    let weightedScore = 0;

    assertions.forEach(assertion => {
      const weight = assertion.weight || 1;
      totalWeight += weight;
      if (assertion.passed) {
        weightedScore += weight;
      }
    });

    return Math.round((weightedScore / totalWeight) * 100);
  },

  /**
   * Get status based on score
   */
  getStatusFromScore(score) {
    if (score === 100) return LLTM_CONFIG.STATUS.PASS;
    if (score >= LLTM_CONFIG.THRESHOLDS.PARTIAL) return LLTM_CONFIG.STATUS.PARTIAL;
    if (score >= LLTM_CONFIG.THRESHOLDS.WARNING) return LLTM_CONFIG.STATUS.PARTIAL;
    return LLTM_CONFIG.STATUS.FAIL;
  },

  /**
   * Check for false positives
   * CRITICAL: Detects when partial results are incorrectly considered success
   */
  checkFalsePositives(testId, actual, expected) {
    const result = {
      isFalsePositive: false,
      reason: '',
      details: {}
    };

    // Check 1: Count mismatch despite "correct" values
    if (actual.count !== undefined && expected.expectedCount !== undefined) {
      if (actual.count > 0 && actual.count < expected.expectedCount * 0.5) {
        result.isFalsePositive = true;
        result.reason = `Only ${actual.count} of ${expected.expectedCount} expected - partial execution`;
        result.details.expectedCount = expected.expectedCount;
        result.details.actualCount = actual.count;
      }
    }

    // Check 2: All values are zero
    if (actual.values && Array.isArray(actual.values)) {
      const allZero = actual.values.every(v => v === 0 || v === '' || v === null);
      if (allZero && actual.values.length > 0) {
        result.isFalsePositive = true;
        result.reason = 'All values are 0 - possible parsing error';
        result.details.zeroCount = actual.values.length;
      }
    }

    // Check 3: Very high unchanged percentage
    if (actual.changedCount !== undefined && actual.totalRows !== undefined) {
      const unchangedPercent = ((actual.totalRows - actual.changedCount) / actual.totalRows) * 100;
      if (unchangedPercent > 80 && expected.changedCount > actual.totalRows * 0.1) {
        result.isFalsePositive = true;
        result.reason = `${unchangedPercent.toFixed(0)}% values unchanged - function may not have executed`;
      }
    }

    // Check 4: Missing expected columns
    if (expected.expectedColumns && actual.columns) {
      const missingCount = expected.expectedColumns.filter(c => !actual.columns.includes(c)).length;
      if (missingCount > expected.expectedColumns.length * 0.5) {
        result.isFalsePositive = true;
        result.reason = `Missing ${missingCount}/${expected.expectedColumns.length} expected columns`;
      }
    }

    return result;
  },

  /**
   * Detect anomalies in results
   */
  detectAnomalies(actual, expected) {
    const anomalies = [];

    // Check for NaN values
    if (actual.newBids) {
      const nanCount = actual.newBids.filter(b => isNaN(b)).length;
      if (nanCount > 0) {
        anomalies.push(`${nanCount} NaN values detected - parsing issue`);
      }
    }

    // Check for timeout
    if (actual.timeout) {
      anomalies.push('Operation timed out - consider batch processing');
    }

    // Check for error messages
    if (actual.error) {
      anomalies.push(`Error: ${actual.error}`);
    }

    // Check for suspiciously fast execution
    if (actual.duration !== undefined && actual.duration < 100 && expected.expectedRows > 50) {
      anomalies.push(`Suspiciously fast (${actual.duration}ms) for ${expected.expectedRows} rows`);
    }

    // Check for unchanged values when changes expected
    if (actual.originalBids && actual.newBids) {
      const unchanged = actual.originalBids.filter((orig, i) => orig === actual.newBids[i]).length;
      if (unchanged === actual.originalBids.length && actual.originalBids.length > 0) {
        anomalies.push('No values changed despite expecting changes');
      }
    }

    return anomalies;
  },

  /**
   * Generate summary message
   */
  generateSummary(result) {
    const passedCount = result.assertions.filter(a => a.passed).length;
    const totalCount = result.assertions.length;

    let summary = `${passedCount}/${totalCount} assertions passed (${result.score}%)`;

    if (result.anomalies.length > 0) {
      summary += ` | Anomalies: ${result.anomalies.length}`;
    }

    if (result.falsePositiveCheck && result.falsePositiveCheck.isFalsePositive) {
      summary += ` | FALSE POSITIVE DETECTED`;
    }

    return summary;
  },

  /**
   * Compare two values (with type coercion)
   */
  compareValues(actual, expected) {
    if (actual === expected) return true;

    // Handle null/undefined
    if (actual == null && expected == null) return true;
    if (actual == null || expected == null) return false;

    // Handle numbers with tolerance
    if (typeof expected === 'number' && typeof actual === 'number') {
      return Math.abs(actual - expected) < 0.01;
    }

    // Handle strings
    if (typeof expected === 'string' && typeof actual === 'string') {
      return actual.toLowerCase().trim() === expected.toLowerCase().trim();
    }

    // Handle arrays
    if (Array.isArray(expected) && Array.isArray(actual)) {
      if (actual.length !== expected.length) return false;
      return actual.every((val, i) => this.compareValues(val, expected[i]));
    }

    // Handle objects
    if (typeof expected === 'object' && typeof actual === 'object') {
      const keys = Object.keys(expected);
      return keys.every(key => this.compareValues(actual[key], expected[key]));
    }

    return String(actual) === String(expected);
  },

  /**
   * Assert with tolerance for numerical values
   */
  assertWithTolerance(actual, expected, tolerance = 0.1) {
    if (typeof actual === 'number' && typeof expected === 'number') {
      const percentDiff = Math.abs((actual - expected) / expected);
      return percentDiff <= tolerance;
    }
    return actual === expected;
  },

  /**
   * Assert count is within expected range
   */
  assertCount(actual, expected, tolerance = 0) {
    const min = expected - tolerance;
    const max = expected + tolerance;
    return actual >= min && actual <= max;
  },

  /**
   * Assert array contains expected values
   */
  assertContains(array, expectedValues) {
    if (!Array.isArray(array)) return false;
    return expectedValues.every(val => array.includes(val));
  },

  /**
   * Assert no null/undefined values in array
   */
  assertNoNulls(array) {
    if (!Array.isArray(array)) return false;
    return array.every(val => val !== null && val !== undefined);
  }
};

// Export for GAS
if (typeof module !== 'undefined') {
  module.exports = { AssertionEngine };
}

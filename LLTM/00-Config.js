/**
 * LUKO LAO Test Machine (LLTM) - Configuration
 * Automated testing system for LUKO Ads Optimizer
 * @version 1.0
 * @author LLTM System
 */

const LLTM_CONFIG = {
  // System version
  VERSION: '1.0',
  NAME: 'LUKO LAO Test Machine',

  // Sheet names for LLTM
  SHEETS: {
    TEST_RESULTS: 'LLTM_Test_Results',
    TEST_HISTORY: 'LLTM_History',
    TEST_FAILURES: 'LLTM_Failures',
    KNOWN_ISSUES: 'LLTM_Known_Issues'
  },

  // LAO Sheet names (targets for testing)
  LAO_SHEETS: {
    BULK_SOURCE: 'BULK_Source',
    BULK_BUILDER: 'BULK_Builder',
    BULK_MAPPING: 'BULK_Mapping',
    BULK_INFO: 'BULK_Info',
    BULK_NEGATIVES: 'BULK_Negatives',
    BULK_CHANGELOG: 'BULK_ChangeLog',
    FULL_ANALYSIS: 'LUKO_Full_Analysis',
    TEXTUAL_REPORT: 'LUKO_Textual_Report',
    SNAPSHOT: 'LUKO_Snapshot',
    DEBUG_LOG: 'LUKO_Debug_Log'
  },

  // Timeouts (in milliseconds)
  TIMEOUTS: {
    MAX_EXECUTION: 300000,  // 5 minutes total
    FUNCTION_TIMEOUT: 30000, // 30 seconds per function
    WAIT_AFTER_ACTION: 500,  // 500ms wait after each action
    BATCH_PAUSE: 100         // 100ms between batch operations
  },

  // Thresholds for test scoring
  THRESHOLDS: {
    SUCCESS: 100,      // 100% = full success
    PARTIAL: 90,       // 90-99% = partial success
    WARNING: 75,       // 75-89% = warning
    FAILURE: 0         // <75% = failure
  },

  // Status indicators
  STATUS: {
    PASS: '✅ PASS',
    PARTIAL: '⚠️ PARTIAL',
    FAIL: '❌ FAIL',
    SKIPPED: '⏭️ SKIPPED',
    ERROR: '💥 ERROR',
    RUNNING: '🔄 RUNNING'
  },

  // Test groups
  TEST_GROUPS: {
    A: {
      name: 'CRITICAL',
      description: 'Must work always',
      priority: 1,
      tests: [
        'row_selection',
        'bid_changes',
        'pause_targets',
        'full_analysis',
        'column_mapping',
        'export_to_amazon',
        'budget_changes'
      ]
    },
    B: {
      name: 'IMPORTANT',
      description: 'Test if time permits',
      priority: 2,
      tests: [
        'row_coloring',
        'add_negatives',
        'snapshot',
        'textual_report',
        'validation_before_export'
      ]
    }
  },

  // Number formats for testing
  NUMBER_FORMATS: {
    EU: {
      decimal: ',',
      thousand: '.',
      examples: ['5,5', '1.234,56', '0,001']
    },
    US: {
      decimal: '.',
      thousand: ',',
      examples: ['5.5', '1,234.56', '0.001']
    }
  },

  // Edge cases for test data generation
  EDGE_CASES: {
    ALL_ZEROS: 'all_zeros',
    HIGH_ACOS: 'high_acos',         // ACOS > 200%
    MIXED_SIGNALS: 'mixed_signals', // High CTR + low conversion
    SPECIAL_CHARS: 'special_chars', // ™, ®, ąćę etc.
    NULL_VALUES: 'null_values',
    VERY_SMALL: 'very_small',       // 0.001
    VERY_LARGE: 'very_large',       // 999999
    NEGATIVE_VALUES: 'negative',
    EMPTY_STRINGS: 'empty_strings'
  },

  // Report column aliases (for column mapping tests)
  COLUMN_ALIASES: {
    targeting: ['Keyword text', 'Targeting', 'Keyword Text', 'Zielschlüsselwort'],
    matchType: ['Match type', 'Match Type', 'Übereinstimmungstyp'],
    searchTerm: ['Customer search term', 'Customer Search Term', 'Suchbegriff'],
    clicks: ['Clicks', 'Klicks', 'Kliknięcia'],
    spend: ['Spend', 'Ausgaben', 'Wydatki', 'Cost'],
    sales: ['7 Day Total Sales', 'Sales', 'Sprzedaż', 'Verkäufe', 'Total Sales'],
    orders: ['7 Day Total Orders', 'Orders', 'Zamówienia', 'Bestellungen'],
    impressions: ['Impressions', 'Impressionen', 'Wyświetlenia'],
    acos: ['ACOS', 'Total ACOS', 'Cost Per Click']
  },

  // Colors for reporting
  COLORS: {
    SUCCESS: '#ccffcc',    // Light green
    PARTIAL: '#ffffcc',    // Light yellow
    FAILURE: '#ffcccc',    // Light red
    HEADER: '#4a90d9',     // Blue header
    HEADER_TEXT: '#ffffff' // White text
  },

  // Console output settings
  CONSOLE: {
    WIDTH: 60,
    SEPARATOR: '━',
    BULLET: '├─',
    BULLET_LAST: '└─'
  },

  // History settings
  HISTORY: {
    KEEP_DAYS: 30,
    MAX_ENTRIES: 1000
  },

  // Regression detection
  REGRESSION: {
    ENABLED: true,
    THRESHOLD_PERCENT: 10, // Alert if score drops by 10% or more
    COMPARE_LAST_N: 5      // Compare with last N test runs
  }
};

// Test scenario templates
const TEST_SCENARIOS = {
  // Test 1: Row Selection
  row_selection: {
    id: 'T001',
    name: 'Row Selection',
    group: 'A',
    description: 'Test zaznaczania wierszy spełniających kryteria',
    expectedRows: 15,
    criteria: {
      minClicks: 10,
      minSpend: 5
    },
    successCriteria: {
      exact: 100,   // Exact match = 100%
      tolerance: 2  // Allow 2 rows difference for partial
    },
    possibleCauses: [
      'parseFloat() zamiast universalParser.parseNumber() (nie rozpoznaje "5,5")',
      'Zmieniony indeks kolumny',
      'Logika filtrowania usunięta/zmieniona',
      'Batch processing nie działa (timeout)'
    ]
  },

  // Test 2: Bid Changes
  bid_changes: {
    id: 'T002',
    name: 'Bid Changes',
    group: 'A',
    description: 'Test zmiany stawek o określony procent',
    testData: {
      currentBids: [0.50, 0.75, 1.00, 1.25, 1.50, 0.60, 0.80, 0.90, 1.10, 1.30],
      changePercent: 15
    },
    expectedBids: [0.58, 0.86, 1.15, 1.44, 1.73, 0.69, 0.92, 1.04, 1.27, 1.50],
    successCriteria: {
      allChanged: true,
      noneZero: true,
      noneUnchanged: true
    },
    possibleCauses: [
      'parseFloat("5,5") → NaN → 0',
      'Brak batch processing → timeout',
      'Funkcja nie znajduje zaznaczonych wierszy',
      'Zmieniona nazwa kolumny "Apply" lub "New Bid"'
    ]
  },

  // Test 3: Pause Targets
  pause_targets: {
    id: 'T003',
    name: 'Pause Targets',
    group: 'A',
    description: 'Test pauzowania targetów bez sprzedaży',
    criteria: {
      minClicks: 10,
      minSpend: 5,
      sales: 0
    },
    expectedPaused: 20,
    successCriteria: {
      exact: 100,
      tolerance: 2
    },
    possibleCauses: [
      'Pętla setValue() zamiast batch setValues()',
      'Timeout przy 500+ wierszach',
      'Warunek sales = 0 nie działa (format liczby)'
    ]
  },

  // Test 4: Full Analysis
  full_analysis: {
    id: 'T004',
    name: 'Full Analysis',
    group: 'A',
    description: 'Test generowania pełnej analizy i dopasowania targetów',
    testData: {
      fullAnalysisTargets: 50,
      builderRows: 100,
      expectedMatches: 30
    },
    expectedColumns: ['💡 Recommendation', '📊 Confidence', '📝 Reason'],
    successCriteria: {
      matchRate: 100,
      columnsPresent: true
    },
    possibleCauses: [
      'Brak fuzzy matching (tylko exact match)',
      'Różne nazwy kolumn między raportami',
      'Brak normalizacji tekstu',
      'Problem z Campaign Name / Ad Group Name'
    ]
  },

  // Test 5: Column Mapping
  column_mapping: {
    id: 'T005',
    name: 'Column Mapping',
    group: 'A',
    description: 'Test mapowania kolumn z różnych formatów raportów',
    formats: [
      { name: 'SP Search Term Report', keyColumn: 'Keyword text' },
      { name: 'Sponsored Products', keyColumn: 'Targeting' }
    ],
    successCriteria: {
      bothFormatsWork: true
    },
    possibleCauses: [
      'Brak systemu aliasów',
      'Szukanie tylko jednej nazwy kolumny',
      'Case-sensitive porównywanie'
    ]
  },

  // Test 6: Export to Amazon
  export_to_amazon: {
    id: 'T006',
    name: 'Export to Amazon',
    group: 'A',
    description: 'Test eksportu danych do formatu Amazon',
    testData: {
      totalRows: 50,
      pauseRows: 10,
      bidChangeRows: 20,
      budgetChangeRows: 20
    },
    requiredColumns: [
      'Product', 'Entity', 'Operation', 'Campaign Id', 'Ad Group Id',
      'Campaign Name', 'Ad Group Name', 'Bid', 'State'
    ],
    successCriteria: {
      allRowsExported: true,
      validFormat: true,
      requiredColumnsPresent: true
    },
    possibleCauses: [
      'Brak walidacji przed eksportem',
      'Niepoprawny format danych',
      'Brakujące kolumny wymagane przez Amazon'
    ]
  },

  // Test 7: Budget Changes
  budget_changes: {
    id: 'T007',
    name: 'Budget Changes',
    group: 'A',
    description: 'Test zmiany budżetów kampanii',
    testData: {
      budgets: [10, 20, 30, 40, 50],
      changePercent: 20,
      acosThreshold: 20
    },
    expectedChanges: 3, // 3 campaigns with ACOS > 20%
    successCriteria: {
      correctCalculation: true,
      noZeroResults: true
    },
    possibleCauses: [
      'Funkcja adjustCampaignBudgets() nie działa',
      'Problem z ACOS settings',
      'Brak batch processing'
    ]
  }
};

// Known issues database
const KNOWN_ISSUES = {
  'NUMBER_PARSING_EU': {
    symptom: 'All values are 0 or NaN',
    pattern: /actual.*0.*expected.*[1-9]/i,
    cause: 'EU number format (5,5) not recognized',
    file: '15-BulkChangeManager.js',
    line: 173,
    solution: 'Replace parseFloat() with universalParser.parseNumber()'
  },
  'COLUMN_NOT_FOUND': {
    symptom: 'Column not found error',
    pattern: /column.*not.*found|indexOf.*-1/i,
    cause: 'Column name changed or missing alias',
    file: '04-DataIntegrator.js',
    solution: 'Add column name to COLUMN_ALIASES mapping'
  },
  'TIMEOUT_BATCH': {
    symptom: 'Timeout or partial results',
    pattern: /timeout|partial.*result/i,
    cause: 'Loop-based setValue() instead of batch setValues()',
    solution: 'Convert to batch operations using 2D arrays'
  },
  'CHECKBOX_MISSING': {
    symptom: 'Rows not selected despite correct values',
    pattern: /checkbox.*false|apply.*change.*0/i,
    cause: 'Checkbox column name changed',
    file: '15-BulkChangeManager.js',
    solution: 'Check "✅ Apply Change" column presence'
  }
};

// Export for GAS
if (typeof module !== 'undefined') {
  module.exports = { LLTM_CONFIG, TEST_SCENARIOS, KNOWN_ISSUES };
}

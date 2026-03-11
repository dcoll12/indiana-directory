/**
 * Indiana Rural Summit Directory
 * Google Apps Script: Auto-map Form Submissions to Directory Tab
 *
 * HOW TO INSTALL:
 * 1. Open your Google Sheet
 * 2. Click Extensions > Apps Script
 * 3. Delete any existing code and paste this entire file
 * 4. Click Save (floppy disk icon)
 * 5. Set up the trigger:
 *    a. Click "Triggers" (clock icon) in the left sidebar
 *    b. Click "+ Add Trigger" (bottom right)
 *    c. Choose function: onFormSubmit
 *    d. Event source: From spreadsheet
 *    e. Event type: On form submit
 *    f. Click Save
 * 6. Authorize the script when prompted
 *
 * The script will now automatically copy new form submissions
 * into the DIRECTORY tab with columns in the correct order.
 */

// ── Configuration ────────────────────────────────────────────────────────────

const DIRECTORY_SHEET_NAME = 'DIRECTORY';

/**
 * Maps form question titles (Form Responses sheet column headers)
 * to DIRECTORY tab column headers.
 *
 * Keys   = exact column header in the Form Responses sheet
 * Values = exact column header in the DIRECTORY sheet
 *
 * Update these if your form question wording differs.
 */
const FIELD_MAP = {
  // Form question title          : Directory column header
  'First Name':                    'First Name',
  'Last Name':                     'Last Name',
  'Email':                         'Email',
  'Phone':                         'Phone',
  'Role':                          'Role',
  'Title':                         'Title',
  'District':                      'District',
  'Congressional District':        'Congressional District',
  'House District':                'House District',
  'Senate District':               'Senate District',
  'Counties':                      'Counties',
  'Home City':                     'Home City',
  'Home County':                   'Home County',
  'Occupation':                    'Occupation',
  'Website':                       'Website',
  'Facebook URL':                  'Facebook',
  'Instagram Handle':              'Instagram',
  'Other Social 1':                'Other Social 1',
  'Other Social 2':                'Other Social 2',
  'Elected Opponent':              'Elected Opponent',
  'Primary Opponent':              'Primary Opponent',
};

// ── Main trigger function ─────────────────────────────────────────────────────

/**
 * Triggered automatically when a form is submitted.
 * Maps the response values into the correct DIRECTORY columns.
 *
 * @param {Object} e - The form submit event object
 */
function onFormSubmit(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const directorySheet = ss.getSheetByName(DIRECTORY_SHEET_NAME);

    if (!directorySheet) {
      throw new Error(`Sheet "${DIRECTORY_SHEET_NAME}" not found. Check DIRECTORY_SHEET_NAME.`);
    }

    // Get the DIRECTORY header row to know column positions
    const directoryHeaders = directorySheet
      .getRange(1, 1, 1, directorySheet.getLastColumn())
      .getValues()[0]
      .map(h => h.toString().trim());

    // e.namedValues maps each form question to an array of answer strings
    const formValues = e.namedValues || {};

    // Build a new row aligned to the DIRECTORY column order
    const newRow = directoryHeaders.map(directoryCol => {
      // Find the form question that maps to this directory column
      const formQuestion = Object.keys(FIELD_MAP).find(
        q => FIELD_MAP[q] === directoryCol
      );

      if (!formQuestion) return ''; // No mapping defined for this column

      const answers = formValues[formQuestion];
      if (!answers || answers.length === 0) return '';

      return answers[0].trim(); // Google Forms wraps each answer in an array
    });

    // Append the mapped row to the DIRECTORY sheet
    directorySheet.appendRow(newRow);

    console.log('Form submission successfully mapped to DIRECTORY tab.');
  } catch (err) {
    console.error('onFormSubmit error:', err.message);
    // Re-throw so Apps Script logs the full stack trace
    throw err;
  }
}

// ── Utility: inspect headers ──────────────────────────────────────────────────

/**
 * Run this function ONCE manually to log the headers from both sheets.
 * This helps you verify / fix FIELD_MAP if needed.
 *
 * How to run:
 *   In the Apps Script editor, select "logHeaders" in the function dropdown
 *   and click the Run (▶) button.
 */
function logHeaders() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();

  sheets.forEach(sheet => {
    const lastCol = sheet.getLastColumn();
    if (lastCol === 0) return;
    const headers = sheet
      .getRange(1, 1, 1, lastCol)
      .getValues()[0]
      .map((h, i) => `  Col ${i + 1}: "${h}"`)
      .join('\n');
    console.log(`\n=== ${sheet.getName()} ===\n${headers}`);
  });
}

/**
 * Run this function ONCE manually to test the mapping without a real
 * form submission.  It appends a dummy row to DIRECTORY so you can
 * verify the column alignment looks correct, then removes it.
 *
 * How to run:
 *   Select "testMapping" in the function dropdown and click Run (▶).
 */
function testMapping() {
  // Build a fake e.namedValues with placeholder values
  const fakeNamedValues = {};
  Object.keys(FIELD_MAP).forEach(question => {
    fakeNamedValues[question] = [`[TEST] ${question}`];
  });

  const fakeEvent = { namedValues: fakeNamedValues };
  onFormSubmit(fakeEvent);

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(DIRECTORY_SHEET_NAME);
  const lastRow = sheet.getLastRow();

  console.log(`Test row appended at row ${lastRow}. Review it, then delete it.`);
  console.log('Tip: call removeTestRow() to delete it automatically.');
}

/** Removes the last row in DIRECTORY (used to clean up after testMapping). */
function removeTestRow() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(DIRECTORY_SHEET_NAME);
  sheet.deleteRow(sheet.getLastRow());
  console.log('Last row deleted.');
}

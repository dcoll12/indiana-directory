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

/**
 * Maps UPDATE form question titles to DIRECTORY tab column headers.
 *
 * Keys   = exact column header in the Update Form Responses sheet
 * Values = exact column header in the DIRECTORY sheet
 *
 * "Your Name (as it appears in directory)" is used for lookup only.
 * "Name Correction" will overwrite First Name / Last Name if provided.
 */
const UPDATE_FIELD_MAP = {
  'Name Correction':              '_NAME_CORRECTION',  // special: splits into First/Last
  'Phone':                        'Phone',
  'Role':                         'Role',
  'Title':                        'Title',
  'Congressional District':       'Congressional District',
  'House District':               'House District',
  'Senate District':              'Senate District',
  'Counties Covered':             'Counties',
  'Home City':                    'Home City',
  'Home County':                  'Home County',
  'Occupation':                   'Occupation',
  'Website URL':                  'Website',
  'Facebook URL':                 'Facebook',
  'Instagram URL':                'Instagram',
  'TikTok URL':                   'Tiktok',
  'Other Links':                  'Other Social 1',
};

// Sheet names for the form response tabs.
// Adjust these to match the actual tab names in your spreadsheet.
const NEW_RESPONSES_SHEET_NAME  = 'Form Responses 1';
const UPDATE_RESPONSES_SHEET_NAME = 'Update Responses';

// ── Main trigger function (new submissions) ──────────────────────────────────

/**
 * Triggered automatically when a form is submitted.
 * Maps the response values into the correct DIRECTORY columns.
 *
 * @param {Object} e - The form submit event object
 */
function onFormSubmit(e) {
  try {
    // Guard: only process events from the new-submission form responses sheet
    const sourceSheet = e.range && e.range.getSheet();
    if (sourceSheet && sourceSheet.getName() === UPDATE_RESPONSES_SHEET_NAME) {
      console.log('onFormSubmit: ignoring event from update form.');
      return;
    }

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

// ── Update trigger function ──────────────────────────────────────────────────

/**
 * Triggered automatically when the UPDATE form is submitted.
 * Looks up the contact by first and last name, then overwrites
 * only the fields that were filled in.
 *
 * HOW TO INSTALL (separate trigger):
 *   1. Click "Triggers" (clock icon) in the Apps Script sidebar
 *   2. Click "+ Add Trigger"
 *   3. Choose function: onUpdateFormSubmit
 *   4. Event source: From spreadsheet
 *   5. Event type: On form submit
 *   6. Click Save
 *
 * NOTE: If both the new-submission form and the update form are
 * linked to this spreadsheet, Apps Script fires ALL "on form submit"
 * triggers for every submission. Each handler checks which sheet the
 * event came from and exits early if it's not the right one.
 *
 * @param {Object} e - The form submit event object
 */
function onUpdateFormSubmit(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const directorySheet = ss.getSheetByName(DIRECTORY_SHEET_NAME);

    if (!directorySheet) {
      throw new Error(`Sheet "${DIRECTORY_SHEET_NAME}" not found.`);
    }

    // Guard: only process events from the Update Responses sheet
    const sourceSheet = e.range && e.range.getSheet();
    if (sourceSheet && sourceSheet.getName() !== UPDATE_RESPONSES_SHEET_NAME) {
      console.log('onUpdateFormSubmit: ignoring event from sheet "' +
        (sourceSheet ? sourceSheet.getName() : 'unknown') + '"');
      return;
    }

    const formValues = e.namedValues || {};

    // ── 1. Extract the lookup email ─────────────────────────────────────
    const lookupEmail = (formValues['Email Address'] || [''])[0].trim().toLowerCase();
    if (!lookupEmail) {
      console.log('onUpdateFormSubmit: no email provided, skipping.');
      return;
    }

    // ── 2. Find the row in DIRECTORY that matches by email ──────────────
    const directoryHeaders = directorySheet
      .getRange(1, 1, 1, directorySheet.getLastColumn())
      .getValues()[0]
      .map(h => h.toString().trim());

    const emailCol = directoryHeaders.indexOf('Email');
    const email2Col = directoryHeaders.indexOf('Email2');

    if (emailCol === -1) {
      throw new Error('DIRECTORY sheet must have an "Email" column.');
    }

    const dataRange = directorySheet.getRange(2, 1, directorySheet.getLastRow() - 1, directorySheet.getLastColumn());
    const allData = dataRange.getValues();

    let matchRow = -1; // 0-based index within allData
    for (let i = 0; i < allData.length; i++) {
      const rowEmail = allData[i][emailCol].toString().trim().toLowerCase();
      const rowEmail2 = email2Col !== -1 ? allData[i][email2Col].toString().trim().toLowerCase() : '';
      if (rowEmail === lookupEmail || rowEmail2 === lookupEmail) {
        matchRow = i;
        break;
      }
    }

    if (matchRow === -1) {
      console.log('onUpdateFormSubmit: no matching contact found for email "' + lookupEmail + '".');
      return;
    }

    const sheetRow = matchRow + 2; // +1 for header, +1 for 1-based indexing

    // ── 3. Apply non-empty updates ──────────────────────────────────────

    // Handle name correction first (splits into First Name / Last Name)
    const nameCorrection = (formValues['Name Correction'] || [''])[0].trim();
    if (nameCorrection) {
      const corrParts = nameCorrection.split(/\s+/);
      const newFirst = corrParts[0];
      const newLast = corrParts.slice(1).join(' ');
      const firstNameCol = directoryHeaders.indexOf('First Name');
      const lastNameCol = directoryHeaders.indexOf('Last Name');
      if (firstNameCol !== -1) {
        directorySheet.getRange(sheetRow, firstNameCol + 1).setValue(newFirst);
      }
      if (newLast && lastNameCol !== -1) {
        directorySheet.getRange(sheetRow, lastNameCol + 1).setValue(newLast);
      }
    }

    // Apply all other mapped fields
    Object.keys(UPDATE_FIELD_MAP).forEach(formQuestion => {
      const dirCol = UPDATE_FIELD_MAP[formQuestion];
      if (dirCol === '_NAME_CORRECTION') return; // already handled above

      const value = (formValues[formQuestion] || [''])[0].trim();
      if (!value) return; // skip empty fields

      const colIndex = directoryHeaders.indexOf(dirCol);
      if (colIndex === -1) {
        console.log('onUpdateFormSubmit: column "' + dirCol + '" not found in DIRECTORY, skipping.');
        return;
      }

      directorySheet.getRange(sheetRow, colIndex + 1).setValue(value);
    });

    console.log('onUpdateFormSubmit: updated contact with email "' + lookupEmail + '" at row ' + sheetRow + '.');
  } catch (err) {
    console.error('onUpdateFormSubmit error:', err.message);
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

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const headers = [
  'Party ID',
  'Invitation / Party Name',
  'Invitation Type',
  'Primary Guest',
  'Invited Guest Count',
  'Plus-One Allowed',
  'Children Invited',
  'RSVP Deadline',
  'RSVP Status',
  'Contact Email / Phone',
  'RSVP Rules / Notes',
];

const rows = [
  [
    'P006',
    'Mr. Ryan Thorpe',
    'Special',
    'Ryan Thorpe',
    3,
    'Yes',
    'No',
    '',
    '',
    '',
    '',
  ],
  [
    'P001',
    'The Musgraves Family',
    'Family',
    '',
    6,
    'No',
    'Yes',
    '',
    '',
    '',
    '',
  ],
  [
    'P002',
    'The Snow Family',
    'Family',
    '',
    5,
    'No',
    'Yes',
    '',
    '',
    '',
    '',
  ],
  [
    'P003',
    'Laura Snow & Guest',
    'Individual + Guest',
    'Laura Snow',
    2,
    'Yes',
    'No',
    '',
    '',
    '',
    '',
  ],
  ['P019', 'The Liska Family', 'Family', '', 10, 'No', 'Yes', '', '', '', ''],
  ['P021', 'The Liska Family', 'Family', '', 10, 'No', 'Yes', '', '', '', ''],
];

function loadAppsScript() {
  const sheetValues = [[], [], [], headers, ...rows];
  const sheet = {
    getLastRow: () => sheetValues.length,
    getLastColumn: () => headers.length,
    getRange(row, column, rowCount, columnCount) {
      return {
        getValues: () =>
          sheetValues
            .slice(row - 1, row - 1 + rowCount)
            .map((values) =>
              values.slice(column - 1, column - 1 + columnCount),
            ),
      };
    },
  };
  const context = vm.createContext({
    console,
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getSheetByName: (name) => (name === 'Guest List' ? sheet : null),
      }),
    },
  });
  const source = readFileSync(
    new URL('../google-apps-script/Code.gs', import.meta.url),
    'utf8',
  );
  vm.runInContext(source, context);
  return context;
}

test('Apps Script returns Ryan’s three-person Special rules from his row', () => {
  const result = loadAppsScript().lookupInvitation('mr ryan thorpe');

  assert.equal(result.success, true);
  assert.equal(result.found, true);
  assert.equal(result.invitation.invitedGuestCount, 3);
  assert.equal(result.invitation.invitationType, 'Special');
  assert.equal(result.invitation.plusOneAllowed, true);
});

test('Apps Script finds a unique invitation from its meaningful family name', () => {
  const result = loadAppsScript().lookupInvitation('musgraves');

  assert.equal(result.success, true);
  assert.equal(result.found, true);
  assert.equal(result.invitation.invitationName, 'The Musgraves Family');
  assert.equal(result.invitation.invitedGuestCount, 6);
});

test('Apps Script does not guess when a partial name matches multiple invitations', () => {
  const result = loadAppsScript().lookupInvitation('snow');

  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
    success: true,
    found: false,
    ambiguous: true,
  });
});

test('Apps Script does not search using only generic invitation words', () => {
  const result = loadAppsScript().lookupInvitation('the family');

  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
    success: true,
    found: false,
  });
});

test('Apps Script collapses duplicate Liska rows into one generic family record', () => {
  const result = loadAppsScript().lookupInvitation('The Liska Family');

  assert.equal(result.success, true);
  assert.equal(result.found, true);
  assert.deepEqual(JSON.parse(JSON.stringify(result.invitation)), {
    invitationName: 'The Liska Family',
    primaryGuest: '',
    invitedGuestCount: 10,
    plusOneAllowed: false,
    childrenInvited: true,
    invitationType: 'Family',
  });
  assert.equal('rows' in result, false);
});

test('Apps Script returns no invitation for an unknown name', () => {
  const result = loadAppsScript().lookupInvitation('Unknown Party');
  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
    success: true,
    found: false,
  });
});

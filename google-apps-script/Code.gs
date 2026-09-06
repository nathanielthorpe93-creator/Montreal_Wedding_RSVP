const RESPONSE_SHEET = 'RSVP Responses';
const GUEST_LIST_SHEET = 'Guest List';
const GUEST_LIST_HEADER_ROW = 4;
const GUEST_LIST_FIRST_DATA_ROW = 5;

const INVITATION_TYPES = [
  'Family',
  'Named Couple',
  'Individual + Guest',
  'Individual',
  'Special'
];

const MEAL_LABELS = {
  beef: 'Beef Filet',
  chicken: 'Chicken Supreme',
  vegetarian: 'Vegetarian Entree',
  kids: 'Kids Meal'
};

const GENERIC_INVITATION_WORDS = [
  'and',
  'dr',
  'family',
  'guest',
  'miss',
  'mr',
  'mrs',
  'ms',
  'the'
];

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const expectedSecret =
      PropertiesService.getScriptProperties().getProperty('RSVP_SHARED_SECRET');

    if (!expectedSecret || body.secret !== expectedSecret) {
      return jsonResponse({ success: false, error: 'Unauthorized' });
    }

    if (body.action === 'lookupInvitation') {
      return jsonResponse(lookupInvitation(body.partyName));
    }

    if (body.action === 'submitRsvp') {
      return jsonResponse(submitRsvp(body));
    }

    return jsonResponse({ success: false, error: 'Invalid action' });
  } catch (error) {
    console.error(error);
    return jsonResponse({
      success: false,
      error: error.message || 'Unknown server error'
    });
  }
}

function lookupInvitation(partyNameValue) {
  const partyName = clean(partyNameValue);

  if (!partyName) {
    return { success: true, found: false };
  }

  const sheet = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName(GUEST_LIST_SHEET);

  if (!sheet) {
    throw new Error('Guest List sheet was not found.');
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < GUEST_LIST_FIRST_DATA_ROW) {
    return { success: true, found: false };
  }

  const lastColumn = sheet.getLastColumn();
  const headers = sheet
    .getRange(GUEST_LIST_HEADER_ROW, 1, 1, lastColumn)
    .getValues()[0];
  const columns = guestListColumns(headers);
  const rows = sheet
    .getRange(
      GUEST_LIST_FIRST_DATA_ROW,
      1,
      lastRow - GUEST_LIST_FIRST_DATA_ROW + 1,
      lastColumn
    )
    .getValues();
  const targetName = normalize(partyName);
  let matches = rows.filter(row => {
    const candidate = clean(row[columns.invitationName]);
    return candidate && normalize(candidate) === targetName;
  });

  if (matches.length === 0) {
    const targetWords = invitationSearchWords(partyName);

    if (targetWords.length > 0) {
      matches = rows.filter(row => {
        const candidate = clean(row[columns.invitationName]);
        if (!candidate) return false;

        const candidateWords = invitationSearchWords(candidate);
        return targetWords.every(word => candidateWords.indexOf(word) !== -1);
      });

      const distinctInvitationNames = Array.from(new Set(
        matches.map(row => normalize(row[columns.invitationName]))
      ));

      if (distinctInvitationNames.length > 1) {
        return { success: true, found: false, ambiguous: true };
      }
    }
  }

  if (matches.length === 0) {
    return { success: true, found: false };
  }

  // Identically printed invitations (currently The Liska Family) intentionally
  // return one generic family configuration, never the matching sheet rows.
  if (matches.length > 1) {
    const validCounts = matches
      .map(row => positiveGuestCount(row[columns.invitedGuestCount]))
      .filter(count => count !== null);
    const safeGuestCount = validCounts.length
      ? Math.min.apply(null, validCounts)
      : 10;

    return {
      success: true,
      found: true,
      invitation: {
        invitationName: clean(matches[0][columns.invitationName]),
        primaryGuest: '',
        invitedGuestCount: safeGuestCount,
        plusOneAllowed: false,
        childrenInvited: true,
        invitationType: 'Family'
      }
    };
  }

  return {
    success: true,
    found: true,
    invitation: invitationRecord(matches[0], columns)
  };
}

function invitationSearchWords(value) {
  const normalized = normalize(value);
  if (!normalized) return [];

  return normalized.split(' ').filter(word =>
    word && GENERIC_INVITATION_WORDS.indexOf(word) === -1
  );
}

function invitationRecord(row, columns) {
  const invitationName = clean(row[columns.invitationName]);
  const primaryGuest = clean(row[columns.primaryGuest]);
  const invitedGuestCount = positiveGuestCount(row[columns.invitedGuestCount]);
  const invitationType = clean(row[columns.invitationType]);

  if (!invitedGuestCount || invitedGuestCount > 10) {
    throw new Error(`Invalid Invited Guest Count for ${invitationName}.`);
  }

  if (INVITATION_TYPES.indexOf(invitationType) === -1) {
    throw new Error(`Invalid Invitation Type for ${invitationName}.`);
  }

  return {
    invitationName: invitationName,
    primaryGuest: primaryGuest,
    invitedGuestCount: invitedGuestCount,
    plusOneAllowed: yesNoValue(row[columns.plusOneAllowed]),
    childrenInvited: yesNoValue(row[columns.childrenInvited]),
    invitationType: invitationType
  };
}

function submitRsvp(body) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const responseSheet = ss.getSheetByName(RESPONSE_SHEET);

  if (!responseSheet) {
    throw new Error('RSVP Responses sheet was not found.');
  }

  const partyName = clean(body.partyName);
  const email = clean(body.email);
  const phone = clean(body.phone);
  const songRequest = clean(body.songRequest);
  const notes = clean(body.notes);
  const groupFlight = body.groupFlight ? 'Yes' : 'No';

  if (!partyName) {
    throw new Error('Party name is required.');
  }

  if (!Array.isArray(body.guests) || body.guests.length === 0) {
    throw new Error('At least one guest is required.');
  }

  if (body.guests.length > 10) {
    throw new Error('Too many guests in one RSVP.');
  }

  const submissionId =
    'NM-' + Utilities.getUuid().split('-')[0].toUpperCase();
  const submittedAt = new Date();
  const primaryGuest = clean(body.guests[0] && body.guests[0].name) || partyName;

  const rows = body.guests.map((guest, index) => {
    const guestName = clean(guest.name);
    const attendance = clean(guest.attendance);
    const mealChoice = clean(guest.meal);
    const dietary = clean(guest.dietary);

    if (!guestName) {
      throw new Error(`Guest ${index + 1} is missing a name.`);
    }

    if (attendance !== 'attending' && attendance !== 'declining') {
      throw new Error(`Guest ${index + 1} has an invalid attendance response.`);
    }

    if (attendance === 'attending' && !mealChoice) {
      throw new Error(`Guest ${index + 1} must select a meal.`);
    }

    if (attendance === 'attending' && !MEAL_LABELS[mealChoice]) {
      throw new Error(`Guest ${index + 1} has an invalid meal selection.`);
    }

    return [
      submissionId,
      submittedAt,
      partyName,
      primaryGuest,
      guestName,
      index + 1,
      attendance === 'attending' ? 'Yes' : 'No',
      attendance === 'attending' ? MEAL_LABELS[mealChoice] : '',
      dietary,
      notes,
      email,
      phone,
      songRequest,
      groupFlight
    ];
  });

  responseSheet
    .getRange(responseSheet.getLastRow() + 1, 1, rows.length, rows[0].length)
    .setValues(rows);

  SpreadsheetApp.flush();

  let guestListSync;
  try {
    guestListSync = updateGuestList(ss, partyName, email, phone, body.guests);
  } catch (syncError) {
    console.error('Guest List sync error:', syncError);
    guestListSync = { updated: false, reason: 'Guest List sync error' };
  }

  return {
    success: true,
    submissionId: submissionId,
    guestCount: rows.length,
    guestListSync: guestListSync
  };
}

function updateGuestList(ss, partyName, email, phone, guests) {
  const sheet = ss.getSheetByName(GUEST_LIST_SHEET);

  if (!sheet) {
    return { updated: false, reason: 'Guest List sheet not found' };
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < GUEST_LIST_FIRST_DATA_ROW) {
    return { updated: false, reason: 'Guest List contains no records' };
  }

  const lastColumn = sheet.getLastColumn();
  const headers = sheet
    .getRange(GUEST_LIST_HEADER_ROW, 1, 1, lastColumn)
    .getValues()[0];
  const columns = guestListColumns(headers);
  const partyValues = sheet
    .getRange(
      GUEST_LIST_FIRST_DATA_ROW,
      columns.invitationName + 1,
      lastRow - GUEST_LIST_FIRST_DATA_ROW + 1,
      1
    )
    .getValues();
  const targetName = normalize(partyName);
  const matchingRows = [];

  partyValues.forEach((row, index) => {
    const sheetPartyName = clean(row[0]);
    if (sheetPartyName && normalize(sheetPartyName) === targetName) {
      matchingRows.push(GUEST_LIST_FIRST_DATA_ROW + index);
    }
  });

  if (matchingRows.length === 0) {
    return { updated: false, reason: 'No matching Guest List row' };
  }

  if (matchingRows.length > 1) {
    return { updated: false, reason: 'Multiple matching Guest List rows' };
  }

  const rowNumber = matchingRows[0];
  const attendingCount = guests.filter(
    guest => clean(guest.attendance) === 'attending'
  ).length;
  const decliningCount = guests.filter(
    guest => clean(guest.attendance) === 'declining'
  ).length;
  let desiredStatus;

  if (attendingCount > 0 && decliningCount === 0) {
    desiredStatus = 'attending';
  } else if (decliningCount > 0 && attendingCount === 0) {
    desiredStatus = 'declined';
  } else {
    desiredStatus = 'partial';
  }

  const statusCell = sheet.getRange(rowNumber, columns.rsvpStatus + 1);
  const selectedStatus = findAllowedStatus(statusCell, desiredStatus);

  if (selectedStatus) {
    statusCell.setValue(selectedStatus);
  }

  const contactText = [email, phone].filter(Boolean).join(' | ');
  if (contactText) {
    sheet.getRange(rowNumber, columns.contact + 1).setValue(contactText);
  }

  SpreadsheetApp.flush();

  return {
    updated: true,
    row: rowNumber,
    statusUpdated: Boolean(selectedStatus),
    status: selectedStatus || null
  };
}

function guestListColumns(headers) {
  const normalizedHeaders = headers.map(header => normalize(header));

  function required(label) {
    const index = normalizedHeaders.indexOf(normalize(label));
    if (index === -1) {
      throw new Error(`Guest List header not found: ${label}`);
    }
    return index;
  }

  return {
    invitationName: required('Invitation / Party Name'),
    invitationType: required('Invitation Type'),
    primaryGuest: required('Primary Guest'),
    invitedGuestCount: required('Invited Guest Count'),
    plusOneAllowed: required('Plus-One Allowed'),
    childrenInvited: required('Children Invited'),
    rsvpStatus: required('RSVP Status'),
    contact: required('Contact Email / Phone')
  };
}

function findAllowedStatus(cell, desiredStatus) {
  const validation = cell.getDataValidation();

  if (!validation) {
    if (desiredStatus === 'attending') return 'Attending';
    if (desiredStatus === 'declined') return 'Declined';
    return 'Partially Attending';
  }

  if (
    validation.getCriteriaType() !==
    SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST
  ) {
    return null;
  }

  const allowedValues = validation.getCriteriaValues()[0].map(String);
  const normalizedAllowed = allowedValues.map(value => ({
    original: value,
    normalized: normalize(value)
  }));
  let candidates = [];

  if (desiredStatus === 'attending') {
    candidates = ['attending', 'accepted', 'yes', 'attending yes', 'confirmed'];
  } else if (desiredStatus === 'declined') {
    candidates = ['declined', 'declining', 'no', 'not attending', 'regretfully declines'];
  } else {
    candidates = ['partially attending', 'partial', 'mixed', 'some attending'];
  }

  for (const candidate of candidates) {
    const match = normalizedAllowed.find(
      option => option.normalized === normalize(candidate)
    );
    if (match) return match.original;
  }

  return null;
}

function positiveGuestCount(value) {
  const count = Number(value);
  return Number.isInteger(count) && count > 0 && count <= 10 ? count : null;
}

function yesNoValue(value) {
  const normalized = normalize(value);
  return normalized === 'yes' || normalized === 'true';
}

function clean(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function normalize(value) {
  return clean(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

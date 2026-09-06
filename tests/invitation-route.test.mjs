import assert from 'node:assert/strict';
import test from 'node:test';
import { POST } from '../app/api/invitation/route.ts';

function lookupRequest(partyName) {
  return new Request('https://example.test/api/invitation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ partyName }),
  });
}

function configureEnvironment() {
  process.env.RSVP_APPS_SCRIPT_URL =
    'https://script.google.com/macros/s/test/exec';
  process.env.RSVP_SHARED_SECRET = 'server-only-test-secret';
}

test('returns one sanitized invitation and keeps the shared secret upstream', async () => {
  configureEnvironment();
  let forwardedBody;
  globalThis.fetch = async (_url, init) => {
    forwardedBody = JSON.parse(init.body);
    return Response.json({
      success: true,
      found: true,
      invitation: {
        invitationName: 'Mr. Ryan Thorpe',
        primaryGuest: 'Ryan Thorpe',
        invitedGuestCount: 3,
        plusOneAllowed: true,
        childrenInvited: false,
        invitationType: 'Special',
        partyId: 'must-not-pass-through',
      },
      internalRows: ['must-not-pass-through'],
    });
  };

  const response = await POST(lookupRequest('Mr. Ryan Thorpe'));
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(forwardedBody, {
    action: 'lookupInvitation',
    partyName: 'Mr. Ryan Thorpe',
    secret: 'server-only-test-secret',
  });
  assert.deepEqual(result, {
    success: true,
    invitation: {
      invitationName: 'Mr. Ryan Thorpe',
      primaryGuest: 'Ryan Thorpe',
      invitedGuestCount: 3,
      plusOneAllowed: true,
      childrenInvited: false,
      invitationType: 'Special',
    },
  });
  assert.equal(
    JSON.stringify(result).includes('server-only-test-secret'),
    false,
  );
});

test('returns the guest-facing not-found message without a fallback invitation', async () => {
  configureEnvironment();
  globalThis.fetch = async () => Response.json({ success: true, found: false });

  const response = await POST(lookupRequest('Unknown Party'));
  const result = await response.json();

  assert.equal(response.status, 404);
  assert.equal(result.success, false);
  assert.match(result.error, /main name or family name/i);
  assert.equal('invitation' in result, false);
});

test('returns a useful message for an ambiguous partial name', async () => {
  configureEnvironment();
  globalThis.fetch = async () =>
    Response.json({ success: true, found: false, ambiguous: true });

  const response = await POST(lookupRequest('Snow'));
  const result = await response.json();

  assert.equal(response.status, 404);
  assert.equal(result.success, false);
  assert.match(result.error, /matches more than one invitation/i);
  assert.equal('invitation' in result, false);
});

test('rejects malformed invitation rules from Apps Script', async () => {
  configureEnvironment();
  globalThis.fetch = async () =>
    Response.json({
      success: true,
      found: true,
      invitation: {
        invitationName: 'Bad Row',
        primaryGuest: '',
        invitedGuestCount: 11,
        plusOneAllowed: false,
        childrenInvited: false,
        invitationType: 'Unknown',
      },
    });

  const response = await POST(lookupRequest('Bad Row'));
  const result = await response.json();

  assert.equal(response.status, 502);
  assert.match(result.error, /not configured correctly/i);
});

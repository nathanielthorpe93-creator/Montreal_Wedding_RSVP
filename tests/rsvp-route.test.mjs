import assert from 'node:assert/strict';
import test from 'node:test';
import { POST } from '../app/api/rsvp/route.ts';

function rsvpRequest(overrides = {}) {
  return new Request('https://example.test/api/rsvp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      partyName: 'Mr. Ryan Thorpe',
      email: 'ryan@example.com',
      phone: '615-555-0123',
      songRequest: '',
      groupFlight: false,
      notes: '',
      guests: [
        {
          name: 'Ryan Thorpe',
          attendance: 'declining',
          meal: '',
          dietary: '',
        },
      ],
      ...overrides,
    }),
  });
}

function configureEnvironment() {
  process.env.RSVP_APPS_SCRIPT_URL =
    'https://script.google.com/macros/s/test/exec';
  process.env.RSVP_SHARED_SECRET = 'server-only-test-secret';
}

test('blocks an unknown party before RSVP submission', async () => {
  configureEnvironment();
  const actions = [];
  globalThis.fetch = async (_url, init) => {
    actions.push(JSON.parse(init.body).action);
    return Response.json({ success: true, found: false });
  };

  const response = await POST(rsvpRequest({ partyName: 'John Smith' }));
  const result = await response.json();

  assert.equal(response.status, 404);
  assert.equal(result.success, false);
  assert.match(result.error, /couldn’t find that invitation/i);
  assert.deepEqual(actions, ['lookupInvitation']);
});

test('revalidates a valid invitation and then submits its canonical name', async () => {
  configureEnvironment();
  const forwardedBodies = [];
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    forwardedBodies.push(body);
    if (body.action === 'lookupInvitation') {
      return Response.json({
        success: true,
        found: true,
        invitation: {
          invitationName: 'Mr. Ryan Thorpe',
          invitedGuestCount: 3,
        },
      });
    }
    return Response.json({ success: true });
  };

  const response = await POST(rsvpRequest({ partyName: 'mr ryan thorpe' }));
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(result, { success: true });
  assert.deepEqual(
    forwardedBodies.map((body) => body.action),
    ['lookupInvitation', 'submitRsvp'],
  );
  assert.equal(forwardedBodies[1].partyName, 'Mr. Ryan Thorpe');
});

test('blocks a submission that exceeds the Sheet guest limit', async () => {
  configureEnvironment();
  let requestCount = 0;
  globalThis.fetch = async () => {
    requestCount += 1;
    return Response.json({
      success: true,
      found: true,
      invitation: {
        invitationName: 'An Individual',
        invitedGuestCount: 1,
      },
    });
  };

  const guest = {
    name: 'Guest',
    attendance: 'declining',
    meal: '',
    dietary: '',
  };
  const response = await POST(
    rsvpRequest({ partyName: 'An Individual', guests: [guest, guest] }),
  );

  assert.equal(response.status, 400);
  assert.equal(requestCount, 1);
});

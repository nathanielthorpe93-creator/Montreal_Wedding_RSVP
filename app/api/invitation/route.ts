type InvitationType =
  | 'Family'
  | 'Named Couple'
  | 'Individual + Guest'
  | 'Individual'
  | 'Special';

type InvitationRecord = {
  invitationName: string;
  primaryGuest: string;
  invitedGuestCount: number;
  plusOneAllowed: boolean;
  childrenInvited: boolean;
  invitationType: InvitationType;
};

const INVITATION_TYPES = new Set<InvitationType>([
  'Family',
  'Named Couple',
  'Individual + Guest',
  'Individual',
  'Special',
]);

const NOT_FOUND_MESSAGE =
  'We couldn’t find that invitation. Please try the main name or family name from your invitation. If you still need help, contact Nathaniel or Morgan.';

const AMBIGUOUS_MESSAGE =
  'That name matches more than one invitation. Please add another name or include more of the party name from your invitation.';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validInvitation(value: unknown): value is InvitationRecord {
  if (!isRecord(value)) return false;

  return (
    typeof value.invitationName === 'string' &&
    Boolean(value.invitationName.trim()) &&
    typeof value.primaryGuest === 'string' &&
    Number.isInteger(value.invitedGuestCount) &&
    (value.invitedGuestCount as number) >= 1 &&
    (value.invitedGuestCount as number) <= 10 &&
    typeof value.plusOneAllowed === 'boolean' &&
    typeof value.childrenInvited === 'boolean' &&
    typeof value.invitationType === 'string' &&
    INVITATION_TYPES.has(value.invitationType as InvitationType)
  );
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { success: false, error: 'The invitation lookup must be valid JSON.' },
      { status: 400 },
    );
  }

  if (
    !isRecord(body) ||
    typeof body.partyName !== 'string' ||
    !body.partyName.trim()
  ) {
    return Response.json(
      {
        success: false,
        error: 'Please enter the party name from your invitation.',
      },
      { status: 400 },
    );
  }

  const partyName = body.partyName.trim().replace(/\s+/g, ' ');
  if (partyName.length > 150) {
    return Response.json(
      { success: false, error: 'Please enter a valid party name.' },
      { status: 400 },
    );
  }

  const appsScriptUrl = process.env.RSVP_APPS_SCRIPT_URL;
  const sharedSecret = process.env.RSVP_SHARED_SECRET;

  if (!appsScriptUrl || !sharedSecret) {
    return Response.json(
      {
        success: false,
        error: 'The RSVP service is not configured. Please try again later.',
      },
      { status: 503 },
    );
  }

  try {
    const parsedUrl = new URL(appsScriptUrl);
    if (parsedUrl.protocol !== 'https:') throw new Error('Invalid protocol');
  } catch {
    return Response.json(
      {
        success: false,
        error: 'The RSVP service is not configured. Please try again later.',
      },
      { status: 503 },
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'lookupInvitation',
        partyName,
        secret: sharedSecret,
      }),
      cache: 'no-store',
      redirect: 'follow',
      signal: controller.signal,
    });

    if (!response.ok) {
      return Response.json(
        {
          success: false,
          error:
            'We could not look up your invitation right now. Please try again.',
        },
        { status: 502 },
      );
    }

    const result: unknown = await response.json().catch(() => null);
    if (!isRecord(result) || result.success !== true) {
      return Response.json(
        {
          success: false,
          error:
            'We could not look up your invitation right now. Please try again.',
        },
        { status: 502 },
      );
    }

    if (result.found !== true) {
      return Response.json(
        {
          success: false,
          error:
            result.ambiguous === true ? AMBIGUOUS_MESSAGE : NOT_FOUND_MESSAGE,
        },
        { status: 404 },
      );
    }

    if (!validInvitation(result.invitation)) {
      return Response.json(
        {
          success: false,
          error:
            'This invitation is not configured correctly. Please contact Nathaniel or Morgan.',
        },
        { status: 502 },
      );
    }

    const invitation: InvitationRecord = {
      invitationName: result.invitation.invitationName.trim(),
      primaryGuest: result.invitation.primaryGuest.trim(),
      invitedGuestCount: result.invitation.invitedGuestCount,
      plusOneAllowed: result.invitation.plusOneAllowed,
      childrenInvited: result.invitation.childrenInvited,
      invitationType: result.invitation.invitationType,
    };

    return Response.json(
      { success: true, invitation },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return Response.json(
      {
        success: false,
        error: 'We could not reach the RSVP service. Please try again.',
      },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeout);
  }
}

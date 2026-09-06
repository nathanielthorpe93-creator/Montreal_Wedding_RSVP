type Attendance = 'attending' | 'declining';
type Meal = 'beef' | 'chicken' | 'vegetarian' | 'kids';

type RsvpGuest = {
  name: string;
  attendance: Attendance;
  meal: Meal | '';
  dietary: string;
};

type RsvpPayload = {
  partyName: string;
  email: string;
  phone: string;
  songRequest: string;
  groupFlight: boolean;
  notes: string;
  guests: RsvpGuest[];
};

type InvitationLookupResult = {
  success: true;
  found: true;
  invitation: {
    invitationName: string;
    invitedGuestCount: number;
  };
};

const VALID_ATTENDANCE = new Set<Attendance>(['attending', 'declining']);
const VALID_MEALS = new Set<Meal>(['beef', 'chicken', 'vegetarian', 'kids']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validLookupResult(value: unknown): value is InvitationLookupResult {
  if (!isRecord(value) || value.success !== true || value.found !== true) {
    return false;
  }

  const invitation = value.invitation;
  return (
    isRecord(invitation) &&
    typeof invitation.invitationName === 'string' &&
    Boolean(invitation.invitationName.trim()) &&
    Number.isInteger(invitation.invitedGuestCount) &&
    (invitation.invitedGuestCount as number) >= 1 &&
    (invitation.invitedGuestCount as number) <= 10
  );
}

function validatePayload(
  value: unknown,
): { success: true; data: RsvpPayload } | { success: false; error: string } {
  if (!isRecord(value)) {
    return { success: false, error: 'The RSVP submission is invalid.' };
  }

  const { partyName, email, phone, songRequest, groupFlight, notes, guests } =
    value;

  if (typeof partyName !== 'string' || !partyName.trim()) {
    return { success: false, error: 'Please provide a party name.' };
  }

  if (
    typeof email !== 'string' ||
    typeof phone !== 'string' ||
    typeof songRequest !== 'string' ||
    typeof groupFlight !== 'boolean' ||
    typeof notes !== 'string'
  ) {
    return {
      success: false,
      error: 'The RSVP submission contains invalid fields.',
    };
  }

  if (!email.trim() || !phone.trim()) {
    return {
      success: false,
      error:
        'Please provide one email address and phone number for your party.',
    };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return { success: false, error: 'Please provide a valid email address.' };
  }

  if (!Array.isArray(guests) || guests.length === 0) {
    return { success: false, error: 'Please include at least one guest.' };
  }

  if (guests.length > 10) {
    return {
      success: false,
      error: 'An RSVP may include no more than 10 guests.',
    };
  }

  const validatedGuests: RsvpGuest[] = [];

  for (let index = 0; index < guests.length; index += 1) {
    const guest = guests[index];
    const guestNumber = index + 1;

    if (!isRecord(guest)) {
      return { success: false, error: `Guest ${guestNumber} is invalid.` };
    }

    const { name, attendance, meal, dietary } = guest;

    if (typeof name !== 'string' || !name.trim()) {
      return {
        success: false,
        error: `Please provide a name for guest ${guestNumber}.`,
      };
    }

    if (
      typeof attendance !== 'string' ||
      !VALID_ATTENDANCE.has(attendance as Attendance)
    ) {
      return {
        success: false,
        error: `Please provide a valid attendance response for guest ${guestNumber}.`,
      };
    }

    if (typeof meal !== 'string' || typeof dietary !== 'string') {
      return {
        success: false,
        error: `Guest ${guestNumber} contains invalid fields.`,
      };
    }

    if (attendance === 'attending' && !VALID_MEALS.has(meal as Meal)) {
      return {
        success: false,
        error: `Please choose a meal for guest ${guestNumber}.`,
      };
    }

    if (attendance === 'declining' && meal && !VALID_MEALS.has(meal as Meal)) {
      return {
        success: false,
        error: `Guest ${guestNumber} has an invalid meal selection.`,
      };
    }

    validatedGuests.push({
      name: name.trim(),
      attendance: attendance as Attendance,
      meal: attendance === 'attending' ? (meal as Meal) : '',
      dietary: dietary.trim(),
    });
  }

  return {
    success: true,
    data: {
      partyName: partyName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      songRequest: songRequest.trim(),
      groupFlight,
      notes: notes.trim(),
      guests: validatedGuests,
    },
  };
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { success: false, error: 'The RSVP submission must be valid JSON.' },
      { status: 400 },
    );
  }

  const validation = validatePayload(body);
  if (!validation.success) {
    return Response.json(
      { success: false, error: validation.error },
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
    // Revalidate at submission time so a stale or modified browser cannot
    // bypass the invitation gate and create an RSVP for an unknown party.
    const lookupResponse = await fetch(appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'lookupInvitation',
        partyName: validation.data.partyName,
        secret: sharedSecret,
      }),
      cache: 'no-store',
      redirect: 'follow',
      signal: controller.signal,
    });
    const lookupResult: unknown = lookupResponse.ok
      ? await lookupResponse.json().catch(() => null)
      : null;

    if (
      isRecord(lookupResult) &&
      lookupResult.success === true &&
      lookupResult.found !== true
    ) {
      return Response.json(
        {
          success: false,
          error:
            'We couldn’t find that invitation. Please return to the invitation lookup and try again.',
        },
        { status: 404 },
      );
    }

    if (!validLookupResult(lookupResult)) {
      return Response.json(
        {
          success: false,
          error:
            'We could not verify your invitation right now. Please try again.',
        },
        { status: 502 },
      );
    }

    if (
      validation.data.guests.length >
      lookupResult.invitation.invitedGuestCount
    ) {
      return Response.json(
        {
          success: false,
          error:
            'This RSVP includes more guests than the invitation allows. Please return to the invitation lookup and try again.',
        },
        { status: 400 },
      );
    }

    const response = await fetch(appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...validation.data,
        partyName: lookupResult.invitation.invitationName.trim(),
        action: 'submitRsvp',
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
          error: 'We could not submit your RSVP right now. Please try again.',
        },
        { status: 502 },
      );
    }

    let result: unknown;
    try {
      result = await response.json();
    } catch {
      return Response.json(
        {
          success: false,
          error: 'We could not confirm your RSVP submission. Please try again.',
        },
        { status: 502 },
      );
    }

    if (
      !isRecord(result) ||
      result.success === false ||
      result.ok === false ||
      result.status === 'error'
    ) {
      return Response.json(
        {
          success: false,
          error: 'We could not submit your RSVP right now. Please try again.',
        },
        { status: 502 },
      );
    }

    return Response.json({ success: true });
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

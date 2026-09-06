'use client';

import { FormEvent, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ExternalLink,
  MapPin,
  Minus,
  Plus,
  RotateCcw,
  Utensils,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';

const PARTY_NAMES = [
  'The Musgraves Family', 'Mr. & Mrs. Perez', 'The Snow Family',
  'Miss Macey Corder & Guest', 'Papa and Meemah', 'Mr. Ryan Thorpe',
  'The Maggart Family', 'Lindsey Granier & Wade Kloeblen',
  'Jenna Drake & Chandler Welling', 'Mr. & Mrs. Caston',
  'Hunter Dreher & Guest', 'Mrs. Buck & Guest', 'Mr. & Mrs. Wine',
  'Mr. & Mrs. Woodall', 'Runne Gutierrez & Guest', 'Merlin Joyce & Guest',
  'Mr. & Mrs. Lemcke', 'Makayla Lessor & Josh Allessio', 'The Liska Family',
  'The Wright Family', 'The Liska Family', 'Laura Snow & Guest',
  'Mr. & Mrs. Linder', 'Kierstyn Evans & Jesse Levi', 'Mr. & Mrs. Howard',
  'Peter Liska & Kate Keough', 'The Stevens', 'Mr. Keough & Guest',
  'Mr. & Mrs. Recio', 'Mr. & Mrs. Sherin', 'Mr. & Mrs. Drew',
  'Iggy Robinson & Guest', 'Sarah Robinson & Guest', 'Abby & Max',
  'Mr. & Mrs. Loper', 'Taylor Covington & Elijah Moosekian',
  'Jack Weaver & Guest', 'Mason McKnight & Guest', 'Drew Laseur & Guest',
  'Mr. & Mrs. Lund', 'Zach Ball & Guest', 'Trey Kreid & Guest',
  'Kelly Dietrich & Guest', 'The Bell Family', 'Mr. & Mrs. McCormick',
  'Mr. & Mrs. Jackson',
] as const;

type Step = 'lookup' | 'rsvp' | 'confirmation';
type Attendance = '' | 'attending' | 'declining';
type Meal = '' | 'beef' | 'chicken' | 'vegetarian' | 'kids';
type Guest = { id: number; name: string; fixed: boolean; attendance: Attendance; meal: Meal; dietary: string };
type Invitation = { name: string; kind: 'family' | 'fixed' | 'open'; maxGuests: number; guests: Guest[]; guidance: string };

const MEALS: { value: Exclude<Meal, ''>; title: string; description: string }[] = [
  { value: 'beef', title: 'Beef filet', description: 'Potato gratin, broccolini, foie gras sauce' },
  { value: 'chicken', title: 'Chicken supreme', description: 'Des Voltigeurs Farm chicken, herbed potato purée, fine green beans, bacon lardons, jus' },
  { value: 'vegetarian', title: 'Vegetarian entrée', description: 'Seasonal vegetarian preparation; details to follow' },
  { value: 'kids', title: 'Children’s meal', description: 'A child-friendly meal; details to follow' },
];

function makeGuest(id: number, name = '', fixed = false): Guest {
  return { id, name, fixed, attendance: '', meal: '', dietary: '' };
}

function stripTitle(name: string) {
  return name.replace(/^(Miss|Mrs\.|Mr\.)\s+/, '').trim();
}

function invitationFor(name: string): Invitation {
  if (name.endsWith(' Family')) {
    return {
      name, kind: 'family', maxGuests: 10, guests: [makeGuest(1)],
      guidance: 'Add each member of your household who is included on this invitation — up to 10 people.',
    };
  }
  if (name === 'Mr. Ryan Thorpe') {
    return {
      name, kind: 'open', maxGuests: 3, guests: [makeGuest(1, 'Ryan Thorpe', true)],
      guidance: 'Your invitation includes Ryan and up to two guests.',
    };
  }
  if (name.endsWith(' & Guest')) {
    return {
      name, kind: 'open', maxGuests: 2,
      guests: [makeGuest(1, stripTitle(name.replace(' & Guest', '')), true)],
      guidance: 'Your invitation includes you and one optional guest.',
    };
  }
  if (name.startsWith('Mr. & Mrs. ')) {
    const lastName = name.replace('Mr. & Mrs. ', '');
    return {
      name, kind: 'fixed', maxGuests: 2,
      guests: [makeGuest(1, `Mr. ${lastName}`, true), makeGuest(2, `Mrs. ${lastName}`, true)],
      guidance: 'This invitation is reserved for the two guests named below.',
    };
  }
  if (name === 'Papa and Meemah') {
    return {
      name, kind: 'fixed', maxGuests: 2,
      guests: [makeGuest(1, 'Papa', true), makeGuest(2, 'Meemah', true)],
      guidance: 'This invitation is reserved for the two guests named below.',
    };
  }
  if (name === 'The Stevens') {
    return {
      name, kind: 'fixed', maxGuests: 2,
      guests: [makeGuest(1, 'Guest 1'), makeGuest(2, 'Guest 2')],
      guidance: 'Please enter the two names included on this invitation.',
    };
  }
  if (name.includes(' & ')) {
    const [first, second] = name.split(' & ');
    return {
      name, kind: 'fixed', maxGuests: 2,
      guests: [makeGuest(1, first, true), makeGuest(2, second, true)],
      guidance: 'This invitation is reserved for the two guests named below.',
    };
  }
  return {
    name, kind: 'open', maxGuests: 2,
    guests: [makeGuest(1, stripTitle(name), true)],
    guidance: 'Your invitation includes you and one optional guest.',
  };
}

function normalize(value: string) {
  return value
    .trim()
    .toLocaleLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findParty(query: string) {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return { match: undefined, ambiguous: false };

  const uniqueParties = Array.from(new Set(PARTY_NAMES));
  const exact = uniqueParties.find((party) => normalize(party) === normalizedQuery);
  if (exact) return { match: exact, ambiguous: false };

  const matches = uniqueParties.filter((party) => {
    const normalizedParty = normalize(party);
    return normalizedParty.includes(normalizedQuery);
  });

  return {
    match: matches.length === 1 ? matches[0] : undefined,
    ambiguous: matches.length > 1,
  };
}

function genericInvitation(name: string): Invitation {
  const enteredName = name.trim().replace(/\s+/g, ' ');
  return {
    name: enteredName,
    kind: 'open',
    maxGuests: 2,
    guests: [makeGuest(1, enteredName)],
    guidance: 'Please confirm your name below. This response may include you and one optional guest.',
  };
}

function Progress({ step }: { step: Step }) {
  const active = step === 'lookup' ? 1 : step === 'rsvp' ? 2 : 3;
  return (
    <div className="flex items-center gap-2" aria-label={`Step ${active} of 3`}>
      {[1, 2, 3].map((item) => (
        <span key={item} className={`h-px w-8 transition-colors ${item <= active ? 'bg-[#390908]' : 'bg-[#390908]/20'}`} />
      ))}
      <span className="ml-1 text-[10px] uppercase tracking-[0.16em]">{active} / 3</span>
    </div>
  );
}

export default function Home() {
  const [step, setStep] = useState<Step>('lookup');
  const [partyName, setPartyName] = useState('');
  const [lookupError, setLookupError] = useState('');
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [songRequest, setSongRequest] = useState('');
  const [groupFlight, setGroupFlight] = useState(false);
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [contactError, setContactError] = useState('');
  const nextId = useRef(20);

  const attending = useMemo(
    () => invitation?.guests.filter((guest) => guest.attendance === 'attending') ?? [],
    [invitation],
  );

  function lookup(event: FormEvent) {
    event.preventDefault();
    const { match, ambiguous } = findParty(partyName);
    if (!normalize(partyName)) {
      setLookupError('Please enter the party name from your invitation.');
      return;
    }
    if (ambiguous) {
      setLookupError('That name matches more than one invitation. Please add another name or include “Family.”');
      return;
    }
    setInvitation(match ? invitationFor(match) : genericInvitation(partyName));
    setLookupError('');
    setStep('rsvp');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function updateGuest(id: number, patch: Partial<Guest>) {
    const scrollPosition = window.scrollY;
    setInvitation((current) => current ? ({ ...current, guests: current.guests.map((guest) => guest.id === id ? { ...guest, ...patch } : guest) }) : current);
    setErrors((current) => ({ ...current, [id]: '' }));
    requestAnimationFrame(() => window.scrollTo({ top: scrollPosition, behavior: 'auto' }));
  }

  function addGuest() {
    setInvitation((current) => {
      if (!current || current.guests.length >= current.maxGuests) return current;
      const number = current.guests.length + 1;
      const label = current.kind === 'family' ? '' : number === 2 ? 'Guest' : `Guest ${number - 1}`;
      return { ...current, guests: [...current.guests, makeGuest(nextId.current++, label)] };
    });
  }

  function removeGuest(id: number) {
    setInvitation((current) => current ? ({ ...current, guests: current.guests.filter((guest) => guest.id !== id) }) : current);
    setErrors((current) => { const next = { ...current }; delete next[id]; return next; });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!invitation) return;
    const nextErrors: Record<number, string> = {};
    invitation.guests.forEach((guest) => {
      if (!guest.name.trim()) nextErrors[guest.id] = 'Please enter this guest’s name.';
      else if (!guest.attendance) nextErrors[guest.id] = 'Please choose attending or declining.';
      else if (guest.attendance === 'attending' && !guest.meal) nextErrors[guest.id] = 'Please choose an entrée.';
    });
    let nextContactError = '';
    if (!email.trim() || !phone.trim()) {
      nextContactError = 'Please add one email address and phone number for your party.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      nextContactError = 'Please enter a valid email address.';
    }
    setErrors(nextErrors);
    setContactError(nextContactError);
    if (Object.keys(nextErrors).length || nextContactError) {
      if (!Object.keys(nextErrors).length) {
        document.getElementById('party-contact')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      document.getElementById(`guest-${Object.keys(nextErrors)[0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setStep('confirmation');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function restart() {
    setStep('lookup'); setPartyName(''); setLookupError(''); setInvitation(null); setEmail(''); setPhone(''); setSongRequest(''); setGroupFlight(false); setNotes(''); setErrors({}); setContactError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <main className="min-h-screen lg:grid lg:grid-cols-[minmax(320px,0.86fr)_minmax(600px,1.14fr)]">
      <aside className="relative hidden min-h-screen overflow-hidden bg-[#280605] lg:sticky lg:top-0 lg:block lg:h-screen">
        <img src={step === 'confirmation' ? '/nathaniel-morgan.jpg' : '/curtain.png'} alt={step === 'confirmation' ? 'Nathaniel and Morgan smiling together' : 'Deep red velvet curtain'} className={`absolute inset-0 h-full w-full object-cover ${step === 'confirmation' ? 'grayscale' : 'opacity-80'}`} />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,0,0,.1),rgba(15,0,0,.68))]" />
        <div className="relative flex h-full flex-col justify-between p-12 text-[#f7f0e4] xl:p-16">
          <p className="font-display text-4xl tracking-[-0.03em]">N <span className="font-light italic">&</span> M</p>
          <div className="max-w-md">
            <p className="eyebrow text-[#f7f0e4]/70">A celebration in Montréal</p>
            <p className="mt-5 font-display text-6xl leading-[0.95] tracking-[-0.04em] xl:text-7xl">{step === 'confirmation' ? <>With love,<br /><span className="italic">thank you.</span></> : <>Meet us under<br />the lights.</>}</p>
          </div>
        </div>
      </aside>

      <section className="paper min-h-screen px-5 py-8 text-[#390908] sm:px-10 lg:px-14 lg:py-10 xl:px-20">
        <div className="mx-auto w-full max-w-[720px]">
          <header className="mb-10 flex items-center justify-between border-b border-[#390908]/20 pb-5 lg:mb-14">
            <a href="https://nathanielandmorgan.com" className="font-display text-2xl tracking-[-0.03em]">Nathaniel <span className="italic">&</span> Morgan</a>
            <Progress step={step} />
          </header>

          {step === 'lookup' && (
            <section className="flex min-h-[calc(100vh-190px)] flex-col justify-center pb-12">
              <div className="max-w-xl">
                <p className="eyebrow">The pleasure of your reply is requested</p>
                <h1 className="mt-5 font-display text-[clamp(4.25rem,10vw,7rem)] font-medium leading-[0.82] tracking-[-0.055em]">Kindly<br /><span className="ml-[0.55em] italic">respond.</span></h1>
                <p className="mt-8 max-w-md text-[15px] leading-7 text-[#390908]/70 sm:text-base">Please write out your party name as it appears on your invitation.</p>
                <form onSubmit={lookup} className="mt-8 max-w-md" noValidate>
                  <label htmlFor="party-name" className="mb-2.5 block text-xs font-semibold uppercase tracking-[0.16em]">Party name</label>
                  <Input id="party-name" value={partyName} onChange={(event) => { setPartyName(event.target.value); setLookupError(''); }} placeholder="e.g. The Thorpe Family" autoComplete="off" aria-invalid={Boolean(lookupError)} aria-describedby={lookupError ? 'lookup-error' : undefined} className="h-14 rounded-none border-x-0 border-t-0 border-[#390908]/35 bg-transparent px-0 text-base shadow-none placeholder:text-[#390908]/35 focus-visible:border-[#390908] focus-visible:ring-0" />
                  <Button type="submit" className="mt-6 h-13 w-full rounded-none bg-[#390908] px-6 text-xs font-semibold uppercase tracking-[0.16em] text-[#f7f0e4] hover:bg-[#5b1412]">Find my invitation <ArrowRight className="ml-2 size-4" /></Button>
                  {lookupError && <p id="lookup-error" role="alert" className="mt-4 text-sm leading-6 text-[#8b1e18]">{lookupError}</p>}
                  <p className="mt-5 text-center text-sm font-bold uppercase tracking-[0.13em] text-[#390908]/85">Please reply by May 21, 2027</p>
                </form>
              </div>
              <footer className="mt-16 grid gap-3 border-t border-[#390908]/20 pt-5 text-xs uppercase tracking-[0.13em] text-[#390908]/70 sm:grid-cols-2">
                <p className="flex items-center gap-2"><CalendarDays className="size-4" /> August 21, 2027</p>
                <p className="flex items-center gap-2 sm:justify-end"><MapPin className="size-4" /> Montréal, Québec</p>
              </footer>
            </section>
          )}

          {step === 'rsvp' && invitation && (
            <section className="pb-16">
              <button type="button" onClick={() => setStep('lookup')} className="mb-8 flex min-h-11 items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#390908]/65 hover:text-[#390908]"><ArrowLeft className="size-4" /> Back to lookup</button>
              <p className="eyebrow">We found your invitation</p>
              <h1 className="mt-3 max-w-2xl font-display text-5xl font-medium leading-[0.95] tracking-[-0.045em] sm:text-6xl">{invitation.name}</h1>
              <p className="mt-5 max-w-xl text-[15px] leading-7 text-[#390908]/70">{invitation.guidance}</p>
              <div className="mt-6 flex flex-wrap gap-x-7 gap-y-2 border-y border-[#390908]/15 py-4 text-[11px] uppercase tracking-[0.13em] text-[#390908]/65">
                <span className="flex items-center gap-2"><CalendarDays className="size-4" /> Saturday, August 21, 2027</span>
                <span className="flex items-center gap-2"><MapPin className="size-4" /> Montréal, Québec</span>
              </div>

              <form onSubmit={submit} className="mt-10" noValidate>
                <div className="space-y-6">
                  {invitation.guests.map((guest, index) => (
                    <article id={`guest-${guest.id}`} key={guest.id} className="border border-[#390908]/20 bg-[#f8f1e6]/70 p-5 shadow-[0_12px_32px_rgba(57,9,8,.045)] sm:p-7">
                      <div className="flex items-start justify-between gap-5">
                        <div className="min-w-0 flex-1">
                          <p className="eyebrow text-[#390908]/55">Guest {index + 1}</p>
                          {guest.fixed ? (
                            <h2 className="mt-1 truncate font-display text-3xl font-medium">{guest.name}</h2>
                          ) : (
                            <div className="mt-3">
                              <label htmlFor={`name-${guest.id}`} className="sr-only">Guest {index + 1} name</label>
                              <Input id={`name-${guest.id}`} value={guest.name} onChange={(event) => updateGuest(guest.id, { name: event.target.value })} placeholder="Full name" className="h-12 rounded-none border-x-0 border-t-0 border-[#390908]/30 bg-transparent px-0 font-display text-2xl shadow-none placeholder:text-[#390908]/35 focus-visible:border-[#390908] focus-visible:ring-0" />
                            </div>
                          )}
                        </div>
                        {!guest.fixed && invitation.kind !== 'fixed' && invitation.guests.length > 1 && (
                          <Button type="button" variant="ghost" size="icon" aria-label={`Remove guest ${index + 1}`} onClick={() => removeGuest(guest.id)} className="rounded-full text-[#390908]/55 hover:bg-[#390908]/8 hover:text-[#390908]"><Minus className="size-4" /></Button>
                        )}
                      </div>

                      <fieldset className="mt-6">
                        <legend className="text-xs font-semibold uppercase tracking-[0.14em]">Will you be joining us?</legend>
                        <RadioGroup value={guest.attendance} onValueChange={(value) => updateGuest(guest.id, { attendance: value as Attendance, meal: value === 'declining' ? '' : guest.meal })} className="mt-3 grid gap-2 sm:grid-cols-2">
                          {[['attending', 'Joyfully accepts'], ['declining', 'Regretfully declines']].map(([value, label]) => (
                            <label key={value} className="flex min-h-12 cursor-pointer items-center gap-3 border border-[#390908]/20 px-4 text-sm has-[[data-checked]]:border-[#390908] has-[[data-checked]]:bg-[#390908] has-[[data-checked]]:text-[#f7f0e4]">
                              <RadioGroupItem value={value} className="border-current data-checked:bg-transparent data-checked:text-current data-checked:border-current" />
                              {label}
                            </label>
                          ))}
                        </RadioGroup>
                      </fieldset>

                      {guest.attendance === 'attending' && (
                        <div className="mt-7 border-t border-[#390908]/15 pt-7">
                          <div className="flex items-center gap-2"><Utensils className="size-4" /><h3 className="text-xs font-semibold uppercase tracking-[0.14em]">Select an entrée</h3></div>
                          <RadioGroup value={guest.meal} onValueChange={(value) => updateGuest(guest.id, { meal: value as Meal })} className="mt-4 grid gap-2">
                            {MEALS.map((meal) => (
                              <label key={meal.value} className="group flex cursor-pointer gap-3 border border-[#390908]/18 p-4 transition-colors has-[[data-checked]]:border-[#390908] has-[[data-checked]]:bg-[#e9ddcb]/65">
                                <RadioGroupItem value={meal.value} className="mt-0.5" />
                                <span><span className="block text-sm font-semibold">{meal.title}</span><span className="mt-1 block text-xs leading-5 text-[#390908]/60">{meal.description}</span></span>
                              </label>
                            ))}
                          </RadioGroup>
                          <label htmlFor={`dietary-${guest.id}`} className="mt-6 block text-xs font-semibold uppercase tracking-[0.14em]">Allergies or dietary restrictions</label>
                          <Textarea id={`dietary-${guest.id}`} value={guest.dietary} onChange={(event) => updateGuest(guest.id, { dietary: event.target.value })} placeholder="Please tell us anything the kitchen should know (optional)." className="mt-3 min-h-24 rounded-none border-[#390908]/25 bg-transparent text-sm focus-visible:border-[#390908] focus-visible:ring-0" />
                        </div>
                      )}
                      {errors[guest.id] && <p role="alert" className="mt-4 text-sm font-medium text-[#8b1e18]">{errors[guest.id]}</p>}
                    </article>
                  ))}
                </div>

                {invitation.kind !== 'fixed' && invitation.guests.length < invitation.maxGuests && (
                  <Button type="button" variant="outline" onClick={addGuest} className="mt-5 h-12 w-full rounded-none border-[#390908]/35 bg-transparent text-xs font-semibold uppercase tracking-[0.14em] hover:bg-[#e9ddcb]/70"><Plus className="mr-2 size-4" /> {invitation.kind === 'family' ? 'Add household member' : invitation.guests.length === 1 ? 'Add guest' : 'Add another guest'}</Button>
                )}
                {invitation.kind === 'family' && <p className="mt-3 text-center text-xs text-[#390908]/55">{invitation.guests.length} of {invitation.maxGuests} household places added</p>}

                <div id="party-contact" className="mt-10 border-t border-[#390908]/20 pt-8">
                  <h2 className="font-display text-3xl">Best way to reach your party</h2>
                  <p className="mt-2 text-sm leading-6 text-[#390908]/60">Please share one phone number and email address for your party.</p>
                  <div className="mt-5 grid gap-5 sm:grid-cols-2">
                    <div>
                      <label htmlFor="party-email" className="block text-xs font-semibold uppercase tracking-[0.14em]">Email address</label>
                      <Input id="party-email" type="email" value={email} onChange={(event) => { setEmail(event.target.value); setContactError(''); }} placeholder="you@example.com" autoComplete="email" aria-invalid={Boolean(contactError)} className="mt-2 h-12 rounded-none border-[#390908]/25 bg-transparent focus-visible:border-[#390908] focus-visible:ring-0" />
                    </div>
                    <div>
                      <label htmlFor="party-phone" className="block text-xs font-semibold uppercase tracking-[0.14em]">Phone number</label>
                      <Input id="party-phone" type="tel" value={phone} onChange={(event) => { setPhone(event.target.value); setContactError(''); }} placeholder="(615) 555-0123" autoComplete="tel" aria-invalid={Boolean(contactError)} className="mt-2 h-12 rounded-none border-[#390908]/25 bg-transparent focus-visible:border-[#390908] focus-visible:ring-0" />
                    </div>
                  </div>
                  {contactError && <p role="alert" className="mt-4 text-sm font-medium text-[#8b1e18]">{contactError}</p>}
                </div>

                <div className="mt-10 border-t border-[#390908]/20 pt-8">
                  <label htmlFor="song-request" className="block font-display text-3xl">What song will get you on the dance floor?</label>
                  <p className="mt-2 text-sm leading-6 text-[#390908]/60">Share a song request for the reception. This field is optional.</p>
                  <Input id="song-request" value={songRequest} onChange={(event) => setSongRequest(event.target.value)} placeholder="Song title and artist" className="mt-4 h-12 rounded-none border-[#390908]/25 bg-transparent focus-visible:border-[#390908] focus-visible:ring-0" />
                </div>

                <div className="mt-10 border-t border-[#390908]/20 pt-8">
                  <h2 className="font-display text-3xl">Travelling from Nashville?</h2>
                  <p className="mt-2 text-sm leading-6 text-[#390908]/60">Please click below if you would be interested in joining a group flight for discounted plane tickets.</p>
                  <label className="mt-5 flex cursor-pointer items-start gap-3 border border-[#390908]/20 bg-[#f8f1e6]/50 p-4 text-sm leading-6 has-[[data-checked]]:border-[#390908] has-[[data-checked]]:bg-[#e9ddcb]/65">
                    <Checkbox checked={groupFlight} onCheckedChange={(checked) => setGroupFlight(checked === true)} className="mt-1 rounded-none" />
                    <span>I’m interested in receiving group-flight information.</span>
                  </label>
                </div>

                <div className="mt-10 border-t border-[#390908]/20 pt-8">
                  <label htmlFor="notes" className="block font-display text-3xl">Anything else we should know?</label>
                  <p className="mt-2 text-sm leading-6 text-[#390908]/60">Share a note or special request we should know about.</p>
                  <Textarea id="notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Leave Nathaniel and Morgan a note…" className="mt-4 min-h-32 rounded-none border-[#390908]/25 bg-transparent focus-visible:border-[#390908] focus-visible:ring-0" />
                  <Button type="submit" className="mt-6 h-14 w-full rounded-none bg-[#390908] text-xs font-semibold uppercase tracking-[0.16em] text-[#f7f0e4] hover:bg-[#5b1412]">Submit RSVP <ArrowRight className="ml-2 size-4" /></Button>
                  <p className="mt-4 text-center text-xs leading-5 text-[#390908]/55">Prototype only — no response will be sent or saved yet.</p>
                </div>
              </form>
            </section>
          )}

          {step === 'confirmation' && invitation && (
            <section className="flex min-h-[calc(100vh-190px)] flex-col justify-center pb-12 text-center" aria-live="polite">
              <span className="mx-auto flex size-14 items-center justify-center rounded-full border border-[#390908]/25"><Check className="size-6" /></span>
              <p className="eyebrow mt-7">RSVP complete</p>
              <h1 className="mx-auto mt-4 max-w-xl font-display text-[clamp(3.6rem,9vw,6rem)] font-medium leading-[0.88] tracking-[-0.05em]">{attending.length ? <>Merci —<br /><span className="italic">we’ll see you there.</span></> : <>Thank you<br /><span className="italic">for letting us know.</span></>}</h1>
              <p className="mx-auto mt-7 max-w-md text-[15px] leading-7 text-[#390908]/65">{attending.length ? `We’ve noted ${attending.length === 1 ? 'one guest' : `${attending.length} guests`} attending from ${invitation.name}. We can’t wait to celebrate together in Montréal.` : `We’ll miss you, ${invitation.name}, and we’re grateful you took a moment to reply.`}</p>

              <div className="mx-auto mt-8 w-full max-w-md border-y border-[#390908]/20 py-5 text-left">
                <div className="flex justify-between gap-6 text-xs uppercase tracking-[0.13em]"><span className="text-[#390908]/55">Party</span><strong className="text-right font-semibold">{invitation.name}</strong></div>
                <div className="mt-4 flex justify-between gap-6 border-t border-[#390908]/12 pt-4 text-xs uppercase tracking-[0.13em]"><span className="text-[#390908]/55">Response</span><strong className="text-right font-semibold">{attending.length ? `${attending.length} attending` : 'Party declined'}</strong></div>
              </div>

              <div className="mx-auto mt-8 flex w-full max-w-md flex-col gap-3 sm:flex-row">
                <a href="https://nathanielandmorgan.com" className="inline-flex h-13 flex-1 items-center justify-center bg-[#390908] px-5 text-xs font-semibold uppercase tracking-[0.14em] text-[#f7f0e4] transition-colors hover:bg-[#5b1412] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#6d1917]/40">Visit our wedding site <ExternalLink className="ml-2 size-4" /></a>
                <Button type="button" variant="outline" onClick={restart} className="h-13 rounded-none border-[#390908]/30 bg-transparent px-5 text-xs font-semibold uppercase tracking-[0.14em] hover:bg-[#e9ddcb]/70"><RotateCcw className="mr-2 size-4" /> Try another RSVP</Button>
              </div>
              <p className="mt-8 text-xs uppercase tracking-[0.15em] text-[#390908]/55">Please reply by May 21, 2027</p>
            </section>
          )}
        </div>
      </section>
    </main>
  );
}

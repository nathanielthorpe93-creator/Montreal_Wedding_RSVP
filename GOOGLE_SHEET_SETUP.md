# Google Sheet and Apps Script setup

## Guest List columns

The Guest List headers stay on row 4 and records begin on row 5.

Insert a new column **C**, directly after **Invitation / Party Name**, and name it **Invitation Type**. The complete header order should be:

| Column | Header                  |
| ------ | ----------------------- |
| A      | Party ID                |
| B      | Invitation / Party Name |
| C      | Invitation Type         |
| D      | Primary Guest           |
| E      | Invited Guest Count     |
| F      | Plus-One Allowed        |
| G      | Children Invited        |
| H      | RSVP Deadline           |
| I      | RSVP Status             |
| J      | Contact Email / Phone   |
| K      | RSVP Rules / Notes      |

Apply a Google Sheets dropdown to `C5:C` with exactly these five values:

- `Family`
- `Named Couple`
- `Individual + Guest`
- `Individual`
- `Special`

Do not rename the headers. The Apps Script locates columns by these names rather than fixed letters.

## How each type behaves

| Invitation Type    | Sheet configuration                                                                                        | RSVP behavior                                                                                                                        |
| ------------------ | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Family             | Set the household maximum in Invited Guest Count; usually Plus-One Allowed = No and Children Invited = Yes | Starts with one editable household member and allows members up to the row maximum                                                   |
| Named Couple       | Invited Guest Count = 2, Plus-One Allowed = No                                                             | Shows two named/fixed places when names can be read from the invitation; otherwise asks for both names                               |
| Individual + Guest | Invited Guest Count = 2, Plus-One Allowed = Yes                                                            | Shows the primary guest and allows one optional guest                                                                                |
| Individual         | Invited Guest Count = 1, Plus-One Allowed = No                                                             | Shows one named guest and does not offer Add Guest                                                                                   |
| Special            | Use the row's guest count and Yes/No rules                                                                 | Supports exceptions without website code; Plus-One Allowed permits additional guests and Children Invited uses household-style entry |

Every row must have a valid Invitation Type and an Invited Guest Count from 1 through 10. Use `Yes` or `No` in Plus-One Allowed and Children Invited.

### Required special rows

- `Mr. Ryan Thorpe`: Invitation Type = `Special`, Primary Guest = `Ryan Thorpe`, Invited Guest Count = `3`, Plus-One Allowed = `Yes`, Children Invited = `No`.
- Both `The Liska Family` rows: Invitation Type = `Family`, Invited Guest Count = the same household limit (currently `10`), Plus-One Allowed = `No`, Children Invited = `Yes`.

The duplicate Liska name remains searchable. Lookup returns one generic family configuration and never sends either matching Sheet row to the browser. RSVP submission continues writing to RSVP Responses, but Guest List status/contact syncing skips duplicate-name matches so the wrong Liska row is not updated.

Invitation lookup prefers an exact normalized party-name match, but also accepts a unique meaningful portion of the invitation name. For example, `musgraves` finds `The Musgraves Family`. Generic words such as `the`, `family`, `Mr.`, `Mrs.`, and `guest` are ignored during partial matching. If the entered words match more than one distinct invitation, the website asks the guest for more of the party name instead of guessing.

## Apps Script update

Replace the deployed Apps Script with the complete contents of `google-apps-script/Code.gs`. The replacement preserves the current RSVP Responses writes and Guest List status/contact updates, and adds the `lookupInvitation` action.

The script property `RSVP_SHARED_SECRET` must remain set to the same secret as the website's server-side `RSVP_SHARED_SECRET` environment variable. The browser never receives this secret or the Apps Script URL.

After saving the script:

1. Choose **Deploy → Manage deployments**.
2. Edit the existing web-app deployment.
3. Select **New version** and deploy it.
4. Keep the resulting `/exec` URL in the website's server-side `RSVP_APPS_SCRIPT_URL` environment variable.

## Quick verification

1. Look up a unique family and confirm its Sheet maximum controls the household limit.
2. Look up `Mr. Ryan Thorpe` and confirm the form allows Ryan plus two guests (three total).
3. Look up `The Liska Family` and confirm a single family form appears.
4. Enter an unknown name and confirm the RSVP form does not open.
5. Submit a unique party and confirm RSVP Responses and the unique Guest List row update as before.
6. Submit The Liska Family and confirm RSVP Responses updates while both duplicate Guest List rows remain untouched.

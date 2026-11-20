# How to update The Anxious Patient Experience website

Web address: **[your website]/admin** (for now: https://the-anxious-patient-experience.vercel.app/admin)

### Signing in
- Your login is your own email address. When GYA adds you, you get an email called "Your login for The Anxious
  Patient Experience website dashboard" with a link to choose your password (the link works once, for 72 hours).
  Check junk mail if it has not arrived.
- **Forgotten your password?** On the sign-in page press **Forgotten your password?**, enter your email and use the
  link that arrives to choose a new one. If it has been a few minutes and nothing has come, call GYA on 1300 889 840.
- Passwords need at least 10 characters with letters and numbers. Please do not share a login: everyone who needs
  one can have their own.

### Who can sign in
The logins are: lorna-gladwin1@hotmail.co.uk, reception@thecaringbahdentists.com.au,
reception@thecronulladentists.com.au and theanxiouspatientexperience@gmail.com. To add, change or remove one, just
email GYA with the new address: we add it to the list and the person gets their own link to choose a password.
Removing an address from the list does not delete the login, so tell us when someone should no longer have access.

### Who can open patient questionnaires (v1.10.0)
Having a login is **not** enough. Only people ticked **Can view patient questionnaires** can open them. Lorna is the
practice owner, so she sees **Users** in the menu and can tick or untick that box for anyone, herself included. Every
change is recorded (who, for whom, when: **Questionnaire access changes** at the bottom of the screen), and the person
given access gets a short email. Other editors do not see the Users screen. Logins themselves are still added and
removed by GYA.

Changes to wording, photos, posts and settings are saved in the dashboard first, and go on the website when you
press **Publish website** (the website updates in about two minutes). Bookings and availability are different: they
change on the website straight away.

## QR code for the website
The dashboard home has a **QR code** panel with the code as a PNG (print and email), an A4 PDF ready to print and an
SVG for a designer. It opens theanxiouspatientexperience.com.au. Print it at least 2 cm wide on flyers and cards, and
8 cm or more for a poster or the front desk. The PNG and PDF are also in the Media Library.

## Emails and logins

**What the team gets.** Every new booking request, deposit received and questionnaire received email goes to the
people under **Site Settings > Who receives booking emails** (at first, theanxiouspatientexperience@gmail.com). To add
or remove someone, change the list and press **Save settings**; it applies to the next booking, no need to publish.
Replying to a booking email replies to the patient. The subject starts with the reference, for example "New booking
request APE-1A2B3C", so it is easy to search for.

**If an email could not be sent.** The booking is always saved. The website tries again after a minute; if it still
fails, the booking shows an amber **Email not sent** note under Bookings with **Resend to patient** or **Resend to team**.
The Emails column shows a tick for each email that went out. The dashboard home says "Emails: working", or how many
failed in the last week.

**Forgotten your password?** On the sign-in page press **Forgotten your password?** and enter your email. The link
works once and lasts an hour; you get a "Your password was changed" email afterwards. If nothing arrives within a few
minutes, check junk mail, then call GYA on 1300 889 840.

## Bookings

### When a booking request comes in
v1.12.0: once online payment is set up, patients pay the $100 deposit while they book. Their time is held for 30
minutes while they pay; the request (and both emails) only arrive once it is paid. While they are paying the booking
shows as **Paying now** (nothing to do yet). If they don't finish within 30 minutes, the time is released and the
booking shows under **Cancelled** as **Released: not paid**. Until online payment is set up, requests come in as
before and the team follows up the deposit.

1. You get an email at the APE inbox (theanxiouspatientexperience@gmail.com) with every detail of the request
   (since v1.10.0 the first name, last name, phone and date of birth with the age are all required, so you have what
   you need for Core Practice), and
   the patient gets an email saying their request has been received, with the deposit link. Replying to your email
   replies straight to the patient. The request also shows under **Bookings** as **To confirm** (the number beside
   Bookings in the menu is how many are waiting). The time is held, so nobody else can book it online.
2. Block the time in Core Practice and enter the patient.
3. Reply to the patient to confirm and send the new patient information pack.
4. Press **Mark confirmed**. The patient is emailed "Your APE appointment is confirmed" with the date, time, address
   and directions, and your Patient Guide and questionnaire attached (v1.12.0: this confirmation email is now on).
   The deposit looks after itself: patients pay the $100 on the website by card (no PayPal
   account needed) or with PayPal, the booking shows **Received** and you get a "Deposit received" email. You never need to open PayPal to
   check. If a patient has not paid, the booking sits under the **Deposit not paid** filter and their email has a
   private pay link that works for 14 days. If someone pays another way, press **Mark deposit received manually**
   and add a note.

### Patients under 18 (v1.13.0)
The Anxious Patient Experience is for patients aged 15 and over. The website works out the patient's age on the day
of the appointment from their date of birth:

- **Under 15**: they cannot book online. Book Now explains why and gives the clinic's phone number and the APE email.
- **15 to 17**: they must enter a parent or guardian's full name. On **Bookings** the booking shows "Age 16 at
  appointment", an **Under 18** tag and "Parent or guardian: [name]"; the booking email to you has both too. The
  patient's emails ask them to bring their parent or guardian to their first visit.
- Bookings made before dates of birth were asked for show "DOB not given".

### Refunds
Refunds are done in PayPal (Activity > the payment > Refund). The booking then shows **Refunded** here by itself.

Click a patient's name to see their note, first and last name, date of birth, and the terms they agreed to: the
version of the terms and cancellation policy they saw, when they ticked "I consent", and when they ticked "I have
read" before the deposit (and on the pay-later page, if they paid there). Bookings made before 17 November 2026 show
"not given" for the date of birth. Patients under 18 at the appointment show an **Under 18** label.
**Download for Excel (CSV)** saves the list, with all of these columns.

### The deposit policy (v1.11.0)
Site Settings > **Open Deposit policy**. Lorna's deposit policy (her email of 18 Nov 2026), which patients read in a
pop-up between their details and the deposit, and on the pay-later page; they tick the box and press **I Agree &
Continue**. A line starting `## ` is a heading; `{deposit}` becomes the deposit amount and `{phone}` the phone number.
Saving a change gives it the next version number (each booking keeps the version the patient agreed to, and when).
Once Lorna has approved a version, press **Lorna has approved version ...** to record it. It must still mention 48
hours. The three short lines on the deposit step itself are page wording: Pages > Book Now.

### Where bookings came from (v1.11.0)
Each booking shows where the patient came from (Instagram, a clinic website, Google, an email, the flyer QR code or
Direct) in the **Source** column, and the Dashboard has a **Where bookings came from (last 30 days)** box. More in
`docs/HOW-TO-SEE-YOUR-NUMBERS.md`; the links to use are in `docs/TRACKING-LINKS.md`.

### If a patient cancels
Press **Cancel booking**. The time opens up on the website again (and an opening special place is freed). The
website does not email the patient, so let them know yourself. **Restore** under Cancelled brings a booking back.

## Availability: leave and booking times

### Blocking days when you are away
1. Click **Availability**.
2. Under **Block time off**, choose the **First day** you are away and, for more than one day, the **Last day**.
3. Add a note if you like, for example "Annual leave". Patients never see it.
4. Press **Block these days**. Every booking day in that period is closed to online bookings.

If someone has already booked a day you block, the dashboard tells you their name so you can contact them. Blocking
does not cancel their booking; cancel it under Bookings once you have spoken to them.

To open a day again, press **Open this day** (or **Open** in the Blocked list). To block or open a single time, tap
that time in the list of weeks. 23 and 30 December 2026 are already blocked for Christmas.

### Changing the weekly booking times
Under **Booking times**, tick the days and add or remove start times, then press **Save booking times**. Patients see
the new times on Book Now straight away. Bookings already made keep their time. **Use the standard times** puts back
Wednesdays at 9:00 am, 10:20 am and 11:40 am.

## Welcome pack and questionnaires

The welcome email is on (v1.12.0): it is the patient's confirmation, sent when you press **Mark confirmed**. You
approved the online questionnaire on 19 Nov 2026 (v1.13.0). It goes live as soon as GYA adds the encryption key;
until then patients get the questionnaire as a PDF in that email. Every question is optional, but the questionnaire
now kindly asks patients to fill out as much as possible. Patients under 18 are told they are welcome to fill it out
with their parent or guardian. Where to find completed
questionnaires: Questionnaires in the menu (GYA's PDF "Where to find the questionnaire").

### What patients get
When you press **Mark confirmed**, the patient is emailed "Your APE appointment is confirmed" with your
Patient Guide and your Pre-appointment Questionnaire attached, the address, your train and parking directions and
the phone number. Once the online questionnaire is on, the email also has a private link so they can fill it in on
their phone or computer, save it and come back later. Patients are also offered the questionnaire straight after
they book on the website, and can fill it in right there; if they do, the welcome email simply thanks them for it. Each booking gets it once. To send it by hand (for example
for a booking confirmed before it was switched on, or if a patient lost the email), press **Send welcome pack** on
the booking.

### Changing the PDFs or the email
Site Settings > **Open Welcome pack**. To update the guide or the questionnaire, press **Choose another PDF** and
upload the new file; **Use the standard version** goes back to the APE version GYA made from your files. The email wording, the collection notice
and who gets questionnaire notifications are on the same screen. Press **Save**; no Publish needed.

### Knowing when one arrives
Each time a patient sends the online questionnaire, an email goes to the addresses under **Questionnaire
notifications go to** (Site Settings, also on the Welcome pack screen), or to **Who receives booking emails** while
that list is empty. It has the booking reference and appointment date only, never answers, names or dates of birth. The Questionnaires item in the menu shows how many are waiting to be reviewed.

### Reading a questionnaire
Open **Questionnaires**, press **Open** on the entry. **At a glance** at the top shows the full name and date of
birth the patient entered (with **Name or DOB differs from the booking** if they do not match, so you can check
before entering it in Core Practice), the anxiety score, what
makes them anxious and how they would like the appointment to feel; every answer follows in the same order as your
questionnaire. Press **Mark reviewed** when done, and **Print / Save as PDF** for the clinical record. You can only
open questionnaires if your login has been ticked: Lorna does this on the **Users** screen (see Who can open patient
questionnaires above). Every time a questionnaire is opened, a record is kept of who and when.

## Google reviews
The page at **/review/** is for QR codes and messages (it is not in the menu). Every star and the button go to the
same Google review link, which lives under Site Settings, **Google review link**. Until the Google Business Profile
exists and that link is filled in, the page says reviews are coming soon. The wording is edited from the **Review
page** item in the menu, like any page, then Publish website.

## Opening special
The **Opening special** page shows how many of the six $250 places are used and whether the special is showing on the
website. It switches itself off once six are booked or the special dates have passed. The price and the number of
places are set by GYA.

### The pop-up
Opening special > **Settings and the pop-up**: switch the special or the pop-up on or off, change the dates, set
how many seconds after the homepage opens it appears (0.8 is standard), and edit its heading and wording. It shows
once per visit and not again for 7 days after someone closes it. Saved changes apply straight away.

## Changing words on a page
1. Click **Pages**, then the page (for example **Home**).
2. The page shows as it looks on the website. Click any words and type. Bold, Italic and Link are on the right.
   Press Esc when you are done with that part.
3. Press **Save changes**, then **Publish website**.

Shaded words (like the phone number) come from **Site Settings**, so they change everywhere at once from there.
The footer's tagline, disclaimer and copyright line can be changed from any page and change on every page. The menu
is changed by GYA.

## Swapping a photo
Click the photo on the page, then **Choose from library** or **Upload**. Use a photo of a similar shape so the layout
stays as approved, and fill in the description (it is read aloud to people who cannot see the photo). **Put back the
original photo** undoes it. Save changes, then Publish website.

Please keep to Lorna's photo rules: no faces except the team's own photos, and no clinic rooms or dental chairs unless
they are genuine photos of the practice.

## Updating the team
Click **Team** in the menu. Each person on the homepage team shows as a card, in the order they appear.
1. Press **Edit** on a card. A panel opens with their photo, photo description, name, role and bio. Change what you
   need, then press **Done**.
2. Drag the dots at the top of a card to change the order. The eye hides someone from the website without deleting
   them (press it again to bring them back). The bin removes them, after asking you to confirm.
3. **Add a team member** adds a new card at the end: add their photo, name, role and a short bio.
4. Press **Save changes**, then **Publish website**.

**Edit on the homepage** opens the homepage editor at the team, if you would rather change the words on the page
itself. Both places edit the same cards. Please never describe Lorna, or anyone on the team, as a "specialist": she is
a general dentist. The team shows three across on a computer, so the screen warns you if the last card would sit on
its own.

## Moving, hiding or showing a section
In the page editor, open the **Sections** tab. Drag the dots to move a section, and press the eye to hide or show it.
Save changes, then Publish website.

## Search engines (SEO)
In the page editor, the **SEO** tab has the title and description Google shows, with a preview. **SEO** in the menu
lists every page so you can see which ones are worth a look.

## Writing a blog post
**Blog Posts** > **Write a new post**. Write the title and the post, choose a featured photo and a short summary, then
**Publish this post** and **Publish website**. The Blog link appears in the menu with the first post.

Advertising rules for health practices (AHPRA) apply to anything written on the website: no testimonials about
clinical care, and no "pain-free", "guaranteed", "best" or "expert" claims. Offers must state the price, what is
included and the dates. Please never describe Lorna as a "specialist".

## Contact details
**Site Settings** holds the phone number, the two email addresses and the clinic address. Change them once, press
**Save settings**, then **Publish website**.

## Checking it is live
After Publish website, wait two minutes and open the website (View site at the top). If something looks wrong, call
GYA on 1300 889 840.

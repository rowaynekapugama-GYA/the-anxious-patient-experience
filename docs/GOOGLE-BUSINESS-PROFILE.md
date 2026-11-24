# Google Business Profile for The Anxious Patient Experience

Prepared 11 November 2026. **Updated 24 November 2026 (v1.16.0):** Lorna has created the profile and it has been
verified. It is owned by her personal Google account. Sections 1, 2 and 4 are now history; the listing content to
enter is in `GOOGLE-BUSINESS-PROFILE-LISTING.md`, and section 5 below is what happens next.

## 1. Does a profile already exist?

Checked 11 Nov 2026 from the build environment (web search only; no browser signed in to Google was available in
that session):

- No Google Business Profile or Maps result was found for "The Anxious Patient Experience", for "Anxious Patient
  Experience Cronulla" or for Dr Lorna Gladwin as a practitioner listing. The only results for the name are the
  website itself and unrelated articles about dental anxiety.
- The practice address, 13 Cronulla Street, Cronulla NSW 2230, is **The Cronulla Dentists'** own listing.

**Still to do in a browser** before creating anything: search Google Maps for the three searches above and for the
address, signed in as rowayne@gyaclients.com, and look at Business Profile Manager (business.google.com) for any
profile Lorna's or the practice's Google account already owns. If one exists, request access to it instead of
creating a duplicate (Google merges or suspends duplicates).

## 2. Eligibility: which kind of listing (decision needed)

Google's rules that matter here (Business Profile guidelines, "Eligibility" and "Departments" / "Individual
practitioners"):

- A business must make in-person contact with customers at its address during stated hours, under the name it uses
  in the real world, and signage at the premises is part of how Google verifies that.
- A **department** inside another business may have its own profile only if it is public-facing with its own
  entrance, its own staff and its own hours.
- An **individual practitioner** (a dentist is Google's own example) may have a profile at the practice address,
  named after the person only (no brand or keywords added, for example "Dr Lorna Gladwin"), as long as they are
  public-facing and bookable at that location.

APE runs inside The Cronulla Dentists at 13 Cronulla Street (that is the address on the website, in Site Settings
and in the booking emails). Two facts decide the option and only the practice can confirm them: **do APE patients
attend 13 Cronulla Street for every APE appointment**, and **is there any APE signage at the premises** (door, window,
reception)?

| Option | What it is | Risk | Fit |
|---|---|---|---|
| a. Separate "The Anxious Patient Experience" listing at 13 Cronulla Street | A second business profile at the same address as The Cronulla Dentists | High. Google treats a service or brand inside an existing practice as part of that practice unless it has its own entrance, staff and hours. Without APE signage, video verification is likely to fail or the listing to be suspended later, which can also drag the Cronulla listing into a review. | Only if APE has its own signed entrance and its own hours |
| b. Practitioner listing "Dr Lorna Gladwin" at 13 Cronulla Street | Google-sanctioned profile for an individual practitioner, with APE described in the description and the website and booking links pointing at the APE site | Low. Explicitly allowed. The name must be hers alone (no "APE" in the title). Google allows one practitioner profile per location, so if she already has one at Caringbah, this is a second one at Cronulla, which is fine. Reviews land on her profile rather than on "APE". | **Recommended** |
| c. No new listing; the review page points at The Cronulla Dentists' existing profile | Zero set-up. Reviews strengthen the practice's existing listing, which is where APE appointments happen. | None for compliance. APE itself does not appear on Maps as a name. | Good fallback, and sensible until the domain and signage questions are settled |

**Recommendation: option b**, confidence moderate to high (about 75%). It gives Lorna a profile that can carry the
APE story, website and booking link, collects reviews, and sits inside Google's rules. Assumptions behind it: APE
appointments take place at 13 Cronulla Street; Lorna is happy for reviews to attach to her name; there is no separate
APE entrance or signage. If the practice does have APE signage and set APE hours, option a becomes defensible and I
would re-check before deciding. Until a decision, the review page can point at The Cronulla Dentists' existing
"Ask for reviews" link (option c) so nothing is blocked.

## 3. Listing content, ready to paste

Fill the blanks from Lorna's answers. Everything below follows the AHPRA advertising rules: Lorna is described as
a general dentist, with none of the superlative or comfort claims the guidelines prohibit, no testimonials and no
urgency.

**Business name**
- Option b: `Dr Lorna Gladwin` (exactly; no qualifications, suburb, brand or keywords in the name field)
- Option a (only if eligible): `The Anxious Patient Experience`

**Categories**
- Primary: `Dentist`
- Secondary (option b): `Dental clinic`. Nothing else; added categories are not evidence of anything and dilute
  relevance.

**Address**: 13 Cronulla Street, Cronulla NSW 2230 (shown, not hidden; patients attend in person).
Confirm with Lorna whether the entrance is on Cronulla Street or a side street so the map pin is right.

**Phone**: (02) 8599 9815 (the Cronulla Dentists line that the APE site uses).

**Website**: `https://theanxiouspatientexperience.com.au/` once live (until then the vercel.app address, then
update).

**Appointment link**:
`https://theanxiouspatientexperience.com.au/book-now/?utm_source=google&utm_medium=organic&utm_campaign=gbp`

**Hours**: the APE booking days and times from the dashboard (Availability), not the practice's full hours. At the
time of writing: Wednesdays, 9:00 am start, three sessions (confirm). Tick "Open by appointment only" if Google
offers it for the category, otherwise list the hours and note "appointments only" in the description.

**Opening date**: the go-live month (for a new profile Google asks; use the month APE started taking patients).

**Description** (up to 750 characters; this is 697):

> The Anxious Patient Experience is a nervous-system-aware approach to dental care at The Cronulla Dentists, created
> by Dr Lorna Gladwin, general dentist. It is for people whose body tenses, heart races or who have put off the
> dentist because of how it makes them feel. The first visit is a 70-minute New Patient Appointment that moves at
> your pace: time to talk, understand what is happening and decide together what comes next, with no treatment
> unless you want it. Health fund rebates are available. Appointments are held at 13 Cronulla Street and booked
> online. Suitability for the program, and any treatment or sedation options, is assessed individually with your
> dentist.

**Services** (Google's Services section; plain names, no prices unless they are exact and current):
- New Patient Appointment (The Anxious Patient Experience, 70 minutes)
- General dentistry
- Dental check-up and clean
- Care for anxious and nervous patients
Only add others Lorna confirms she provides at that address.

**Attributes**: "Appointment required", wheelchair access and parking as the practice confirms. Do not tick anything
unconfirmed.

**Photos**: the APE logo as the logo; the approved armchair image (`public/images/social-share-armchair.jpg`) as
the cover; Lorna's own approved photo; genuine photos of the Cronulla practice if the practice approves them. No
stock treatment-room images, and no photos of non-dentist staff without their and Lorna's approval.

**Booking and messaging**: turn Google's own "Book online" and chat off; the appointment link above is the booking
route.

## 4. Set-up (with Rowayne's approval)

No browser signed in to Google was available in the build session, so nothing was filled in. When one is:

1. Sign in as rowayne@gyaclients.com at https://business.google.com/create and search the business name. If Google
   shows an existing match, stop and request access to it instead.
2. Fill in everything in section 3 up to the verification step. **Stop before Verify** and show Rowayne a screenshot.
3. Verification for a new dentist listing is usually a **video** recorded at the premises showing the street, the
   signage, the entrance and something that proves the business operates there (a dental chair, branded materials, a
   practitioner with ID). It therefore needs Lorna or the Cronulla team on site, not GYA. Postcard or phone options
   appear only sometimes. Do not start verification without Rowayne.
4. Do not add the listing to any other agency tools until verified.

## 5. After verification (checked against Google's help pages on 24 Nov 2026)

1. **GYA access.** Lorna adds rowayne@gyaclients.com as a **Manager**: Business Profile, More > Business Profile
   settings > People and access > Add, enter the address, Access: Manager, Invite
   (https://support.google.com/business/answer/3403100). A manager can edit everything except users and deleting
   the profile.
2. **Move it off her personal Gmail.** In the same place, Lorna adds theanxiouspatientexperience@gmail.com as an
   **Owner**. Google makes a new owner or manager wait 7 days before ownership can be transferred to them
   (https://support.google.com/business/answer/3403100). After the 7 days, Lorna (as primary owner) opens People and
   access, selects the APE account, Access > Edit > **Primary owner** > Save
   (https://support.google.com/business/answer/3415281). Her personal account can then be removed, or kept as an
   owner. Reviews, photos and settings stay with the profile; nothing is lost.
3. **Review link.** business.google.com > Read reviews > Get more reviews > Copy (only on a computer browser:
   https://support.google.com/business/answer/16816815). Dashboard > Site Settings > Google review link, Save, Publish
   website. `/review/` then goes live. Print `deliverables/qr/ape-review-qr.png` for the front desk.
4. **Profile link in the structured data.** v1.16.0 added Site Settings > **Google Business Profile link**. Paste the
   profile's own link (Google Maps, search the profile, Share, Copy link), Save, Publish website. It is written into
   the structured data as `sameAs` on the APE department, and nothing visible changes.
5. **Reviews.** All patients are invited the same way, nobody is asked for a particular rating, no incentives (Google
   prohibits them), and no reply ever carries clinical detail or confirms someone is a patient. Reviews are not
   shown on the APE website (AHPRA).
6. **Google's "make an ad" prompt.** Google suggests an ad to every new profile. It is optional, and ignoring it
   changes nothing on the profile. If APE runs Google Ads later, GYA plans a proper campaign with Lorna first (and
   `docs/GTM-CONTAINER-RULES.md` applies to any tag it needs).

## Questions for Lorna (needed before step 4)

1. Do all APE appointments happen at 13 Cronulla Street, and is there APE signage there? **(the only thing holding
   up the listing as at 11 Nov 2026)**
2. Which email should own the profile? **Answered: theanxiouspatientexperience@gmail.com.**
3. Is she happy with a practitioner listing in her own name (option b), or would she rather use the Cronulla
   Dentists' existing profile for reviews (option c)?
4. Entrance details and parking for the map pin and attributes.

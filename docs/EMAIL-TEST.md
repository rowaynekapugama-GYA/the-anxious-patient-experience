# Live email test, v1.8.3 (Rowayne)

Run this after the v1.8.3 deploy shows Ready in Vercel. Everything goes to rowayne@gyaclients.com except the team
copy of the real booking in step 4, which goes to the APE inbox (warn Lorna's team first). Report the results back
in the same order.

1. **Set up check.** Sign in at https://theanxiouspatientexperience.com.au/admin as rowayne@gyaclients.com and open
   **Site Settings > Email** (or go straight to /admin/settings/email). "Sending set up" should say **All good**: sends
   from `The Anxious Patient Experience <bookings@thecronulladentists.com.au>`, SMTP2GO key Set, links on
   https://theanxiouspatientexperience.com.au. Under "Who gets what", New booking (team) should go to
   theanxiouspatientexperience@gmail.com from Site Settings. Screenshot.
2. **Test emails.** In **Send test emails**, leave the address as rowayne@gyaclients.com, keep all 10 ticked and press
   **Send 10 test emails**. Each line should say Accepted with an ID. Within a few minutes there should be 10 emails
   starting with [TEST] in the inbox. Check junk too and note any that landed there.
3. **Real password reset.** Log out, open /admin/forgot-password and ask for a reset for rowayne@gyaclients.com.
   - The email arrives and its button opens a page on theanxiouspatientexperience.com.au.
   - Choose a new password: you are signed straight in.
   - A "Your password was changed" email arrives.
   - Opening the same link again says it has expired or been used.
4. **Real booking, end to end.** Tell the APE team a test booking is coming. On /book-now/ pick the **last** available
   time, name `Test Patient GYA PLEASE IGNORE`, email rowayne@gyaclients.com. If a PayPal step shows, press Pay later.
   - "We have received your booking request" arrives at rowayne@gyaclients.com.
   - "APE delivery check APE-XXXXXX: all emails accepted" arrives, with no name, phone, email or note in it.
   - The APE inbox gets "New booking request APE-XXXXXX, ..." (ask the team to confirm).
   - In the dashboard, Bookings shows it with two ticks in the Emails column.
   - Press **Cancel booking**. There is no cancellation email (the team emails the patient themselves).
5. **Lorna's login.** In SMTP2GO, Activity, search lorna-gladwin1@hotmail.co.uk. Note what it shows for her invite:
   delivered, bounced, spam or not found. If it was not delivered, press **Send login email again** on her row under
   Users, then check Activity again (and the Last login email column).
6. Send the results back to the chat in this order, with the screenshot from step 1.

# For Lorna: v1.15.0 (24 Nov 2026)

One thing needs Lorna's approval: the analytics paragraph in the privacy policy. Nothing on the website's pages,
wording or booking changes in this release.

## What changed

Google Analytics is now added to the website through Google Tag Manager, a Google tool GYA uses to manage it. It
counts visits: how many people came, from where, and how many reached Book Now and finished a booking.

It is set up so that Google never receives a name, an email address, a phone number, a date of birth, a booking
reference or a questionnaire answer. It is not on the questionnaire, not on the page where a deposit is paid from an
emailed link, and not on the dashboard.

## Privacy policy, section 7: the paragraph to approve (DRAFT)

The privacy policy on the website today (last updated 11 November 2026) says, under **7. Our website, cookies and
analytics**:

> This website uses your browser's storage to remember small things that make it work, such as whether you have
> already seen our opening special message. If we use analytics or advertising tools, such as Google Analytics or
> the Meta Pixel, they collect information about how the website is used through cookies. We set these tools up so
> they do not receive the details you enter in our booking form. You can block or delete cookies in your browser
> settings.

That says "if we use". Now that Google Analytics is in use, we suggest it says so plainly. The paragraph drafted
on 18 November (v1.11.0) was never published. This is that paragraph, updated for Tag Manager. The words that
changed since the 18 November draft are in bold:

> This website uses your browser's storage to remember small things that make it work, such as whether you have
> already seen our opening special message, and which link brought you to our website during your visit (for
> example our Instagram page or one of our clinic websites). If you make a booking, that link is saved with your
> booking so we can understand how patients find us. It is cleared when you close the browser tab.
>
> We use Google Analytics**, which we add to this website with Google Tag Manager,** to understand how our website
> is used, for example how many people visit the Book Now page and which pages are most helpful. Google Analytics
> uses cookies and collects information such as the pages you view, the website or link that brought you here, your
> approximate location (city or region) and the type of device and browser you use. We have set it up so that it
> does not receive your name, contact details, date of birth, booking details or anything you type into a form, and
> it is not used on our pre-appointment questionnaire **or on the page where you pay a deposit from a link we email
> you**. Google signals and advertising personalisation are switched off, and we do not use the Meta Pixel or other
> advertising tracking on this website. Google may store this information on servers outside Australia, including in
> the United States. You can block or delete cookies in your browser settings, or opt out of Google Analytics on all
> websites with Google's browser add-on at tools.google.com/dlpage/gaoptout.

**Question for Lorna:** happy with this paragraph? Once she says yes, GYA puts it in (Pages > Privacy Policy) and
updates the "Last updated" date. It is **not on the website yet**.

(A cookie banner is not usually expected in Australia for analytics set up this way, so none is planned unless she
would like one; her lawyer or privacy adviser can confirm.)

## For GYA before sending this

The sentence "it does not receive ... anything you type into a form" is only true once automatic user-provided data
detection is switched off in the Google tag (`docs/GTM-CONTAINER-RULES.md`, section 2). Check that first.

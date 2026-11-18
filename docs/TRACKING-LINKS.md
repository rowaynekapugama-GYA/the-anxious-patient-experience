# Tracking links for the APE launch (v1.11.0)

Use these links wherever APE is promoted, so the dashboard (Dashboard > **Where bookings came from**) and Google
Analytics can tell where each visit and booking came from. They all use `utm_campaign=ape-launch`.

Each link opens the normal page. The `utm_` part at the end only labels the visit; patients do not need to do anything.
Copy them exactly: lower case, no spaces.

## Instagram

| Where | Link |
|---|---|
| Bio link | `https://theanxiouspatientexperience.com.au/?utm_source=instagram&utm_medium=social&utm_campaign=ape-launch&utm_content=bio` |
| Story link sticker | `https://theanxiouspatientexperience.com.au/book-now/?utm_source=instagram&utm_medium=social&utm_campaign=ape-launch&utm_content=story` |
| Post caption or comment reply (if a link is ever used) | `https://theanxiouspatientexperience.com.au/?utm_source=instagram&utm_medium=social&utm_campaign=ape-launch&utm_content=post` |

If a link tool (Linktree or similar) sits in the bio, put the bio link above inside it, not the plain address.

## The Caringbah Dentists website

| Where | Link |
|---|---|
| APE banner | `https://theanxiouspatientexperience.com.au/?utm_source=caringbah-website&utm_medium=referral&utm_campaign=ape-launch&utm_content=banner` |
| Book Now tab (the APE option) | `https://theanxiouspatientexperience.com.au/book-now/?utm_source=caringbah-website&utm_medium=referral&utm_campaign=ape-launch&utm_content=book-now-tab` |

## The Cronulla Dentists website

| Where | Link |
|---|---|
| APE banner | `https://theanxiouspatientexperience.com.au/?utm_source=cronulla-website&utm_medium=referral&utm_campaign=ape-launch&utm_content=banner` |
| Book Now tab (the APE option) | `https://theanxiouspatientexperience.com.au/book-now/?utm_source=cronulla-website&utm_medium=referral&utm_campaign=ape-launch&utm_content=book-now-tab` |

On both clinic sites these replace the current APE addresses (`ape.url` and `ape.bookUrl`, and the team link), which
still point at the vercel.app address. That change is made in each clinic site's own repo.

## Email signature

For Lorna, Alex, Lauren and the APE inbox:

`https://theanxiouspatientexperience.com.au/?utm_source=email-signature&utm_medium=email&utm_campaign=ape-launch`

Show it as words (for example "theanxiouspatientexperience.com.au") linked to the address above, so the long part
is not visible.

## QR code on the flyer: unchanged

The printed QR code keeps its own link (`utm_source=flyer&utm_medium=qr&utm_campaign=ape_launch`, on the vercel.app
address, which keeps working). Do not reprint it for this. In the dashboard those bookings show as **QR code**.

## What the dashboard shows

| Link used | Dashboard label |
|---|---|
| Instagram links above (or Instagram's own app link) | Instagram |
| Caringbah links, or any link from thecaringbahdentists.com.au | Caringbah website |
| Cronulla links, or any link from thecronulladentists.com.au | Cronulla website |
| Email signature | Email |
| The flyer QR code | QR code |
| Google search | Google |
| Typed in, a bookmark, or an app that hides where it came from | Direct |
| Bookings made before 18 November 2026 | Not recorded |

The source is the link the patient **first** arrived by in that visit (kept only until they close the tab, no cookie).
GA4 also keeps the `utm_content` part (bio, story, banner, book-now-tab), so you can compare the banner with the tab.

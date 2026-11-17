# Apple Pay domain check file

When PayPal registers theanxiouspatientexperience.com.au for Apple Pay (see `docs/PAYPAL-ADVANCED-SETUP.md`), it gives a
file called `apple-developer-merchantid-domain-association`. Put it in this folder with exactly that name (no extension).

The website then serves it at https://theanxiouspatientexperience.com.au/.well-known/apple-developer-merchantid-domain-association.
Until the file is here (or its contents are in the `APPLE_PAY_DOMAIN_ASSOCIATION` environment variable), that address is a 404.

The file is public by design. It is not a key or a password.

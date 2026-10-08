# screenings4u Guide Recorder — Chrome Web Store submission

## Single purpose
Capture click-by-click workflows on screenings4u-owned web portals and save numbered screenshots to screenings4u Guide Builder.

## Permissions justification
- `storage`: stores recorder session/auth state and in-progress guide state locally in the browser.
- `tabs`: finds the active screenings4u portal tab, focuses it when recording begins, opens the Guide Editor when recording ends, and reads page metadata for capture.
- `scripting`: re-injects the recorder content script if a portal page was already open before the extension was installed/reloaded.
- `activeTab`: allows the user-initiated recorder to capture the currently active portal tab.

## Host permissions justification
- `https://screenings4u.com/*` and `https://*.screenings4u.com/*`: required because the recorder only captures workflows on screenings4u-owned sites and portals.
- `https://elpbnytpciqnbexiaebp.supabase.co/*`: required to authenticate authorized Guide Builder staff and upload guide screenshots/metadata to screenings4u's Supabase backend.

## Data handling
The extension captures only while the user explicitly starts recording. It may capture visible-tab screenshots, portal URL/title, clicked control labels/selectors, and click coordinates. Common password, SSN, birth-date, payment-card, and routing-number fields are masked before screenshots are taken. Data is sent only to screenings4u's Guide Builder backend. No advertising, sale of data, or unrelated third-party transfer.

## Store listing
**Name:** screenings4u Guide Recorder

**Short description:** Capture screenings4u portal workflows click-by-click with numbered screenshots for Guide Builder.

**Detailed description:**
The screenings4u Guide Recorder helps authorized screenings4u staff create visual how-to documentation for screenings4u portals. Start a recording, complete the workflow in the portal, and each interaction is captured in order with a numbered screenshot and page/control metadata. Finished recordings are saved directly to screenings4u Guide Builder where instructions can be edited and published to customer Help & How-To pages.

## Category
Productivity

## Visibility recommendation
Private or unlisted if the extension is intended only for screenings4u staff. Public only if external users are expected to install it.

## Privacy policy
Host the included `privacy.html` on a public HTTPS URL (recommended: `https://guides.screenings4u.com/recorder-privacy.html`) and use that URL in the Chrome Web Store Privacy tab.

## Store assets
- Extension icon: `ext/icons/icon128.png`
- Screenshot: `store-assets/screenshot-1280x800.png`

## Submission checklist
1. Enable 2-Step Verification on the publisher Google account.
2. Register/confirm the Chrome Web Store developer account.
3. Upload `screenings4u-guide-recorder-store-v4.0.0.zip`.
4. Complete Store Listing using the text above.
5. Upload the 1280x800 screenshot and 128x128 icon.
6. Complete Privacy practices with the permission justifications above.
7. Provide the hosted privacy-policy URL.
8. Choose visibility (Private/Unlisted recommended for internal staff).
9. Submit for review.

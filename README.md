# screenings4u Guide Builder

Hosted at **https://guides.screenings4u.com**

A standalone screenings4u documentation tool for recording portal workflows, turning clicks into screenshot-based steps, editing those steps, and exporting branded how-to guides.

## Product boundaries

Guide Builder is separate from every screenings4u portal. Recording is performed by the Guide Builder website using the browser Screen Capture API; no recorder code is mixed into portal application code.

## Included in the initial build

- Guide Library / editor shell
- Import recorded guide JSON
- Editable guide title, introduction, and step instructions
- Screenshot display with numbered click markers
- Branded print / PDF output
- Chrome / Edge Manifest V3 recorder controlled directly from the Guide Builder website
- Sensitive-field masking in the recorder
- CNAME for guides.screenings4u.com

## Planned next

- Supabase authentication and persistent guide storage
- Screenshot upload/storage
- Drag/drop step ordering
- Blur/redaction editor
- Guide categories and portal assignments
- Draft/published status and version history
- Public/internal guide links
- White-label PDF branding
- AI-assisted step wording
- Guide health checks when portal UI changes


## Recorder

The Guide Builder now records directly in the browser using the Screen Capture API. No browser extension is required.

1. Sign in to `https://guides.screenings4u.com/`.
2. Click **Start Recording**.
3. Enter the guide title, portal, and audience.
4. Choose the browser tab, window, or screen to share.
5. Perform the workflow. Guide Builder automatically captures a new screenshot step when the shared screen changes significantly.
6. Return to Guide Builder and click **Finish Recording** (or stop sharing).
7. The screenshots are uploaded to the private `guide-builder` storage bucket and the guide opens in the editor.

Because normal websites are not permitted to inspect clicks inside a different tab, native recording captures visual workflow changes rather than cross-tab click events. Click markers can be adjusted in the editor.


## 2026-10-07 reliability update
- Browser authentication refreshes and retries once after a 401.
- guide-builder validates bearer tokens and Guide Builder membership inside the function.
- Native alert/confirm dialogs were replaced by branded screenings4u dialogs.
- Site headers/auth/PDF viewer use images/logo.png and images/logo2.png.
- Guide Recorder extension v3 captures actual clicks, select changes, checkbox/radio changes, and Enter-submit actions.
- Rapid captures are queued so upload latency does not drop later clicks.
- Browser screen sharing remains available as a fallback with faster frame sampling and a higher capture limit.

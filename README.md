# screenings4u Guide Builder

Hosted at **https://guides.screenings4u.com**

A standalone screenings4u documentation tool for recording portal workflows, turning clicks into screenshot-based steps, editing those steps, and exporting branded how-to guides.

## Product boundaries

Guide Builder is separate from every screenings4u portal. The browser extension observes approved portal pages externally; no recorder code is mixed into portal application code.

## Included in the initial build

- Guide Library / editor shell
- Import recorded guide JSON
- Editable guide title, introduction, and step instructions
- Screenshot display with numbered click markers
- Branded print / PDF output
- Chrome / Edge Manifest V3 recorder
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

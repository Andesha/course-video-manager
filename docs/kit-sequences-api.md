# Kit (ConvertKit) Broadcasts API Reference

> Research notes for sending newsletter content via Kit's V4 API.
> Last updated: 2026-02-25

## Context

The goal is to expand the post publishing flow (currently LinkedIn, YouTube, AI Hero) to also send content as a newsletter via Kit. Kit's API **does not** support programmatically adding email steps to sequences — sequence content can only be managed through the Kit web UI. However, the **Broadcasts API** is the right tool for sending one-off newsletter emails to subscribers, which is the actual use case here.

## Authentication

### API Key Setup

1. Go to Kit account **Settings > Developer** tab
2. Create a V4 API Key
3. **Save the key immediately** — you can't retrieve it after leaving the page

### Usage

```
X-Kit-Api-Key: <YOUR_V4_API_KEY>
```

### Rate Limits

- **API Key:** 120 requests per rolling 60-second window
- **OAuth:** 600 requests per rolling 60-second window (not needed for this use case)

---

## Endpoints

### 1. Create a Broadcast

Create a new newsletter email (draft or scheduled).

```
POST https://api.kit.com/v4/broadcasts
Content-Type: application/json
```

**Request Body:**

| Field               | Type        | Required | Description                                           |
| ------------------- | ----------- | -------- | ----------------------------------------------------- |
| `subject`           | string      | Yes      | Email subject line                                    |
| `content`           | string      | Yes      | HTML content of the email                             |
| `description`       | string      | Yes      | Internal description                                  |
| `public`            | boolean     | Yes      | `true` to publish on web archive                      |
| `published_at`      | string      | Yes      | ISO 8601 timestamp for display                        |
| `preview_text`      | string      | Yes      | Email preview snippet (shown in inbox)                |
| `send_at`           | string/null | No       | ISO 8601 scheduled send time; `null` to save as draft |
| `email_template_id` | integer     | No       | Template ID; uses account default if omitted          |
| `email_address`     | string/null | No       | Sending address; uses account default if omitted      |
| `thumbnail_url`     | string/null | No       | Thumbnail image URL                                   |
| `thumbnail_alt`     | string/null | No       | Alt text for thumbnail                                |
| `subscriber_filter` | array       | No       | Target specific segments/tags (see below)             |

**Subscriber Filtering (optional):**

```json
{
  "subscriber_filter": [{ "all": [{ "type": "tag", "ids": [123, 456] }] }]
}
```

Filter types: `all` (AND), `any` (OR), `none` (NOT). Each entry has `type` (`"segment"` or `"tag"`) and `ids` array.

**Response (201):**

```json
{
  "broadcast": {
    "id": 64,
    "created_at": "2023-02-17T11:43:55Z",
    "subject": "Weekly Update",
    "content": "<p>Hello!</p>",
    "description": "Weekly newsletter",
    "public": true,
    "published_at": "2023-02-17T11:43:55Z",
    "send_at": "2023-02-18T10:00:00Z",
    "preview_text": "This week's highlights",
    "thumbnail_url": null,
    "thumbnail_alt": null,
    "email_address": "matt@example.com",
    "email_template": { "id": 1, "name": "Default" },
    "public_url": "https://kit.com/...",
    "subscriber_filter": []
  }
}
```

**Errors:** 401 (auth), 403 (permissions), 422 (invalid params)

---

### 2. List Broadcasts

Retrieve existing broadcasts (useful for showing history or finding drafts).

```
GET https://api.kit.com/v4/broadcasts
```

**Query Parameters:**

| Parameter             | Type    | Default | Description                  |
| --------------------- | ------- | ------- | ---------------------------- |
| `per_page`            | integer | 500     | Results per page (max 1000)  |
| `after`               | string  | —       | Cursor for next page         |
| `before`              | string  | —       | Cursor for previous page     |
| `include_total_count` | boolean | false   | Include total count (slower) |

**Response (200):**

```json
{
  "broadcasts": [
    {
      "id": 64,
      "subject": "Weekly Update",
      "content": "<p>Hello!</p>",
      "description": "Weekly newsletter",
      "public": true,
      "published_at": "2023-02-17T11:43:55Z",
      "send_at": "2023-02-18T10:00:00Z",
      "preview_text": "This week's highlights",
      "email_address": "matt@example.com",
      "email_template": { "id": 1, "name": "Default" },
      "public_url": "https://kit.com/...",
      "subscriber_filter": []
    }
  ],
  "pagination": {
    "has_previous_page": false,
    "has_next_page": false,
    "start_cursor": "...",
    "end_cursor": "...",
    "per_page": 500
  }
}
```

---

### 3. Get a Broadcast

```
GET https://api.kit.com/v4/broadcasts/{id}
```

Returns the same broadcast object shape as above. Errors: 401, 404.

---

### 4. Update a Broadcast

Update a draft or scheduled broadcast before it sends.

```
PUT https://api.kit.com/v4/broadcasts/{id}
Content-Type: application/json
```

Same request body fields as Create. **Cannot update a broadcast that has already started sending** (returns 422).

**Errors:** 401, 403, 404, 422 (already sending)

---

### 5. Delete a Broadcast

```
DELETE https://api.kit.com/v4/broadcasts/{id}
```

**Response:** 204 (no content) on success. **Cannot delete a broadcast that has already sent** (returns 422).

---

## UI Integration Plan

The flow for adding newsletter publishing to the post workflow:

1. **User writes post content** (already exists for LinkedIn/YouTube/AI Hero)
2. **Newsletter tab/section** lets the user:
   - Preview the email content (generated from post body, converted to HTML)
   - Set the subject line
   - Set preview text
   - Optionally choose a send time (or save as draft)
   - Optionally filter by tag/segment
3. **On publish:** Call `POST /v4/broadcasts` with the content
4. **Handle responses:**
   - 201 → broadcast created (draft if `send_at` is null, scheduled if set)
   - 422 → validation error (show message)

### Env Var Needed

```
KIT_API_KEY=kit_abc123...
```

### Key Consideration: Sequences vs Broadcasts

- **Sequences** are automated drip email series. The API only supports managing _subscribers_ on sequences, not the email content/steps within them. Sequence content must be managed in the Kit UI.
- **Broadcasts** are one-off emails sent to your list. The API gives full CRUD control over broadcast content, scheduling, and targeting. This is the right fit for "publish this post as a newsletter."

---

## Sources

- [Kit API V4 Overview](https://developers.kit.com/v4)
- [API Authentication](https://developers.kit.com/api-reference/authentication)
- [Create a Broadcast](https://developers.kit.com/api-reference/broadcasts/create-a-broadcast)
- [List Broadcasts](https://developers.kit.com/api-reference/broadcasts/list-broadcasts)
- [Get a Broadcast](https://developers.kit.com/api-reference/broadcasts/get-a-broadcast)
- [Update a Broadcast](https://developers.kit.com/api-reference/broadcasts/update-a-broadcast)
- [Delete a Broadcast](https://developers.kit.com/api-reference/broadcasts/delete-a-broadcast)

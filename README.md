# Raksha Backend

Simple SIH-MVP REST API using Node.js, Express, MongoDB Atlas, Mongoose, JWT, bcrypt, Zod, dotenv, and CORS.

## Run

1. Copy `.env.example` to `.env`.
2. Set `MONGODB_URI` to a MongoDB Atlas connection string and set a private `JWT_SECRET`.
3. Run `npm install`.
4. Run `npm run dev` or `npm start`.

The server will not start until MongoDB is reachable. AI endpoints use mock responses during development. AI signals are passed through the deterministic risk engine before final risk values are returned.

## WhatsApp AI Companion

### Webhook verification

- GET `/api/whatsapp/webhook`
- Expected query params: `hub.mode=subscribe`, `hub.verify_token=<WHATSAPP_VERIFY_TOKEN>`, `hub.challenge=<challenge>`
- Returns the challenge string when validation succeeds.
- Returns `403` when the verification token is invalid.

Example:

GET `/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=demo-token&hub.challenge=challenge-123`

Response:

```text
challenge-123
```

### Incoming webhook

- POST `/api/whatsapp/webhook`
- Accepts Meta WhatsApp Business Cloud payloads.
- Extracts the sender, message ID, message type, text, and timestamp.
- Ignores unsupported message types safely.
- Prevents duplicate processing with the WhatsApp message ID.

Sample payload:

```json
{
  "entry": [
    {
      "changes": [
        {
          "value": {
            "metadata": { "phone_number_id": "12345" },
            "messages": [
              {
                "from": "919999999999",
                "id": "wamid.HBgLM...",
                "timestamp": "1710000000",
                "type": "text",
                "text": { "body": "Driver thoda ajeeb behave kar raha hai." }
              }
            ]
          }
        }
      ]
    }
  ]
}
```

Sample response:

```json
{
  "status": "ok",
  "reply": "Kahan pahunchi?",
  "risk": {
    "riskScore": 36,
    "riskLevel": "MEDIUM"
  }
}
```

### Environment variables

Add these to `.env` using the template in `.env.example`:

```env
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_API_VERSION=v20.0
WHATSAPP_MOCK_MODE=true
OPENAI_API_KEY=
AI_MOCK_MODE=true
```

### Mock mode

When `WHATSAPP_MOCK_MODE=true`, the backend does not call Meta and returns deterministic mock responses. When `AI_MOCK_MODE=true`, the backend uses local structured analysis without calling external AI APIs. This allows local SIH demonstrations without real secrets or external services.

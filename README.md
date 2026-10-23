# KNRM Urenregistratietool

Urenregistratie voor KNRM-vrijwilligers: inzicht in **geoefendheid** én de basis
voor de **vrijwilligersvergoeding** (€1,25 per uur, richting AFAS). Gebouwd als
pilot, met focus op eenvoud.

## Functionaliteit

- **Inloggen op persoonsniveau** (e-mail + wachtwoord, JWT).
- **Uren registreren** in stappen van een half uur, gekoppeld aan een
  **hoofdactiviteit** (Oefening, PR, Onderhoud) en optioneel een
  **detailactiviteit / oefening**.
- **Vrijwilliger** registreert zelfstandig; de **schipper** kan uren voor het
  hele team (station) registreren.
- **Dubbele registratie** wordt geblokkeerd (zelfde persoon + datum + activiteit).
- **Maandelijkse accordering** door de schipper (per registratie of in één keer).
- **Rapportage & export**: geaccordeerde uren + vergoeding per vrijwilliger,
  met **CSV-export** voor AFAS/Excel. Toont ook de *breedte* van geoefendheid
  (aantal verschillende oefeningen).
- **Beheer**: gebruikers, stations en hoofd-/detailactiviteiten onderhouden.

## Architectuur

| Component | Technologie | Container |
|-----------|-------------|-----------|
| Frontend  | React + Vite + Tailwind (KNRM-huisstijl) | nginx |
| Backend   | Python + FastAPI + SQLAlchemy | uvicorn |
| Database  | Azure Database for PostgreSQL Flexible Server | — |

Op Azure draaien front- en backend als **twee losse Linux Web Apps met
containers** op één App Service-plan. De frontend-nginx proxyt `/api` naar de
backend. PostgreSQL draait op Azure Database for PostgreSQL Flexible Server.

## Lokaal draaien

```bash
docker compose up --build
# Frontend: http://localhost:8080
# Backend docs: http://localhost:8000/docs
```

Eerste login (seed): `beheer@knrm.nl` / `KnrmPilot2026!` (aanpasbaar via env).

## Deployen naar Azure

1. `az login` en zorg dat je de juiste subscription hebt.
2. `cp infra/terraform.tfvars.example infra/terraform.tfvars` en vul in.
3. `./deploy.sh`

De URL's van front- en backend worden aan het eind getoond.

## Configuratie (backend env)

| Variabele | Omschrijving |
|-----------|--------------|
| `DATABASE_URL` | PostgreSQL connectiestring |
| `JWT_SECRET` | Signing secret voor tokens |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Eerste beheerder bij lege database |
| `CORS_ORIGINS` | Toegestane origins (`*` of komma-gescheiden) |
| `ENTRA_TENANT_ID` / `ENTRA_CLIENT_ID` | Entra ID-tenant en app registration voor SSO; leeg = SSO uit |

## SSO met Microsoft Entra ID (optioneel)

De backend heeft een SSO-endpoint (`POST /api/auth/sso`) dat een Entra ID
`id_token` valideert (handtekening via de Microsoft JWKS, issuer en audience)
en vervolgens het eigen app-JWT uitgeeft. Alleen **bestaande, actieve**
gebruikers (match op e-mailadres) kunnen via SSO inloggen; rollen blijven in de
app beheerd. Zolang `ENTRA_TENANT_ID`/`ENTRA_CLIENT_ID` leeg zijn, is het
endpoint uitgeschakeld (HTTP 503).

De frontend haalt de SSO-configuratie runtime op via `GET /api/auth/sso/config`
(geen secrets, geen build-time variabelen). Zodra SSO geconfigureerd is,
verschijnt op het loginscherm automatisch een knop **"Inloggen met Microsoft"**
(MSAL.js, popup met authorization code + PKCE).

### Wat is er nodig?

- Een **app registration** in de Entra ID-tenant, platform **Single-page
  application (SPA)** met als redirect-URI de frontend-URL (en voor lokaal
  ontwikkelen `http://localhost:5173/`), delegated permission `User.Read`.
- De **tenant-ID** en de **client-ID (application ID)** van die registratie.
- **Géén client secret of certificaat**: de flow is authorization code + PKCE
  (public client) en de backend valideert alleen het `id_token` tegen de
  publieke Microsoft-sleutels. Het bestaande `JWT_SECRET` blijft gewoon nodig
  voor de eigen tokens en staat hier los van.

### Configureren bij een (nieuwe) deployment

**Route A — app registration handmatig (portal):**

1. Maak in de Azure-portal (Entra ID → App registrations) een registratie aan
   zoals hierboven beschreven.
2. Vul in `infra/terraform.tfvars` in:

   ```hcl
   entra_tenant_id = "<tenant-id>"
   entra_client_id = "<client-id>"
   ```

3. Draai `./deploy.sh` (of `terraform apply`); de waarden komen als
   `ENTRA_TENANT_ID`/`ENTRA_CLIENT_ID` in de backend-app settings terecht.

**Route B — app registration via Terraform:**

1. Uncomment in `infra/providers.tf` de `azuread`-provider (beide blokken) en
   in `infra/entra.tf` alle resources/outputs (stappenplan staat in de kop van
   dat bestand).
2. Vervang in `infra/main.tf` de twee `ENTRA_*`-regels door de varianten die er
   als comment naast staan.
3. Draai `terraform init -upgrade && terraform apply`. Vereist rechten om app
   registrations aan te maken in de tenant (rol *Application Developer* of
   hoger).

**Lokaal** kun je SSO testen door `ENTRA_TENANT_ID` en `ENTRA_CLIENT_ID` als
omgevingsvariabelen aan de backend mee te geven (bijv. in
`docker-compose.yml`).

## Gebruikersbeheer en onboarding

Gebruikers moeten **eerst in de app worden opgevoerd** voordat ze kunnen
inloggen — ook met SSO. Dat is een bewuste keuze: de app is de bron van
waarheid voor **wie toegang heeft en met welke rol**, niet de Entra-tenant.

**Hoe het werkt:**

1. De **beheerder** maakt via het Beheer-scherm een account aan: naam,
   e-mailadres, rol (vrijwilliger / schipper / beheerder), station en een
   (initieel) wachtwoord.
2. De gebruiker kan daarna inloggen met e-mail + wachtwoord, of — als SSO is
   geconfigureerd — met **"Inloggen met Microsoft"**. Voor SSO moet het
   e-mailadres in de app exact overeenkomen met het Microsoft-aanmeldadres.
3. **Uit dienst / geen toegang meer?** De beheerder deactiveert het account.
   Dat blokkeert direct zowel wachtwoord- als SSO-login: de backend controleert
   bij elk verzoek opnieuw of het account bestaat en actief is.

**Waarom geen automatische provisioning?** Iedereen in de Entra-tenant zou
anders toegang krijgen, terwijl de app juist per persoon een rol en station
nodig heeft (wie mag accorderen, welk station). Entra ID beantwoordt alleen de
vraag *wie* iemand is; de app bepaalt *wat* diegene mag. Rollen worden dan ook
nooit uit het token overgenomen, maar per verzoek uit de eigen database
gelezen — een rolwijziging werkt daardoor direct door, zonder dat een
gebruiker opnieuw hoeft in te loggen.

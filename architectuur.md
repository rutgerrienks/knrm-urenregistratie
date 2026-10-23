# Architectuur KNRM Urenregistratie

**Documentversie:** 1.0.3  
**Applicatieversie:** 1.2.0

## Stackdiagram

Het diagram toont de Azure-hosting en de belangrijkste runtime-verzoeken. De frontend en backend zijn afzonderlijke Linux Web Apps met containerimages uit Azure Container Registry.

```mermaid
architecture-beta
    group azure(cloud)[Azure]
    group appservice(server)[App Service plan] in azure
    group registrygroup(cloud)[Container Registry] in azure
    group databasegroup(cloud)[Database] in azure

    service browser(server)[Browser]
    service frontend(server)[Frontend Web App: Nginx + React] in appservice
    service backend(server)[Backend Web App: FastAPI] in appservice
    service registry(disk)[Azure Container Registry] in registrygroup
    service postgres(database)[PostgreSQL Flexible Server] in databasegroup

    browser:R --> L:frontend
    frontend:R --> L:backend
    backend:R --> L:postgres
    registry:T --> B:frontend
    registry:T --> B:backend
```

## Overzicht

De applicatie is een webapplicatie met een React-frontend, een Python/FastAPI-backend en een PostgreSQL-database. De frontend is een single-page application; de backend biedt de API en voert validatie en bedrijfslogica uit. De applicatie ondersteunt urenregistratie en accordering, rapportages en beheer.

## Componenten en gegevensstroom

- **Frontend:** React, TypeScript en Vite, met Tailwind CSS. De schermen en routes zijn rolgericht: vrijwilligers registreren uren; schippers accorderen en bekijken rapportages; beheerders beheren gebruikers en activiteiten.
- **Webserver en API-proxy:** Nginx serveert de gebouwde frontendbestanden en stuurt `/api`-verzoeken door naar de backend.
- **Backend:** FastAPI met SQLAlchemy. De API is opgesplitst in routers voor authenticatie, gebruikers, activiteiten, tijdregistraties en rapportages. De backend valideert registraties, past rol- en toegangsregels toe en levert onder meer CSV-export.
- **Database:** PostgreSQL bewaart gebruikers, stations, activiteiten en tijdregistraties. Een tijdregistratie verwijst naar de vrijwilliger voor wie de uren gelden en de gebruiker die ze heeft ingevoerd. Detailactiviteiten zijn aan een registratie te koppelen via een many-to-many-relatie.

Een browserverzoek voor de applicatie wordt door Nginx afgehandeld. API-verzoeken lopen via de proxy naar FastAPI; de backend leest of schrijft gegevens in PostgreSQL en stuurt een JSON- of CSV-antwoord terug.

## Authenticatie en autorisatie

Gebruikers melden zich aan met e-mailadres en wachtwoord. De backend slaat wachtwoorden gehasht op en geeft na succesvolle aanmelding een JWT uit. De frontend bewaart het token en stuurt het mee met API-verzoeken. De backend controleert het token en de rol bij afgeschermde endpoints. De rollen zijn vrijwilliger, schipper en beheerder; bepaalde schermen en API-acties zijn alleen beschikbaar voor schippers of beheerders.

Daarnaast biedt de backend een optioneel SSO-endpoint (`POST /api/auth/sso`) voor aanmelden met Microsoft Entra ID. De backend valideert het aangeleverde Entra `id_token` (handtekening via de Microsoft JWKS, issuer en audience), zoekt op e-mailadres het bijbehorende actieve lokale account en geeft vervolgens het eigen JWT uit; rollen blijven lokaal beheerd. Het endpoint is uitgeschakeld zolang de tenant- en client-ID niet via omgevingsvariabelen (`ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`) zijn geconfigureerd. De frontend haalt deze configuratie runtime op via `GET /api/auth/sso/config` en toont bij ingeschakelde SSO een knop "Inloggen met Microsoft" (MSAL.js, popup met authorization code + PKCE).

## Domein en integraties

Uren worden geregistreerd in stappen van minimaal 30 minuten en gekoppeld aan een hoofdactiviteit en nul of meer detailactiviteiten. Registraties kunnen worden ingediend, goedgekeurd of afgewezen. Rapportages berekenen onder andere uren, geoefendheid en de vergoeding; goedgekeurde uren kunnen als CSV worden geëxporteerd voor verdere verwerking in AFAS. De betaling zelf en een koppeling met de reddingrapportomgeving vallen buiten de huidige pilot.

## Uitvoering en hosting

Lokaal bestaat de Docker Compose-opstelling uit PostgreSQL, de backend en de frontend/Nginx, elk als aparte service. De API is lokaal rechtstreeks bereikbaar en de frontend kan API-verzoeken via Nginx laten proxien.

De Terraform-configuratie voor Azure maakt een Container Registry, Azure Database for PostgreSQL Flexible Server, Log Analytics-workspace en een Linux App Service-plan aan. De frontend en backend draaien als twee afzonderlijke Linux Web Apps met containerimages op dat plan; de frontend krijgt de backend-URL voor de Nginx-proxy. De databaseverbinding en overige instellingen worden via omgevingsvariabelen aan de backend doorgegeven. De infrastructuurcode gebruikt App Service voor containers, niet Azure Container Apps.

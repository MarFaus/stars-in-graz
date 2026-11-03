# EuroSkills Concerts (Module D)

Single page application for discovering concerts in Graz, booking seats and managing tickets.
Plain HTML, CSS and JavaScript: no build step, no dependencies. Works when opened straight
from the file system and in Chrome and Firefox.

## Run

Open `index.html`, or serve the folder with any static server
(`python3 -m http.server 8080`).

## API

`js/config.js` holds the address of the Module C API:

```js
window.APP_CONFIG = { apiUrl: 'http://competitor-N/module-c/api/v1' };
```

When `apiUrl` is empty the app uses a built-in demo API (`js/api.js`). It answers the same
paths with the same status codes, bodies and validation messages as the Module C
specification, using the data of `concerts.sql` (`data/demo-data.js`) and storing
reservations, bookings and tickets in `localStorage`.

## Structure

- `index.html`: header, page container, footer
- `css/styles.css`: all styles
- `js/app.js`: router and pages (concerts, booking, retrieve tickets, tickets)
- `js/api.js`: API client and demo API
- `data/`: demo data and the country list from `countries.csv`

## Traffic

All concerts and shows are loaded once per visit and reused by the filters and the booking
page. Seating is loaded per show; reservations are sent one at a time in order.

# DILSHAJ INFOTECH Employee ID - Static Version

Static frontend + Google Apps Script + Google Sheets + Google Drive.

## 1. Configure Apps Script

Open the Google Sheet -> Extensions -> Apps Script.

Replace `Code.gs` with `backend/Code.gs` from this project.

Run `setup()` once and authorize the requested permissions.

Then go to Project Settings -> Script properties and set:

- `ADMIN_PIN` = your private admin PIN
- `SPREADSHEET_ID` = your Google Sheet ID (setup() normally creates this automatically)

## 2. Deploy Apps Script

Deploy -> New deployment -> Web app.

Execute as: Me

Who has access: Anyone

Copy the `/exec` URL.

## 3. Configure frontend

Open `js/config.js` and replace `YOUR_DEPLOYMENT_ID` with the real `/exec` URL.

Do not put the Admin PIN in this file.

## 4. Test locally

From the project folder:

    python -m http.server 8000

Open:

    http://localhost:8000

The admin login uses a simple POST request to avoid the browser JSON preflight. Public QR verification uses JSONP because the frontend is static.

## 5. Production

The frontend can be hosted on GitHub Pages or another static host. Keep the Apps Script deployment URL in `js/config.js`.

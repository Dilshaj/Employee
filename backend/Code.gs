const CONFIG = {
  SHEET_NAME: 'Employees',
  PHOTO_FOLDER_NAME: 'Employee ID Photos',
  ADMIN_PIN_PROPERTY: 'ADMIN_PIN',
  SPREADSHEET_ID_PROPERTY: 'SPREADSHEET_ID',
  MAX_PHOTO_BYTES: 5 * 1024 * 1024,
  SESSION_TTL_SECONDS: 21600
};

const HEADERS = [
  'Employee No',
  'Name',
  'Designation',
  'Department',
  'Email',
  'Phone',
  'Joining Date',
  'Photo URL',
  'Secure Token',
  'Created At',
  'Updated At',
  'Status'
];

function doGet(e) {
  try {
    const action = String(e?.parameter?.action || '').trim();

    if (action === 'verify') {
      const token = String(e?.parameter?.id || '').trim();
      const payload = {
        success: true,
        employee: getEmployeeByToken_(token)
      };

      // JSONP is used only for public read-only verification.
      const callback = String(e?.parameter?.callback || '').trim();
      if (callback && /^[A-Za-z_$][0-9A-Za-z_$\.]*$/.test(callback)) {
        return ContentService
          .createTextOutput(callback + '(' + JSON.stringify(payload) + ');')
          .setMimeType(ContentService.MimeType.JAVASCRIPT);
      }

      return jsonResponse_(payload);
    }

    return jsonResponse_({
      success: true,
      message: 'Employee ID API is running.'
    });
  } catch (error) {
    return jsonResponse_({
      success: false,
      error: error.message
    });
  }
}

function doPost(e) {
  try {
    if (!e?.postData?.contents) {
      throw new Error('Request body is missing.');
    }

    const request = JSON.parse(e.postData.contents);
    const action = String(request.action || '').trim();

    switch (action) {
      case 'login':
        return jsonResponse_(login_(request.pin));

      case 'getEmployees':
        validateAdmin_(request.adminToken);
        return jsonResponse_({
          success: true,
          employees: getEmployees_()
        });

      case 'saveEmployee':
        validateAdmin_(request.adminToken);
        return jsonResponse_({
          success: true,
          employee: saveEmployee_(request.data)
        });

      case 'deleteEmployee':
        validateAdmin_(request.adminToken);
        return jsonResponse_(deleteEmployee_(request.employeeNo));

      case 'logout':
        logout_(request.adminToken);
        return jsonResponse_({ success: true });

      default:
        throw new Error('Unknown API action.');
    }
  } catch (error) {
    return jsonResponse_({
      success: false,
      error: error.message
    });
  }
}

function setup() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  if (!spreadsheet) {
    throw new Error('Open the Apps Script project from the Google Sheet and run setup().');
  }

  let sheet = spreadsheet.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(CONFIG.SHEET_NAME);
  }

  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  sheet.setFrozenRows(1);

  PropertiesService.getScriptProperties().setProperty(
    CONFIG.SPREADSHEET_ID_PROPERTY,
    spreadsheet.getId()
  );

  const properties = PropertiesService.getScriptProperties();
  if (!properties.getProperty(CONFIG.ADMIN_PIN_PROPERTY)) {
    properties.setProperty(CONFIG.ADMIN_PIN_PROPERTY, 'CHANGE-ME');
  }

  getPhotoFolder_();

  return {
    success: true,
    message: 'Setup completed.'
  };
}

function login_(pin) {
  const savedPin = PropertiesService
    .getScriptProperties()
    .getProperty(CONFIG.ADMIN_PIN_PROPERTY);

  if (!savedPin) {
    throw new Error('ADMIN_PIN is not configured.');
  }

  if (savedPin === 'CHANGE-ME') {
    throw new Error('Please configure ADMIN_PIN in Script Properties.');
  }

  if (String(pin || '') !== String(savedPin)) {
    throw new Error('Invalid Admin PIN.');
  }

  const token = Utilities.getUuid();

  CacheService.getScriptCache().put(
    'ADMIN_' + token,
    'VALID',
    CONFIG.SESSION_TTL_SECONDS
  );

  return {
    success: true,
    adminToken: token,
    expiresInSeconds: CONFIG.SESSION_TTL_SECONDS
  };
}

function validateAdmin_(token) {
  token = String(token || '').trim();

  if (!token) {
    throw new Error('Admin authentication required.');
  }

  const value = CacheService
    .getScriptCache()
    .get('ADMIN_' + token);

  if (value !== 'VALID') {
    throw new Error('Admin session expired. Please login again.');
  }
}

function logout_(token) {
  token = String(token || '').trim();
  if (token) {
    CacheService.getScriptCache().remove('ADMIN_' + token);
  }
}

function saveEmployee_(data) {
  if (!data) {
    throw new Error('Employee data is missing.');
  }

  const employeeNo = String(data.employeeNo || '').trim();
  const name = String(data.name || '').trim();
  const designation = String(data.designation || '').trim();

  if (!employeeNo) throw new Error('Employee No is required.');
  if (!name) throw new Error('Employee Name is required.');
  if (!designation) throw new Error('Designation is required.');

  const sheet = getSpreadsheet_().getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    throw new Error('Employees sheet not found. Run setup().');
  }

  const lastRow = sheet.getLastRow();
  const rows = lastRow >= 2
    ? sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues()
    : [];

  const originalEmployeeNo = String(data.originalEmployeeNo || '').trim();
  let rowNumber = -1;
  let existingRow = null;

  for (let i = 0; i < rows.length; i++) {
    const existingNo = String(rows[i][0] || '').trim();

    if (existingNo === employeeNo && existingNo !== originalEmployeeNo) {
      throw new Error('Employee No already exists.');
    }

    if (originalEmployeeNo && existingNo === originalEmployeeNo) {
      rowNumber = i + 2;
      existingRow = rows[i];
    }
  }

  const token = existingRow && existingRow[8]
    ? String(existingRow[8])
    : Utilities.getUuid();

  let photoUrl = existingRow ? String(existingRow[7] || '') : '';

  if (data.photo?.base64) {
    photoUrl = uploadPhoto_(data.photo, employeeNo);
  }

  const joiningDate = data.joiningDate
    ? new Date(data.joiningDate)
    : '';

  const now = new Date();

  const row = [
    employeeNo,
    name,
    designation,
    String(data.department || '').trim(),
    String(data.email || '').trim(),
    String(data.phone || '').trim(),
    joiningDate,
    photoUrl,
    token,
    existingRow ? existingRow[9] || now : now,
    now,
    String(data.status || 'Active')
  ];

  if (rowNumber === -1) {
    sheet.appendRow(row);
  } else {
    sheet.getRange(rowNumber, 1, 1, HEADERS.length).setValues([row]);
  }

  return adminEmployee_(row);
}

function getEmployees_() {
  const sheet = getSpreadsheet_().getSheetByName(CONFIG.SHEET_NAME);

  if (!sheet || sheet.getLastRow() < 2) {
    return [];
  }

  return sheet
    .getRange(2, 1, sheet.getLastRow() - 1, HEADERS.length)
    .getValues()
    .map(adminEmployee_);
}

function getEmployeeByToken_(token) {
  token = String(token || '').trim();

  if (!token) return null;

  const sheet = getSpreadsheet_().getSheetByName(CONFIG.SHEET_NAME);

  if (!sheet || sheet.getLastRow() < 2) return null;

  const rows = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, HEADERS.length)
    .getValues();

  for (const row of rows) {
    if (
      String(row[8] || '') === token &&
      String(row[11] || 'Active') === 'Active'
    ) {
      // IMPORTANT: public verification does not expose email, phone or token.
      return {
        employeeNo: String(row[0] || ''),
        name: String(row[1] || ''),
        designation: String(row[2] || ''),
        department: String(row[3] || ''),
        joiningDate: formatDate_(row[6]),
        photoUrl: String(row[7] || ''),
        status: String(row[11] || 'Active')
      };
    }
  }

  return null;
}

function deleteEmployee_(employeeNo) {
  const sheet = getSpreadsheet_().getSheetByName(CONFIG.SHEET_NAME);

  if (!sheet || sheet.getLastRow() < 2) {
    throw new Error('Employee not found.');
  }

  const rows = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, HEADERS.length)
    .getValues();

  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][0] || '') === String(employeeNo || '')) {
      sheet.deleteRow(i + 2);
      return {
        success: true,
        message: 'Employee deleted successfully.'
      };
    }
  }

  throw new Error('Employee not found.');
}

function uploadPhoto_(photo, employeeNo) {
  if (!photo.base64) {
    throw new Error('Photo is empty.');
  }

  const estimatedBytes = Math.floor(photo.base64.length * 0.75);

  if (estimatedBytes > CONFIG.MAX_PHOTO_BYTES) {
    throw new Error('Photo is too large. Maximum size is approximately 800 KB.');
  }

  const bytes = Utilities.base64Decode(photo.base64);
  const mimeType = photo.mimeType || 'image/jpeg';
  const extension = mimeType === 'image/png' ? '.png' : '.jpg';

  const file = getPhotoFolder_().createFile(
    Utilities.newBlob(
      bytes,
      mimeType,
      employeeNo + '-' + Date.now() + extension
    )
  );

  try {
    file.setSharing(
      DriveApp.Access.ANYONE_WITH_LINK,
      DriveApp.Permission.VIEW
    );
  } catch (error) {
    console.log('Could not change Drive sharing: ' + error.message);
  }

  return 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w600';
}

function getSpreadsheet_() {
  const id = PropertiesService
    .getScriptProperties()
    .getProperty(CONFIG.SPREADSHEET_ID_PROPERTY);

  if (id) {
    return SpreadsheetApp.openById(id);
  }

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  if (!spreadsheet) {
    throw new Error('Spreadsheet ID is not configured.');
  }

  return spreadsheet;
}

function getPhotoFolder_() {
  const folders = DriveApp.getFoldersByName(CONFIG.PHOTO_FOLDER_NAME);

  if (folders.hasNext()) {
    return folders.next();
  }

  return DriveApp.createFolder(CONFIG.PHOTO_FOLDER_NAME);
}

function adminEmployee_(row) {
  return {
    employeeNo: String(row[0] || ''),
    name: String(row[1] || ''),
    designation: String(row[2] || ''),
    department: String(row[3] || ''),
    email: String(row[4] || ''),
    phone: String(row[5] || ''),
    joiningDate: formatDate_(row[6]),
    photoUrl: String(row[7] || ''),
    token: String(row[8] || ''),
    status: String(row[11] || 'Active')
  };
}

function formatDate_(value) {
  if (!value) return '';

  if (
    Object.prototype.toString.call(value) === '[object Date]' &&
    !isNaN(value.getTime())
  ) {
    return Utilities.formatDate(
      value,
      Session.getScriptTimeZone(),
      'yyyy-MM-dd'
    );
  }

  return String(value);
}

function jsonResponse_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/* =========================================================
   DILSHAJ INFOTECH
   EMPLOYEE ID MANAGEMENT
   ========================================================= */

let employees = [];

let currentEmployee = null;

let editingEmployeeNo = '';


/* =========================================================
   HELPER
   ========================================================= */

const $ = (id) =>
  document.getElementById(id);


/* =========================================================
   ADMIN TOKEN
   ========================================================= */

function getAdminToken() {

  return (
    localStorage.getItem('adminToken') ||
    ''
  );
}


function setAdminToken(token) {

  if (token) {

    localStorage.setItem(
      'adminToken',
      token
    );
  }
}


function clearAdminToken() {

  localStorage.removeItem(
    'adminToken'
  );
}


/* =========================================================
   LOGIN / ADMIN DISPLAY
   ========================================================= */

function showLogin() {

  $('loginSection')
    .classList
    .remove('hidden');

  $('adminSection')
    .classList
    .add('hidden');

  $('headerActions')
    .classList
    .add('hidden');
}


function showAdmin() {

  $('loginSection')
    .classList
    .add('hidden');

  $('adminSection')
    .classList
    .remove('hidden');

  $('headerActions')
    .classList
    .remove('hidden');
}


/* =========================================================
   MESSAGE
   ========================================================= */

function setMessage(
  id,
  message,
  type = ''
) {

  const element =
    $(id);

  if (!element) {
    return;
  }

  element.textContent =
    message || '';

  element.className =
    'message' +
    (
      type
        ? ` ${type}`
        : ''
    );
}


/* =========================================================
   API POST
   ========================================================= */

async function apiPost(data) {

  const token =
    getAdminToken();

  const payload = {
    ...data
  };

  if (
    token &&
    !payload.adminToken
  ) {

    payload.adminToken =
      token;
  }

  const response =
    await fetch(
      API_URL,
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'text/plain;charset=utf-8'
        },

        body:
          JSON.stringify(payload),

        redirect:
          'follow'
      }
    );


  const text =
    await response.text();


  let result;


  try {

    result =
      JSON.parse(text);

  } catch (error) {

    console.error(
      'Invalid API response:',
      text
    );

    throw new Error(
      'Invalid response from Google Apps Script.'
    );
  }


  if (
    !response.ok ||
    result.success === false
  ) {

    throw new Error(
      result.error ||
      `Request failed (${response.status})`
    );
  }


  return result;
}


/* =========================================================
   LOGIN
   ========================================================= */

async function login() {

  const pin =
    $('adminPin')
      .value
      .trim();


  if (!pin) {

    setMessage(
      'loginMessage',
      'Please enter the Admin PIN.',
      'error'
    );

    return;
  }


  const button =
    document.querySelector(
      '.login-button'
    );


  button.disabled =
    true;

  button.textContent =
    'Signing in...';


  setMessage(
    'loginMessage',
    'Authenticating...'
  );


  try {

    const result =
      await apiPost({
        action: 'login',
        pin: pin
      });


    console.log(
      'LOGIN RESPONSE:',
      result
    );


    /*
     * Support both names.
     */
    const token =
      result.adminToken ||
      result.token;


    if (
      !result.success ||
      !token
    ) {

      throw new Error(
        'Login succeeded but no admin session token was returned.'
      );
    }


    setAdminToken(
      token
    );


    $('adminPin')
      .value = '';


    showAdmin();


    await loadEmployees();


    setMessage(
      'loginMessage',
      ''
    );


    showToast(
      'Login successful.',
      'success'
    );


  } catch (error) {

    console.error(error);


    clearAdminToken();


    setMessage(
      'loginMessage',
      error.message ||
      'Login failed.',
      'error'
    );


  } finally {

    button.disabled =
      false;

    button.textContent =
      'Login';
  }
}


/* =========================================================
   LOGOUT
   ========================================================= */

async function logout() {

  const token =
    getAdminToken();


  try {

    if (token) {

      await apiPost({
        action: 'logout',
        adminToken: token
      });
    }

  } catch (error) {

    console.warn(
      'Logout API error:',
      error
    );
  }


  clearAdminToken();


  employees = [];

  currentEmployee = null;

  editingEmployeeNo = '';


  clearForm();


  showLogin();


  showToast(
    'Logged out successfully.',
    'success'
  );
}


/* =========================================================
   RESTORE SESSION
   ========================================================= */

async function restoreSession() {

  const token =
    getAdminToken();


  if (!token) {

    showLogin();

    return;
  }


  try {

    showAdmin();

    await loadEmployees();

  } catch (error) {

    console.warn(
      'Session restore failed:',
      error
    );


    clearAdminToken();

    showLogin();


    setMessage(
      'loginMessage',
      'Your session expired. Please login again.',
      'error'
    );
  }
}


/* =========================================================
   LOAD EMPLOYEES
   ========================================================= */

async function loadEmployees() {

  try {

    const result =
      await apiPost({
        action:
          'getEmployees'
      });


    employees =
      Array.isArray(
        result.employees
      )
        ? result.employees
        : [];


    renderEmployees();

    updateStats();


    if (
      employees.length > 0 &&
      !currentEmployee
    ) {

      showEmployeeCard(
        employees[0]
      );
    }

  } catch (error) {

    if (
      error.message &&
      error.message
        .toLowerCase()
        .includes('session')
    ) {

      clearAdminToken();

      showLogin();
    }


    throw error;
  }
}


/* =========================================================
   RENDER TABLE
   ========================================================= */

function renderEmployees() {

  const list =
    $('employeeList');


  if (
    !employees.length
  ) {

    list.innerHTML = `
      <div class="no-employees">
        No employees found.
      </div>
    `;

    return;
  }


  list.innerHTML =
    employees
      .map(
        employee => {

          const status =
            employee.status ||
            'Active';


          const statusClass =
            status
              .toLowerCase() ===
            'active'
              ? 'status-active'
              : 'status-inactive';


          return `
            <div class="employee-table employee-row">

              <span class="emp-no">
                ${escapeHtml(
                  employee.employeeNo ||
                  '—'
                )}
              </span>

              <span class="emp-name">
                ${escapeHtml(
                  employee.name ||
                  '—'
                )}
              </span>

              <span>
                ${escapeHtml(
                  employee.designation ||
                  '—'
                )}
              </span>

              <span>
                ${escapeHtml(
                  employee.department ||
                  '—'
                )}
              </span>

              <span>

                <span
                  class="status-badge ${statusClass}"
                >
                  ${escapeHtml(status)}
                </span>

              </span>

              <span class="row-actions">

                <button
                  class="small-btn view-btn"
                  onclick="showEmployeeCardByNo('${escapeAttr(employee.employeeNo)}')"
                >
                  View
                </button>

                <button
                  class="small-btn edit-btn"
                  onclick="editEmployee('${escapeAttr(employee.employeeNo)}')"
                >
                  Edit
                </button>

                <button
                  class="small-btn delete-btn"
                  onclick="deleteEmployee('${escapeAttr(employee.employeeNo)}')"
                >
                  Delete
                </button>

              </span>

            </div>
          `;
        }
      )
      .join('');
}


/* =========================================================
   STATS
   ========================================================= */

function updateStats() {

  const total =
    employees.length;


  const active =
    employees.filter(
      employee =>
        String(
          employee.status ||
          'Active'
        )
          .toLowerCase() ===
        'active'
    ).length;


  $('employeeCount')
    .textContent =
    total;


  $('activeEmployeeCount')
    .textContent =
    active;
}


/* =========================================================
   SAVE EMPLOYEE
   ========================================================= */

$('employeeForm')
  .addEventListener(
    'submit',
    async function(event) {

      event.preventDefault();


      const saveButton =
        $('saveBtn');


      saveButton.disabled =
        true;

      saveButton.textContent =
        'Saving...';


      setMessage(
        'saveMessage',
        'Saving employee...'
      );


      try {

        const photo =
          await readPhoto();


        const data = {

          originalEmployeeNo:
            $('originalEmployeeNo')
              .value
              .trim(),

          employeeNo:
            $('employeeNo')
              .value
              .trim(),

          name:
            $('name')
              .value
              .trim(),

          designation:
            $('designation')
              .value
              .trim(),

          department:
            $('department')
              .value
              .trim(),

          email:
            $('email')
              .value
              .trim(),

          phone:
            $('phone')
              .value
              .trim(),

          joiningDate:
            $('joiningDate')
              .value,

          status:
            $('status')
              .value,

          photo:
            photo
        };


        const result =
          await apiPost({

            action:
              'saveEmployee',

            data:
              data
          });


        const employee =
          result.employee;


        setMessage(
          'saveMessage',
          'Employee saved successfully.',
          'success'
        );


        /*
         * Reload from Google Sheets.
         */
        await loadEmployees();


        if (employee) {

          /*
           * Use the returned employee immediately.
           */
          showEmployeeCard(
            employee
          );
        }


        clearFormFieldsOnly();


        showToast(
          'Employee saved successfully.',
          'success'
        );


      } catch (error) {

        console.error(error);


        setMessage(
          'saveMessage',
          error.message ||
          'Unable to save employee.',
          'error'
        );


      } finally {

        saveButton.disabled =
          false;

        saveButton.textContent =
          'Save Employee';
      }
    }
  );


/* =========================================================
   READ PHOTO
   ========================================================= */

function readPhoto() {

  return new Promise(
    (resolve, reject) => {

      const input =
        $('photo');


      if (
        !input.files ||
        !input.files[0]
      ) {

        resolve(null);

        return;
      }


      const file =
        input.files[0];


      if (
        file.size >
        5 * 1024 * 1024
      ) {

        reject(
          new Error(
            'Photo is too large. Maximum size is 800 KB.'
          )
        );

        return;
      }


      if (
        !file.type
          .startsWith('image/')
      ) {

        reject(
          new Error(
            'Please select a valid image file.'
          )
        );

        return;
      }


      const reader =
        new FileReader();


      reader.onload =
        () => {

          const result =
            String(
              reader.result
            );


          const commaIndex =
            result.indexOf(',');


          const base64 =
            commaIndex >= 0
              ? result.substring(
                  commaIndex + 1
                )
              : result;


          resolve({

            base64:
              base64,

            mimeType:
              file.type,

            name:
              file.name
          });
        };


      reader.onerror =
        () => {

          reject(
            new Error(
              'Unable to read photo.'
            )
          );
        };


      reader.readAsDataURL(
        file
      );
    }
  );
}


/* =========================================================
   EDIT
   ========================================================= */

function editEmployee(
  employeeNo
) {

  const employee =
    employees.find(
      item =>
        String(
          item.employeeNo
        ) ===
        String(employeeNo)
    );


  if (!employee) {

    showToast(
      'Employee not found.',
      'error'
    );

    return;
  }


  editingEmployeeNo =
    employee.employeeNo;


  $('originalEmployeeNo')
    .value =
    employee.employeeNo ||
    '';


  $('employeeNo')
    .value =
    employee.employeeNo ||
    '';


  $('name')
    .value =
    employee.name ||
    '';


  $('designation')
    .value =
    employee.designation ||
    '';


  $('department')
    .value =
    employee.department ||
    '';


  $('email')
    .value =
    employee.email ||
    '';


  $('phone')
    .value =
    employee.phone ||
    '';


  $('joiningDate')
    .value =
    normalizeDateForInput(
      employee.joiningDate
    );


  $('status')
    .value =
    employee.status ||
    'Active';


  $('photo')
    .value =
    '';


  $('formTitle')
    .textContent =
    'Edit Employee';


  $('saveBtn')
    .textContent =
    'Update Employee';


  showEmployeeCard(
    employee
  );


  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}


/* =========================================================
   DELETE
   ========================================================= */

async function deleteEmployee(
  employeeNo
) {

  const employee =
    employees.find(
      item =>
        String(
          item.employeeNo
        ) ===
        String(employeeNo)
    );


  if (!employee) {

    showToast(
      'Employee not found.',
      'error'
    );

    return;
  }


  const confirmed =
    confirm(
      `Delete employee ${employee.name || employee.employeeNo}?`
    );


  if (!confirmed) {
    return;
  }


  try {

    await apiPost({

      action:
        'deleteEmployee',

      employeeNo:
        employeeNo
    });


    showToast(
      'Employee deleted successfully.',
      'success'
    );


    if (
      currentEmployee &&
      String(
        currentEmployee.employeeNo
      ) ===
      String(employeeNo)
    ) {

      currentEmployee =
        null;

      hideCard();
    }


    await loadEmployees();


  } catch (error) {

    console.error(error);


    showToast(
      error.message ||
      'Unable to delete employee.',
      'error'
    );
  }
}


/* =========================================================
   SHOW EMPLOYEE
   ========================================================= */

function showEmployeeCardByNo(
  employeeNo
) {

  const employee =
    employees.find(
      item =>
        String(
          item.employeeNo
        ) ===
        String(employeeNo)
    );


  if (!employee) {

    showToast(
      'Employee not found.',
      'error'
    );

    return;
  }


  showEmployeeCard(
    employee
  );
}


/* =========================================================
   SHOW CARD
   ========================================================= */

function showEmployeeCard(
  employee
) {

  if (!employee) {
    return;
  }


  currentEmployee =
    employee;


  $('emptyCard')
    .classList
    .add('hidden');


  $('idCard')
    .classList
    .remove('hidden');


  $('cardName')
    .textContent =
    employee.name ||
    'Employee Name';


  $('cardDesignation')
    .textContent =
    employee.designation ||
    'DESIGNATION';


  $('cardEmployeeNo')
    .textContent =
    employee.employeeNo ||
    '—';


  $('cardDepartment')
    .textContent =
    employee.department ||
    '—';


  $('cardJoiningDate')
    .textContent =
    formatDisplayDate(
      employee.joiningDate
    );


  updateCardPhoto(
    employee.photoUrl
  );


  generateQr(
    employee.token
  );
}


/* =========================================================
   PHOTO
   ========================================================= */

function updateCardPhoto(
  photoUrl
) {

  const photo =
    $('cardPhoto');


  const placeholder =
    $('cardPhotoPlaceholder');


  if (photoUrl) {

    photo.src =
      photoUrl;


    photo.onload =
      () => {

        photo
          .classList
          .remove('hidden');

        placeholder
          .classList
          .add('hidden');
      };


    photo.onerror =
      () => {

        photo
          .removeAttribute(
            'src'
          );

        photo
          .classList
          .add('hidden');

        placeholder
          .classList
          .remove('hidden');
      };


  } else {

    photo
      .removeAttribute(
        'src'
      );

    photo
      .classList
      .add('hidden');


    placeholder
      .classList
      .remove('hidden');
  }
}


/* =========================================================
   QR URL
   ========================================================= */

function createProfileUrl(
  token
) {

  if (!token) {
    return '';
  }


  const url =
    new URL(
      'verify.html',
      window.location.href
    );


  url.search = '';


  url.searchParams.set(
    'id',
    token
  );


  return url.toString();
}


/* =========================================================
   GENERATE QR
   ========================================================= */

function generateQr(
  token
) {

  const canvas =
    $('qrCanvas');


  if (!canvas) {
    return;
  }


  const url =
    createProfileUrl(
      token
    );


  if (
    !url ||
    typeof QRious ===
      'undefined'
  ) {

    return;
  }


  new QRious({

    element:
      canvas,

    value:
      url,

    size:
      125,

    level:
      'H',

    background:
      'white',

    foreground:
      'black'
  });
}


/* =========================================================
   COPY QR LINK
   ========================================================= */

async function copyQrLink() {

  if (
    !currentEmployee ||
    !currentEmployee.token
  ) {

    showToast(
      'Save an employee first.',
      'error'
    );

    return;
  }


  const url =
    createProfileUrl(
      currentEmployee.token
    );


  try {

    await navigator
      .clipboard
      .writeText(url);


    showToast(
      'QR verification link copied.',
      'success'
    );


  } catch (error) {

    prompt(
      'Copy this verification URL:',
      url
    );
  }
}


/* =========================================================
   PRINT
   ========================================================= */

function printCard() {

  if (!currentEmployee) {

    showToast(
      'Select an employee first.',
      'error'
    );

    return;
  }


  window.print();
}


/* =========================================================
   CLEAR FORM
   ========================================================= */

function clearFormFieldsOnly() {

  $('originalEmployeeNo')
    .value = '';


  $('employeeNo')
    .value = '';


  $('name')
    .value = '';


  $('designation')
    .value = '';


  $('department')
    .value = '';


  $('email')
    .value = '';


  $('phone')
    .value = '';


  $('joiningDate')
    .value = '';


  $('status')
    .value =
    'Active';


  $('photo')
    .value = '';


  editingEmployeeNo =
    '';


  $('formTitle')
    .textContent =
    'Create Employee';


  $('saveBtn')
    .textContent =
    'Save Employee';
}


function clearForm() {

  clearFormFieldsOnly();


  setMessage(
    'saveMessage',
    ''
  );
}


/* =========================================================
   HIDE CARD
   ========================================================= */

function hideCard() {

  $('idCard')
    .classList
    .add('hidden');


  $('emptyCard')
    .classList
    .remove('hidden');
}


/* =========================================================
   TOAST
   ========================================================= */

function showToast(
  message,
  type = ''
) {

  const toast =
    $('toast');


  toast.textContent =
    message;


  toast.className =
    'toast' +
    (
      type
        ? ` ${type}`
        : ''
    );


  clearTimeout(
    showToast.timer
  );


  showToast.timer =
    setTimeout(
      () => {

        toast
          .classList
          .add('hidden');

      },
      3000
    );
}


/* =========================================================
   DATE FORMAT
   ========================================================= */

function formatDisplayDate(
  value
) {

  if (!value) {
    return '—';
  }


  const normalized =
    normalizeDateForInput(
      value
    );


  if (!normalized) {

    return String(
      value
    );
  }


  const parts =
    normalized.split('-');


  if (
    parts.length === 3
  ) {

    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }


  return String(
    value
  );
}


function normalizeDateForInput(
  value
) {

  if (!value) {
    return '';
  }


  const text =
    String(value)
      .trim();


  if (
    /^\d{4}-\d{2}-\d{2}$/
      .test(text)
  ) {

    return text;
  }


  const match =
    text.match(
      /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/
    );


  if (match) {

    const day =
      match[1]
        .padStart(2, '0');


    const month =
      match[2]
        .padStart(2, '0');


    const year =
      match[3];


    return (
      `${year}-${month}-${day}`
    );
  }


  return '';
}


/* =========================================================
   ESCAPE HTML
   ========================================================= */

function escapeHtml(
  value
) {

  return String(
    value ?? ''
  )

    .replace(
      /&/g,
      '&amp;'
    )

    .replace(
      /</g,
      '&lt;'
    )

    .replace(
      />/g,
      '&gt;'
    )

    .replace(
      /"/g,
      '&quot;'
    )

    .replace(
      /'/g,
      '&#039;'
    );
}


function escapeAttr(
  value
) {

  return String(
    value ?? ''
  )

    .replace(
      /\\/g,
      '\\\\'
    )

    .replace(
      /'/g,
      "\\'"
    );
}


/* =========================================================
   PHOTO LIVE PREVIEW
   ========================================================= */

$('photo')
  .addEventListener(
    'change',
    function() {

      const file =
        this.files &&
        this.files[0];


      if (!file) {

        if (currentEmployee) {

          updateCardPhoto(
            currentEmployee.photoUrl
          );
        }

        return;
      }


      if (
        file.size >
        800 * 1024
      ) {

        this.value =
          '';


        showToast(
          'Photo is too large. Maximum 800 KB.',
          'error'
        );


        return;
      }


      const localUrl =
        URL.createObjectURL(
          file
        );


      const photo =
        $('cardPhoto');


      const placeholder =
        $('cardPhotoPlaceholder');


      $('emptyCard')
        .classList
        .add('hidden');


      $('idCard')
        .classList
        .remove('hidden');


      photo.src =
        localUrl;


      photo.onload =
        () => {

          photo
            .classList
            .remove('hidden');


          placeholder
            .classList
            .add('hidden');
        };
    }
  );


/* =========================================================
   LIVE PREVIEW
   ========================================================= */

[
  'employeeNo',
  'name',
  'designation',
  'department',
  'joiningDate'
]
.forEach(
  id => {

    $(id)
      .addEventListener(
        'input',
        () => {

          updateUnsavedPreview();

        }
      );
  }
);


function updateUnsavedPreview() {

  const name =
    $('name')
      .value
      .trim();


  const designation =
    $('designation')
      .value
      .trim();


  const employeeNo =
    $('employeeNo')
      .value
      .trim();


  const department =
    $('department')
      .value
      .trim();


  const joiningDate =
    $('joiningDate')
      .value;


  if (
    !name &&
    !designation &&
    !employeeNo
  ) {

    return;
  }


  $('emptyCard')
    .classList
    .add('hidden');


  $('idCard')
    .classList
    .remove('hidden');


  $('cardName')
    .textContent =
    name ||
    'Employee Name';


  $('cardDesignation')
    .textContent =
    designation ||
    'DESIGNATION';


  $('cardEmployeeNo')
    .textContent =
    employeeNo ||
    '—';


  $('cardDepartment')
    .textContent =
    department ||
    '—';


  $('cardJoiningDate')
    .textContent =
    joiningDate
      ? formatDisplayDate(
          joiningDate
        )
      : '—';
}


/* =========================================================
   ENTER TO LOGIN
   ========================================================= */

$('adminPin')
  .addEventListener(
    'keydown',
    function(event) {

      if (
        event.key ===
        'Enter'
      ) {

        login();
      }
    }
  );


/* =========================================================
   START
   ========================================================= */

document.addEventListener(
  'DOMContentLoaded',
  function() {

    restoreSession();

  }
);
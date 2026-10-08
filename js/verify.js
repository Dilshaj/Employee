function verifyEmployee() {
  const token = new URLSearchParams(window.location.search).get('id');

  if (!token) {
    showError('Invalid verification link.');
    return;
  }

  // Public verification uses JSONP so it works from a static website
  // without requiring a server-side proxy.
  const callbackName = 'employeeVerify_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
  const script = document.createElement('script');
  let finished = false;

  window[callbackName] = function (result) {
    finished = true;
    cleanup();

    if (!result || !result.success) {
      showError(result?.error || 'Verification failed.');
      return;
    }

    if (!result.employee) {
      showError('Employee not found or inactive.');
      return;
    }

    showEmployee(result.employee);
  };

  script.src = API_URL +
    '?action=verify' +
    '&id=' + encodeURIComponent(token) +
    '&callback=' + encodeURIComponent(callbackName);

  script.onerror = function () {
    if (finished) return;
    cleanup();
    showError('Unable to contact the verification service.');
  };

  document.head.appendChild(script);

  function cleanup() {
    delete window[callbackName];
    if (script.parentNode) script.parentNode.removeChild(script);
  }
}

function showEmployee(employee) {
  document.getElementById('loading').classList.add('hidden');
  document.getElementById('result').classList.remove('hidden');

  const photo = document.getElementById('verifyPhoto');

  if (employee.photoUrl) {
    photo.src = employee.photoUrl;
    photo.classList.remove('hidden');
  } else {
    photo.removeAttribute('src');
    photo.classList.add('hidden');
  }

  document.getElementById('verifyName').textContent = employee.name || '-';
  document.getElementById('verifyDesignation').textContent = employee.designation || '-';
  document.getElementById('verifyEmployeeNo').textContent = employee.employeeNo || '-';
  document.getElementById('verifyDepartment').textContent = employee.department || '-';
  document.getElementById('verifyStatus').textContent = employee.status || '-';
}

function showError(message) {
  document.getElementById('loading').classList.add('hidden');
  const error = document.getElementById('error');
  error.textContent = message;
  error.classList.remove('hidden');
}

verifyEmployee();

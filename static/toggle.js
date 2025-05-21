// === Password toggle script ===

// Check if signup toggle exists (signup page)
const toggleSignup = document.getElementById('toggleSignupPassword');
if (toggleSignup) {
  const input = document.getElementById('signupPassword');
  toggleSignup.addEventListener('click', function () {
    togglePassword(input, this);
  });
}

// Check if signin toggle exists (login page)
const toggleSignin = document.getElementById('toggleSigninPassword');
if (toggleSignin) {
  const input = document.getElementById('loginPassword');
  toggleSignin.addEventListener('click', function () {
    togglePassword(input, this);
  });
}

// Toggle function shared by both
function togglePassword(input, iconContainer) {
  const icon = iconContainer.querySelector('i');
  if (input.type === 'password') {
    input.type = 'text';
    icon.classList.remove('fa-eye-slash');
    icon.classList.add('fa-eye');
  } else {
    input.type = 'password';
    icon.classList.remove('fa-eye');
    icon.classList.add('fa-eye-slash');
  }
}

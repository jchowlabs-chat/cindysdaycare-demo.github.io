// Update this URL after deploying the cindys-daycare-web-form Cloudflare Worker.
const WORKER_URL = 'https://cindys-daycare-web-form.jchow-a27.workers.dev';

// ─── Phone number live formatting ────────────────────────────────────────────
const phoneInput = document.getElementById('cf-phone');
if (phoneInput) {
  phoneInput.addEventListener('input', () => {
    const digits = phoneInput.value.replace(/\D/g, '').slice(0, 10);
    let formatted = '';
    if (digits.length > 6)      formatted = `(${digits.slice(0,3)})-${digits.slice(3,6)}-${digits.slice(6)}`;
    else if (digits.length > 3) formatted = `(${digits.slice(0,3)})-${digits.slice(3)}`;
    else if (digits.length > 0) formatted = `(${digits}`;
    phoneInput.value = formatted;
  });
}

const contactForm = document.getElementById('contact-form');
const contactFormStatus = document.getElementById('contact-form-status');
const contactFormSubmit = document.getElementById('contact-form-submit');
const contactFormSubmitLabel = contactFormSubmit ? contactFormSubmit.textContent : '';

if (contactForm && contactFormStatus && contactFormSubmit) {
  contactForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    contactFormStatus.className = 'form-status';
    contactFormStatus.textContent = '';

    contactFormSubmit.disabled = true;
    contactFormSubmit.textContent = 'Sending...';

    try {
      const name = document.getElementById('cf-name').value.trim();
      const phone = document.getElementById('cf-phone').value.trim();
      const message = document.getElementById('cf-message').value.trim();

      if (!name || !phone) {
        throw new Error('Please fill in your name and phone number.');
      }

      const payload = { name, phone };
      if (message) payload.message = message;

      const response = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Oops, something went wrong. Please try again.');
      }

      contactForm.reset();
      contactFormStatus.className = 'form-status form-status-success';
      contactFormStatus.textContent = 'Thank you! We will be in touch soon to schedule your tour.';
    } catch (error) {
      contactFormStatus.className = 'form-status form-status-error';
      contactFormStatus.textContent = error.message || 'Oops, something went wrong. Please try again.';
    } finally {
      contactFormSubmit.disabled = false;
      contactFormSubmit.textContent = contactFormSubmitLabel;
    }
  });
}

document.addEventListener('DOMContentLoaded', function() {
  var form = document.getElementById('contact-form');
  if (!form) return;

  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    var btn = document.getElementById('submit-btn');
    var status = document.getElementById('form-status');

    btn.disabled = true;
    btn.textContent = 'Sending...';
    status.textContent = '';
    status.className = 'form-status';

    try {
      var data = {
        name: form.elements.name.value,
        email: form.elements.email.value,
        company: form.elements.company.value,
        role: form.elements.role.value,
        interest: form.elements.interest.value,
        message: form.elements.message.value
      };

      var res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (res.ok) {
        status.textContent = 'Message sent! We will get back to you within one business day.';
        status.className = 'form-status success';
        form.reset();
      } else {
        var err = await res.json();
        status.textContent = err.error || 'Something went wrong. Please try again.';
        status.className = 'form-status error';
      }
    } catch(ex) {
      status.textContent = 'Network error. Please try again.';
      status.className = 'form-status error';
    }

    btn.disabled = false;
    btn.textContent = 'Send Message';
  });
});

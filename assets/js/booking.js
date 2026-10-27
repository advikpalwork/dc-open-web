/* Book-a-demo submission -> Supabase `demo_requests` (same table and columns as before). */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabase = createClient(
  'https://odiabdmzrfyznlfdlgtx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kaWFiZG16cmZ5em5sZmRsZ3R4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2NzE2MzAsImV4cCI6MjA5OTI0NzYzMH0.rF18H2DelUQjtu7mYwBmUni9rzaeLb7ij6w5NLXGBTk'
);

const $ = id => document.getElementById(id);
const submit = $('demoSubmit');

if (submit) {
  const form = $('demoForm'), success = $('demoSuccess'), err = $('demoError');
  const fail = msg => { err.textContent = msg; err.style.display = 'block'; };

  submit.addEventListener('click', async () => {
    const v = id => $(id).value.trim();
    const row = {
      name: v('demoName'), organisation: v('demoOrg'), category: $('demoCat').value,
      phone: v('demoPhone'), email: v('demoEmail'),
      preferred_date: $('demoDate').value, preferred_time: $('demoTime').value
    };
    if (Object.values(row).some(x => !x)) return fail('Please fill in all fields.');
    if (!/\S+@\S+\.\S+/.test(row.email)) return fail('Please enter a valid email address.');

    err.style.display = 'none';
    submit.disabled = true;
    submit.textContent = 'Sending…';
    try {
      const { error } = await supabase.from('demo_requests').insert([{ ...row, created_at: new Date().toISOString() }]);
      if (error) throw error;
      form.style.display = 'none';
      success.style.display = 'block';
      ['demoName', 'demoOrg', 'demoPhone', 'demoEmail', 'demoDate', 'demoTime'].forEach(id => { $(id).value = ''; });
      $('demoCat').selectedIndex = 0;
    } catch (e) {
      fail('Something went wrong. Please try again or email hello@datic.in.');
      submit.disabled = false;
      submit.textContent = 'Request my demo';
      console.error('[demo]', e);
    }
  });
}

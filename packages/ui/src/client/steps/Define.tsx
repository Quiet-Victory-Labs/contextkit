import { signal } from '@preact/signals';
import { Button, Card, Input, Textarea, Select } from '@runcontext/uxd/react';
import { api } from '../api';
import { brief, currentStep, sources } from '../state';

const saving = signal(false);
const formError = signal('');
const fieldErrors = signal<Record<string, string>>({});
const suggesting = signal(false);

export function Define() {
  const b = brief.value;

  function updateBrief(field: string, value: string) {
    if (field.startsWith('owner.')) {
      const ownerField = field.split('.')[1];
      brief.value = { ...b, owner: { ...b.owner, [ownerField]: value } };
    } else {
      brief.value = { ...b, [field]: value };
    }
  }

  async function handleContinue() {
    const errors: Record<string, string> = {};
    if (!b.product_name.trim()) errors.product_name = 'Product name is required.';
    else if (!/^[a-zA-Z0-9_-]+$/.test(b.product_name.trim())) errors.product_name = 'Only letters, numbers, hyphens, and underscores allowed.';
    if (!b.description.trim()) errors.description = 'Description is required.';

    fieldErrors.value = errors;
    if (Object.keys(errors).length > 0) return;

    saving.value = true;
    formError.value = '';
    try {
      await api('POST', '/api/brief', b);
      currentStep.value = 3;
    } catch (e: any) {
      formError.value = e.message || 'Failed to save. Please try again.';
    } finally {
      saving.value = false;
    }
  }

  // Auto-suggest on first render if fields empty
  if (!suggesting.value && !b.product_name && !b.description && !b.owner.name && sources.value.length > 0) {
    suggesting.value = true;
    api<any>('POST', '/api/suggest-brief', { source: sources.value[0] }).then(data => {
      const current = brief.value;
      brief.value = {
        product_name: current.product_name || data.product_name || '',
        description: current.description || data.description || '',
        owner: {
          name: current.owner.name || data.owner?.name || '',
          team: current.owner.team || data.owner?.team || '',
          email: current.owner.email || data.owner?.email || '',
        },
        sensitivity: current.sensitivity || data.sensitivity || 'internal',
        docs: current.docs,
      };
    }).catch(() => {}).finally(() => { suggesting.value = false; });
  }

  const errs = fieldErrors.value;

  return (
    <Card>
      <h2>Define Your Data Product</h2>
      <p class="muted">Tell us about your data product. This metadata helps AI agents understand what they are working with.</p>

      {suggesting.value && <p class="muted suggest-loading">Auto-filling from your database...</p>}

      <div class="define-form">
        <div class="field full-width">
          <label for="product_name">Product Name *</label>
          <Input id="product_name" value={b.product_name} onInput={(e: any) => updateBrief('product_name', e.currentTarget.value)} placeholder="my-data-product" error={!!errs.product_name} />
          {errs.product_name && <p class="field-error">{errs.product_name}</p>}
          <p class="hint">Alphanumeric, hyphens, and underscores only.</p>
        </div>

        <div class="field full-width">
          <label for="description">Description *</label>
          <Textarea id="description" value={b.description} onInput={(e: any) => updateBrief('description', e.currentTarget.value)} placeholder="What does this data product provide?" error={!!errs.description} />
          {errs.description && <p class="field-error">{errs.description}</p>}
        </div>

        <div class="field">
          <label for="owner_name">Owner Name</label>
          <Input id="owner_name" value={b.owner.name} onInput={(e: any) => updateBrief('owner.name', e.currentTarget.value)} placeholder="Jane Doe" />
        </div>

        <div class="field">
          <label for="owner_team">Team</label>
          <Input id="owner_team" value={b.owner.team} onInput={(e: any) => updateBrief('owner.team', e.currentTarget.value)} placeholder="Data Engineering" />
        </div>

        <div class="field">
          <label for="owner_email">Email</label>
          <Input id="owner_email" value={b.owner.email} onInput={(e: any) => updateBrief('owner.email', e.currentTarget.value)} placeholder="jane@example.com" />
        </div>

        <div class="field">
          <label for="sensitivity">Sensitivity</label>
          <Select id="sensitivity" value={b.sensitivity} onChange={(e: any) => updateBrief('sensitivity', e.currentTarget.value)}>
            <option value="public">Public</option>
            <option value="internal">Internal</option>
            <option value="confidential">Confidential</option>
            <option value="restricted">Restricted</option>
          </Select>
        </div>

        <div class="define-actions">
          <Button variant="secondary" onClick={() => { currentStep.value = 1; }}>Back</Button>
          <Button onClick={handleContinue} disabled={saving.value}>
            {saving.value ? 'Saving...' : 'Continue'}
          </Button>
        </div>

        {formError.value && <p class="field-error">{formError.value}</p>}
      </div>
    </Card>
  );
}

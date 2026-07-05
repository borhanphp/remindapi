const { z } = require('zod');

const optionalTrimmed = (max) =>
    z.string().trim().max(max).optional().nullable().or(z.literal('')).transform(v => v || null);

const createInvoiceSchema = z.object({
    clientName: z.string().trim().min(1, 'Client name is required').max(200),
    clientEmail: z.string().trim().email('Invalid client email').max(255),
    clientPhone: optionalTrimmed(20),
    invoiceNumber: optionalTrimmed(50),
    amount: z.coerce.number().positive('Amount must be greater than zero').finite().max(999999999),
    currency: z.string().trim().regex(/^[A-Za-z]{3}$/, 'Currency must be a 3-letter code').optional(),
    dueDate: z.coerce.date({ errorMap: () => ({ message: 'Invalid due date' }) }),
    paymentLink: z.string().trim().url('Payment link must be a valid URL').max(2000)
        .optional().nullable().or(z.literal('')).transform(v => v || null),
    reminderChannels: z.array(z.string()).max(3).optional(),
});

// Owners may edit invoice content and move between draft/sent; payment state
// (paid/paidAmount/lateFee/portalToken) only changes through its own endpoints.
const updateInvoiceSchema = createInvoiceSchema.partial().extend({
    status: z.enum(['draft', 'sent']).optional(),
});

function validate(schema, body) {
    const result = schema.safeParse(body);
    if (result.success) {
        return { data: result.data };
    }
    const message = result.error.issues
        .map(i => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message))
        .join('; ');
    return { error: message };
}

module.exports = { createInvoiceSchema, updateInvoiceSchema, validate };

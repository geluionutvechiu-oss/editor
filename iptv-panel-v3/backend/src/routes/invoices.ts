import { Router, Response } from 'express';
import { z } from 'zod';
import PDFDocument from 'pdfkit';
import prisma from '../lib/prisma';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const schema = z.object({
  clientId: z.string().uuid(),
  amount: z.number().min(0),
  dueDate: z.string().datetime(),
  notes: z.string().optional(),
});

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { page = '1', limit = '25', status } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const where: Record<string, unknown> = {};
  if (req.user!.role !== 'ADMIN') where.userId = req.user!.userId;
  if (status) where.status = status;

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({ where, skip, take: parseInt(limit), orderBy: { createdAt: 'desc' }, include: { client: { select: { username: true } } } }),
    prisma.invoice.count({ where }),
  ]);
  res.json({ data: invoices, total, pages: Math.ceil(total / parseInt(limit)) });
});

router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const count = await prisma.invoice.count();
  const invoiceNumber = `INV-${String(count + 1).padStart(6, '0')}`;

  const invoice = await prisma.invoice.create({
    data: { ...parsed.data, dueDate: new Date(parsed.data.dueDate), invoiceNumber, userId: req.user!.userId },
    include: { client: true },
  });
  res.status(201).json(invoice);
});

router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const where: Record<string, unknown> = { id: req.params.id };
  if (req.user!.role !== 'ADMIN') where.userId = req.user!.userId;
  const invoice = await prisma.invoice.findFirst({ where, include: { client: true, user: { select: { username: true, email: true } } } });
  if (!invoice) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(invoice);
});

router.put('/:id/status', async (req: AuthRequest, res: Response): Promise<void> => {
  const { status } = z.object({ status: z.enum(['PAID', 'PENDING', 'OVERDUE']) }).parse(req.body);
  const paidAt = status === 'PAID' ? new Date() : null;
  const invoice = await prisma.invoice.update({ where: { id: req.params.id }, data: { status, paidAt } });
  res.json(invoice);
});

router.get('/:id/pdf', async (req: AuthRequest, res: Response): Promise<void> => {
  const where: Record<string, unknown> = { id: req.params.id };
  if (req.user!.role !== 'ADMIN') where.userId = req.user!.userId;

  const invoice = await prisma.invoice.findFirst({ where, include: { client: true, user: { select: { username: true, email: true } } } });
  if (!invoice) { res.status(404).json({ error: 'Not found' }); return; }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`);

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  doc.pipe(res);

  // Header
  doc.fontSize(24).font('Helvetica-Bold').text('INVOICE', 50, 50);
  doc.fontSize(12).font('Helvetica').text(`Invoice #: ${invoice.invoiceNumber}`, 50, 90);
  doc.text(`Date: ${invoice.createdAt.toLocaleDateString()}`, 50, 108);
  doc.text(`Due: ${invoice.dueDate.toLocaleDateString()}`, 50, 126);

  // Status
  doc.fontSize(14).font('Helvetica-Bold').fillColor(invoice.status === 'PAID' ? '#16a34a' : invoice.status === 'OVERDUE' ? '#dc2626' : '#d97706').text(invoice.status, 450, 50);
  doc.fillColor('#000000');

  // Client Info
  doc.moveTo(50, 160).lineTo(545, 160).stroke();
  doc.fontSize(12).font('Helvetica-Bold').text('Bill To:', 50, 175);
  doc.font('Helvetica').text(invoice.client.username, 50, 193);

  // Amount
  doc.moveTo(50, 250).lineTo(545, 250).stroke();
  doc.fontSize(12).font('Helvetica-Bold').text('Description', 50, 270);
  doc.text('Amount', 450, 270);
  doc.moveTo(50, 290).lineTo(545, 290).stroke();
  doc.font('Helvetica').text('IPTV Subscription', 50, 305);
  doc.text(`$${invoice.amount.toFixed(2)}`, 450, 305);
  doc.moveTo(50, 330).lineTo(545, 330).stroke();
  doc.font('Helvetica-Bold').text('Total', 50, 345);
  doc.text(`$${invoice.amount.toFixed(2)}`, 450, 345);

  if (invoice.notes) {
    doc.font('Helvetica').fontSize(10).text(`Notes: ${invoice.notes}`, 50, 400);
  }
  doc.end();
});

export default router;

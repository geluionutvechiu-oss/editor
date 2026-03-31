import { PrismaClient, Role, UserStatus, ServerType, ServerStatus, InvoiceStatus, FirewallRuleType, NotificationType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

const COST_FACTOR = 12;

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function subDays(date: Date, days: number): Date {
  return addDays(date, -days);
}

async function main() {
  console.log('Starting database seed...');

  // ── Settings ──────────────────────────────────────────────────────────────
  const settings = [
    { key: 'smtp', value: { host: 'smtp.gmail.com', port: 587, secure: false, user: '', pass: '', from: 'noreply@iptv.local' } },
    { key: 'branding', value: { siteName: 'IPTV Panel', logoUrl: '', primaryColor: '#6366f1', supportEmail: 'support@iptv.local' } },
    { key: 'general', value: { defaultTrialDays: 7, maxConnectionsDefault: 1, timezone: 'Europe/Bucharest', currency: 'RON' } },
    { key: 'geo_blocking', value: { enabled: false, blockedCountries: [] } },
    { key: 'maintenance', value: { enabled: false, message: '' } },
  ];

  for (const s of settings) {
    await prisma.setting.upsert({ where: { key: s.key }, update: { value: s.value }, create: { key: s.key, value: s.value } });
  }
  console.log('Settings created.');

  // ── Servers ────────────────────────────────────────────────────────────────
  const serverData = [
    { name: 'Server Romania 1', url: 'http://ro1.iptv.local:8080', type: ServerType.XTREAM, username: 'admin', password: 'srv_pass_ro1', status: ServerStatus.ONLINE, uptime: 99.8, activeStreams: 142, maxStreams: 500, bandwidthMbps: 2340, location: 'Bucharest, RO' },
    { name: 'Server Europa 1', url: 'http://eu1.iptv.local:8080', type: ServerType.XTREAM, username: 'admin', password: 'srv_pass_eu1', status: ServerStatus.ONLINE, uptime: 99.5, activeStreams: 87, maxStreams: 500, bandwidthMbps: 1780, location: 'Frankfurt, DE' },
    { name: 'Server M3U CDN', url: 'http://cdn1.iptv.local:8080', type: ServerType.M3U, username: null, password: null, status: ServerStatus.DEGRADED, uptime: 97.2, activeStreams: 31, maxStreams: 200, bandwidthMbps: 560, location: 'Amsterdam, NL' },
  ];

  const servers = await Promise.all(
    serverData.map(s => prisma.server.upsert({ where: { id: uuidv4() }, update: {}, create: { ...s, lastChecked: new Date() } }))
  );
  // Re-fetch since upsert with random id always creates; just create directly
  await prisma.server.deleteMany();
  const createdServers = await Promise.all(serverData.map(s => prisma.server.create({ data: { ...s, lastChecked: new Date() } })));
  console.log(`Servers created: ${createdServers.length}`);

  // ── Plans ──────────────────────────────────────────────────────────────────
  const planData = [
    { name: 'Starter 1 Luna', description: 'Plan de baza 1 luna, 1 conexiune', durationDays: 30, maxConnections: 1, price: 15, bouquets: ['Romania', 'News'], isActive: true },
    { name: 'Standard 1 Luna', description: 'Plan standard 1 luna, 2 conexiuni', durationDays: 30, maxConnections: 2, price: 25, bouquets: ['Romania', 'News', 'Sport', 'Movies'], isActive: true },
    { name: 'Premium 3 Luni', description: 'Plan premium 3 luni, 3 conexiuni', durationDays: 90, maxConnections: 3, price: 65, bouquets: ['Romania', 'News', 'Sport', 'Movies', 'Documentary', 'Kids'], isActive: true },
    { name: 'VIP 6 Luni', description: 'Plan VIP 6 luni, 5 conexiuni', durationDays: 180, maxConnections: 5, price: 110, bouquets: ['Romania', 'News', 'Sport', 'Movies', 'Documentary', 'Kids', 'International', '4K'], isActive: true },
    { name: 'Ultra 1 An', description: 'Plan ultra anual, conexiuni nelimitate', durationDays: 365, maxConnections: 10, price: 180, bouquets: ['Romania', 'News', 'Sport', 'Movies', 'Documentary', 'Kids', 'International', '4K', 'PPV'], isActive: true },
  ];

  await prisma.plan.deleteMany();
  const createdPlans = await Promise.all(planData.map(p => prisma.plan.create({ data: p })));
  console.log(`Plans created: ${createdPlans.length}`);

  // ── Admin User ─────────────────────────────────────────────────────────────
  const adminPassword = await bcrypt.hash('admin123', COST_FACTOR);
  await prisma.user.deleteMany();

  const admin = await prisma.user.create({
    data: {
      email: 'admin@iptv.local',
      username: 'admin',
      password: adminPassword,
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
      credits: 9999,
    },
  });
  console.log(`Admin created: ${admin.email}`);

  // ── Resellers ──────────────────────────────────────────────────────────────
  const resellerNames = [
    { email: 'ionescu.mihai@reseller.local', username: 'mihai_ionescu', credits: 500 },
    { email: 'popescu.elena@reseller.local', username: 'elena_popescu', credits: 350 },
  ];

  const resellerPassword = await bcrypt.hash('reseller123', COST_FACTOR);
  const resellers = await Promise.all(
    resellerNames.map(r =>
      prisma.user.create({
        data: {
          email: r.email,
          username: r.username,
          password: resellerPassword,
          role: Role.RESELLER,
          status: UserStatus.ACTIVE,
          credits: r.credits,
        },
      })
    )
  );
  console.log(`Resellers created: ${resellers.length}`);

  // ── Clients ────────────────────────────────────────────────────────────────
  const clientNamesR1 = [
    { username: 'alex_gheorghe', notes: 'Client fidel, plateste la timp' },
    { username: 'maria_dumitru', notes: 'Prefera canale sport' },
    { username: 'dan_popa', notes: null },
    { username: 'cristina_stan', notes: 'Cerere VOD suplimentar' },
    { username: 'bogdan_moldovan', notes: 'Doua televizoare' },
    { username: 'ioana_vasile', notes: null },
    { username: 'radu_constantin', notes: 'Client din referinta' },
    { username: 'andreea_niculescu', notes: null },
    { username: 'vlad_marin', notes: 'Teste calitate 4K' },
    { username: 'simona_tudor', notes: 'Plateste anual' },
  ];

  const clientNamesR2 = [
    { username: 'florin_barbu', notes: null },
    { username: 'laura_dima', notes: 'Problema conexiune rezolvata' },
    { username: 'george_rusu', notes: null },
    { username: 'carmen_iliescu', notes: 'Pachet familie' },
    { username: 'marius_cretu', notes: null },
    { username: 'roxana_anghel', notes: 'Test gratuit extins' },
    { username: 'catalin_stoica', notes: null },
    { username: 'adriana_serban', notes: null },
    { username: 'mihaela_coman', notes: 'Solicitare factura' },
    { username: 'sorin_badea', notes: null },
  ];

  const clientPassword = await bcrypt.hash('client123', COST_FACTOR);

  const allClientData = [
    ...clientNamesR1.map((c, i) => ({ ...c, owner: resellers[0], planIdx: i % createdPlans.length, serverIdx: i % createdServers.length, daysOffset: i * 3 })),
    ...clientNamesR2.map((c, i) => ({ ...c, owner: resellers[1], planIdx: i % createdPlans.length, serverIdx: i % createdServers.length, daysOffset: i * 2 })),
  ];

  const now = new Date();
  const createdClients = await Promise.all(
    allClientData.map(async cd => {
      const plan = createdPlans[cd.planIdx];
      const server = createdServers[cd.serverIdx];
      const expiresAt = addDays(now, plan.durationDays - cd.daysOffset);
      const createdAt = subDays(now, cd.daysOffset + 5);
      const lastSeen = subDays(now, Math.floor(Math.random() * 3));

      return prisma.client.create({
        data: {
          username: cd.username,
          password: clientPassword,
          m3uUrl: `http://ro1.iptv.local:8080/get.php?username=${cd.username}&password=client123&type=m3u_plus`,
          xtreamHost: 'ro1.iptv.local:8080',
          status: cd.daysOffset > plan.durationDays ? UserStatus.EXPIRED : UserStatus.ACTIVE,
          maxConnections: plan.maxConnections,
          expiresAt,
          lastSeen,
          deviceCount: Math.floor(Math.random() * plan.maxConnections) + 1,
          notes: cd.notes,
          bouquets: plan.bouquets,
          ownerId: cd.owner.id,
          serverId: server.id,
          planId: plan.id,
          createdAt,
          updatedAt: createdAt,
        },
      });
    })
  );
  console.log(`Clients created: ${createdClients.length}`);

  // ── Invoices ───────────────────────────────────────────────────────────────
  let invoiceCounter = 1;
  const invoices: object[] = [];

  for (const client of createdClients.slice(0, 10)) {
    const plan = createdPlans[Math.floor(Math.random() * createdPlans.length)];
    const isPaid = Math.random() > 0.3;
    const dueDate = addDays(client.createdAt, 7);
    const invoiceNumber = `INV-${String(invoiceCounter++).padStart(5, '0')}`;

    const inv = await prisma.invoice.create({
      data: {
        invoiceNumber,
        amount: plan.price,
        status: isPaid ? InvoiceStatus.PAID : (dueDate < now ? InvoiceStatus.OVERDUE : InvoiceStatus.PENDING),
        dueDate,
        paidAt: isPaid ? addDays(client.createdAt, 2) : null,
        notes: isPaid ? 'Plata procesata cu succes' : null,
        clientId: client.id,
        userId: client.ownerId,
      },
    });
    invoices.push(inv);
  }
  console.log(`Invoices created: ${invoices.length}`);

  // ── Audit Logs ─────────────────────────────────────────────────────────────
  const auditActions = [
    { action: 'USER_LOGIN', resource: 'auth', details: { ip: '192.168.1.1' } },
    { action: 'CLIENT_CREATED', resource: 'client', details: { username: 'test_client' } },
    { action: 'CLIENT_UPDATED', resource: 'client', details: { field: 'status', old: 'ACTIVE', new: 'SUSPENDED' } },
    { action: 'PLAN_CREATED', resource: 'plan', details: { name: 'Test Plan' } },
    { action: 'INVOICE_PAID', resource: 'invoice', details: { amount: 25, invoiceNumber: 'INV-00001' } },
    { action: 'SERVER_ADDED', resource: 'server', details: { name: 'New Server' } },
    { action: 'CREDITS_ADJUSTED', resource: 'user', details: { amount: 100, type: 'add' } },
    { action: 'API_KEY_CREATED', resource: 'apikey', details: { name: 'Production Key' } },
    { action: 'FIREWALL_RULE_ADDED', resource: 'firewall', details: { type: 'BLACKLIST', value: '10.0.0.1' } },
    { action: 'USER_LOGOUT', resource: 'auth', details: {} },
  ];

  const allUsers = [admin, ...resellers];
  const ips = ['192.168.1.1', '10.0.0.5', '172.16.0.3', '185.220.101.5', '91.108.4.1'];

  for (let i = 0; i < 20; i++) {
    const user = allUsers[i % allUsers.length];
    const audit = auditActions[i % auditActions.length];
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: audit.action,
        resource: audit.resource,
        details: audit.details,
        ip: ips[i % ips.length],
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        createdAt: subDays(now, i),
      },
    });
  }
  console.log('Audit logs created: 20');

  // ── Notifications ──────────────────────────────────────────────────────────
  const notifData = [
    { title: 'Client nou adaugat', message: 'alex_gheorghe a fost adaugat cu succes.', type: NotificationType.SUCCESS, read: false },
    { title: 'Abonament expirat', message: 'Clientul dan_popa are abonamentul expirat.', type: NotificationType.WARNING, read: false },
    { title: 'Server degradat', message: 'Server M3U CDN functioneaza cu performanta redusa.', type: NotificationType.ERROR, read: true },
    { title: 'Factura platita', message: 'Factura INV-00001 a fost marcata ca platita.', type: NotificationType.SUCCESS, read: true },
    { title: 'Alerta partajare', message: 'Clientul vlad_marin a fost detectat pe 4 IP-uri simultane.', type: NotificationType.WARNING, read: false },
    { title: 'Credite adaugate', message: 'Au fost adaugate 100 credite in contul dvs.', type: NotificationType.INFO, read: true },
  ];

  for (const n of notifData) {
    await prisma.notification.create({
      data: { ...n, userId: resellers[0].id },
    });
  }
  for (const n of notifData.slice(0, 3)) {
    await prisma.notification.create({
      data: { ...n, userId: resellers[1].id },
    });
  }
  console.log('Notifications created.');

  // ── Firewall Rules ──────────────────────────────────────────────────────────
  const firewallRules = [
    { type: FirewallRuleType.BLACKLIST, value: '185.220.101.5', reason: 'IP asociat cu activitate frauduloasa', createdBy: admin.id },
    { type: FirewallRuleType.BLACKLIST, value: '91.108.4.1', reason: 'Brute force tentativa', createdBy: admin.id },
    { type: FirewallRuleType.BLACKLIST, value: '198.51.100.0/24', reason: 'Range blocat - proxy anonim', createdBy: admin.id },
    { type: FirewallRuleType.WHITELIST, value: '192.168.1.0/24', reason: 'Retea interna birou', createdBy: admin.id },
    { type: FirewallRuleType.WHITELIST, value: '10.0.0.1', reason: 'Server monitorizare', createdBy: admin.id },
  ];

  for (const rule of firewallRules) {
    await prisma.firewallRule.upsert({
      where: { type_value: { type: rule.type, value: rule.value } },
      update: {},
      create: { ...rule, expiresAt: null },
    });
  }
  console.log(`Firewall rules created: ${firewallRules.length}`);

  // ── Sharing Alerts ──────────────────────────────────────────────────────────
  const alertClients = createdClients.slice(0, 3);
  for (const client of alertClients) {
    await prisma.sharingAlert.create({
      data: {
        clientId: client.id,
        ips: ['5.2.3.4', '77.88.55.66', '185.10.20.30', '91.0.0.1'].slice(0, Math.floor(Math.random() * 2) + 3),
        resolved: Math.random() > 0.5,
      },
    });
  }
  console.log('Sharing alerts created.');

  // ── API Keys ───────────────────────────────────────────────────────────────
  await prisma.apiKey.create({
    data: {
      userId: resellers[0].id,
      name: 'Integration Key',
      key: `sk_live_${uuidv4().replace(/-/g, '')}`,
      permissions: ['clients:read', 'clients:write', 'invoices:read'],
      isActive: true,
      expiresAt: addDays(now, 365),
    },
  });
  await prisma.apiKey.create({
    data: {
      userId: admin.id,
      name: 'Admin Master Key',
      key: `sk_admin_${uuidv4().replace(/-/g, '')}`,
      permissions: ['*'],
      isActive: true,
      expiresAt: null,
    },
  });
  console.log('API keys created.');

  console.log('\nSeed completed successfully!');
  console.log('Admin credentials: admin@iptv.local / admin123');
  console.log('Reseller credentials: ionescu.mihai@reseller.local / reseller123');
}

main()
  .catch(e => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

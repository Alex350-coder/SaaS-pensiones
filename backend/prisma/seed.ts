/**
 * Idempotent demo seed (docs/database-design.md §5).
 * Safe to run repeatedly: upserts by natural keys, create-if-missing elsewhere.
 * Dates are computed relative to "today" so the demo always looks live.
 */
import {
  PrismaClient,
  UserRole,
  RestaurantStatus,
  DishCategory,
  MenuStatus,
  PensionStatus,
  PaymentMethod,
  PaymentStatus,
  ReservationStatus,
  AttendanceStatus,
  NoticeType,
  NotificationType,
  type User,
  type Restaurant,
  type Dish,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "Password123!";
const BCRYPT_COST = 12;
const PENSION_PRICE = "280.00";
const MENU_PRICE = "12.00";

/** Optional presentation fields for a restaurant (cover, location, price). */
interface RestaurantExtras {
  logoUrl?: string;
  coverImageUrl?: string;
  latitude?: string;
  longitude?: string;
  monthlyPensionPrice?: string;
}

/** Unsplash cover, sized/optimized. If a URL 404s, the UI falls back gracefully. */
function unsplash(id: string, w = 1200): string {
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=70`;
}

/** Date-only value at UTC midnight, offset in days from today. */
function utcDate(offsetDays: number): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offsetDays),
  );
}

/** Time-of-day value for @db.Time columns. */
function timeOf(hhmm: string): Date {
  return new Date(`1970-01-01T${hhmm}:00.000Z`);
}

// email uniqueness is a partial index (live rows), not a Prisma @unique,
// so upsert-by-email is done manually. update mirrors create: re-running the
// seed after editing names/roles/password keeps existing rows in sync.
async function upsertUser(
  email: string,
  fullName: string,
  role: UserRole,
  passwordHash: string,
): Promise<User> {
  const data = { email, fullName, role, passwordHash };
  const existing = await prisma.user.findFirst({ where: { email, deletedAt: null } });
  if (existing) {
    return prisma.user.update({ where: { id: existing.id }, data });
  }
  return prisma.user.create({ data });
}

async function seedUsers(passwordHash: string) {
  const superAdmin = await upsertUser(
    "superadmin@pensiones.dev",
    "Súper Admin",
    UserRole.SUPER_ADMIN,
    passwordHash,
  );
  const adminFogon = await upsertUser(
    "admin.fogon@pensiones.dev",
    "Rosa Quispe",
    UserRole.RESTAURANT_ADMIN,
    passwordHash,
  );
  const adminMar = await upsertUser(
    "admin.marysazon@pensiones.dev",
    "Miguel Torres",
    UserRole.RESTAURANT_ADMIN,
    passwordHash,
  );
  const adminCarmen = await upsertUser(
    "admin.donacarmen@pensiones.dev",
    "Carmen Díaz",
    UserRole.RESTAURANT_ADMIN,
    passwordHash,
  );
  const clients = await Promise.all(
    [
      ["maria@pensiones.dev", "María Fernández"],
      ["jose@pensiones.dev", "José Ramírez"],
      ["lucia@pensiones.dev", "Lucía Huamán"],
      ["carlos@pensiones.dev", "Carlos Mendoza"],
      ["ana@pensiones.dev", "Ana Castillo"],
    ].map(([email, name]) => upsertUser(email, name, UserRole.CLIENT, passwordHash)),
  );
  return { superAdmin, adminFogon, adminMar, adminCarmen, clients };
}

async function upsertRestaurant(
  ownerId: string,
  slug: string,
  name: string,
  status: RestaurantStatus,
  address: string,
  extras: RestaurantExtras = {},
): Promise<Restaurant> {
  const data = {
    ownerId,
    slug,
    name,
    status,
    address,
    description: `${name} — cocina casera de la casa, menú del día y pensiones mensuales.`,
    contactPhone: "+51 999 111 222",
    contactEmail: `contacto@${slug.replace(/-/g, "")}.dev`,
    monthlyPensionPrice: extras.monthlyPensionPrice ?? PENSION_PRICE,
    logoUrl: extras.logoUrl ?? null,
    coverImageUrl: extras.coverImageUrl ?? null,
    latitude: extras.latitude ?? null,
    longitude: extras.longitude ?? null,
  };
  const existing = await prisma.restaurant.findFirst({ where: { slug, deletedAt: null } });
  if (existing) {
    return prisma.restaurant.update({ where: { id: existing.id }, data });
  }
  return prisma.restaurant.create({ data });
}

/** Fully provision an approved restaurant for the public catalog: profile +
 *  schedules + dishes + published menus (yesterday..+5). */
async function provisionApprovedRestaurant(
  ownerId: string,
  slug: string,
  name: string,
  address: string,
  extras: RestaurantExtras,
): Promise<Restaurant> {
  const restaurant = await upsertRestaurant(
    ownerId,
    slug,
    name,
    RestaurantStatus.APPROVED,
    address,
    extras,
  );
  await seedSchedules(restaurant.id);
  const dishes = await seedDishes(restaurant.id);
  await seedDailyMenus(restaurant.id, dishes);
  return restaurant;
}

async function seedSchedules(restaurantId: string) {
  // Monday (1) to Saturday (6), lunch service.
  for (let day = 1; day <= 6; day++) {
    await prisma.restaurantSchedule.upsert({
      where: { restaurantId_dayOfWeek: { restaurantId, dayOfWeek: day } },
      update: {},
      create: {
        restaurantId,
        dayOfWeek: day,
        opensAt: timeOf("11:30"),
        closesAt: timeOf("16:00"),
      },
    });
  }
}

const DISHES: ReadonlyArray<readonly [string, DishCategory, string]> = [
  ["Papa a la huancaína", DishCategory.STARTER, "4.00"],
  ["Sopa de casa", DishCategory.STARTER, "4.00"],
  ["Ensalada fresca", DishCategory.STARTER, "3.50"],
  ["Lomo saltado", DishCategory.MAIN, "9.00"],
  ["Ají de gallina", DishCategory.MAIN, "8.50"],
  ["Arroz con pollo", DishCategory.MAIN, "8.00"],
  ["Tallarín saltado", DishCategory.MAIN, "8.00"],
  ["Chicha morada", DishCategory.BEVERAGE, "2.00"],
  ["Limonada", DishCategory.BEVERAGE, "2.00"],
  ["Refresco de maracuyá", DishCategory.BEVERAGE, "2.00"],
  ["Mazamorra morada", DishCategory.DESSERT, "2.50"],
  ["Arroz con leche", DishCategory.DESSERT, "2.50"],
];

async function seedDishes(restaurantId: string): Promise<Dish[]> {
  const dishes: Dish[] = [];
  for (const [name, category, price] of DISHES) {
    const existing = await prisma.dish.findFirst({ where: { restaurantId, name } });
    dishes.push(
      existing ??
        (await prisma.dish.create({ data: { restaurantId, name, category, price } })),
    );
  }
  return dishes;
}

/** Published menus from yesterday through 5 days ahead, rotating dishes. */
async function seedDailyMenus(restaurantId: string, dishes: Dish[]) {
  const byCategory = (cat: DishCategory) => dishes.filter((d) => d.category === cat);
  const menus = [];
  for (let offset = -1; offset <= 5; offset++) {
    const menuDate = utcDate(offset);
    const menu = await prisma.dailyMenu.upsert({
      where: { restaurantId_menuDate: { restaurantId, menuDate } },
      update: { status: MenuStatus.PUBLISHED },
      create: {
        restaurantId,
        menuDate,
        status: MenuStatus.PUBLISHED,
        menuPrice: MENU_PRICE,
      },
    });
    const rotation = offset + 1; // 0-based rotation index
    for (const cat of Object.values(DishCategory)) {
      const options = byCategory(cat);
      const dish = options[rotation % options.length];
      await prisma.dailyMenuItem.upsert({
        where: { dailyMenuId_dishId: { dailyMenuId: menu.id, dishId: dish.id } },
        update: {},
        create: { dailyMenuId: menu.id, dishId: dish.id, course: cat },
      });
    }
    menus.push(menu);
  }
  return menus;
}

async function findOrCreatePension(
  clientId: string,
  restaurantId: string,
  status: PensionStatus,
  startOffset: number,
) {
  const live: PensionStatus[] = [PensionStatus.PENDING_PAYMENT, PensionStatus.ACTIVE];
  const where = live.includes(status)
    ? { clientId, restaurantId, status: { in: live } }
    : { clientId, restaurantId, status };
  const existing = await prisma.pension.findFirst({ where });
  const startDate = utcDate(startOffset);
  const endDate = utcDate(startOffset + 30);
  if (existing) {
    // Keep the demo live: refresh dates on the found pension.
    return prisma.pension.update({
      where: { id: existing.id },
      data: { startDate, endDate, status },
    });
  }
  return prisma.pension.create({
    data: { clientId, restaurantId, status, startDate, endDate, price: PENSION_PRICE },
  });
}

async function main() {
  console.log("Seeding Pensiones demo data...");
  const passwordHash = bcrypt.hashSync(DEMO_PASSWORD, BCRYPT_COST);

  // --- Users -----------------------------------------------------------
  const { superAdmin, adminFogon, adminMar, adminCarmen, clients } =
    await seedUsers(passwordHash);
  const [maria, jose, lucia, carlos] = clients;

  // --- Restaurants (one per status) -------------------------------------
  const fogon = await upsertRestaurant(
    adminFogon.id,
    "el-fogon-andino",
    "El Fogón Andino",
    RestaurantStatus.APPROVED,
    "Av. Los Incas 742, Cusco",
    {
      coverImageUrl: unsplash("1504674900247-0877df9cc836"),
      latitude: "-13.531950",
      longitude: "-71.967463",
      monthlyPensionPrice: "280.00",
    },
  );
  await upsertRestaurant(
    adminMar.id,
    "mar-y-sazon",
    "Mar y Sazón",
    RestaurantStatus.PENDING,
    "Jr. Unión 310, Lima",
  );
  await upsertRestaurant(
    adminCarmen.id,
    "dona-carmen",
    "Doña Carmen",
    RestaurantStatus.SUSPENDED,
    "Calle Grau 155, Arequipa",
  );
  await seedSchedules(fogon.id);

  // --- Extra approved restaurants (fuller public catalog) ----------------
  const extraCatalog: ReadonlyArray<{
    email: string;
    owner: string;
    slug: string;
    name: string;
    address: string;
    extras: RestaurantExtras;
  }> = [
    {
      email: "admin.cevicheria@pensiones.dev",
      owner: "Lucía Paredes",
      slug: "la-cevicheria-del-puerto",
      name: "La Cevichería del Puerto",
      address: "Av. La Mar 1220, Miraflores, Lima",
      extras: {
        coverImageUrl: unsplash("1467003909585-2f8a72700288"),
        latitude: "-12.046374",
        longitude: "-77.042793",
        monthlyPensionPrice: "320.00",
      },
    },
    {
      email: "admin.nonna@pensiones.dev",
      owner: "Marco Rossi",
      slug: "sabores-de-la-nonna",
      name: "Sabores de la Nonna",
      address: "Calle Berlín 480, Miraflores, Lima",
      extras: {
        coverImageUrl: unsplash("1555396273-367ea4eb4db5"),
        latitude: "-12.121500",
        longitude: "-77.030200",
        monthlyPensionPrice: "300.00",
      },
    },
    {
      email: "admin.verdementa@pensiones.dev",
      owner: "Daniela Ríos",
      slug: "verde-menta",
      name: "Verde Menta",
      address: "Av. Pardo 610, Miraflores, Lima",
      extras: {
        coverImageUrl: unsplash("1546069901-ba9599a7e63c"),
        latitude: "-12.115000",
        longitude: "-77.030000",
        monthlyPensionPrice: "340.00",
      },
    },
    {
      email: "admin.brasa@pensiones.dev",
      owner: "Tomás Aguilar",
      slug: "brasa-y-carbon",
      name: "Brasa & Carbón",
      address: "Calle Mercaderes 210, Arequipa",
      extras: {
        coverImageUrl: unsplash("1544025162-d76694265947"),
        latitude: "-16.409047",
        longitude: "-71.537451",
        monthlyPensionPrice: "360.00",
      },
    },
  ];
  for (const r of extraCatalog) {
    const owner = await upsertUser(
      r.email,
      r.owner,
      UserRole.RESTAURANT_ADMIN,
      passwordHash,
    );
    await provisionApprovedRestaurant(owner.id, r.slug, r.name, r.address, r.extras);
  }

  // --- Menus -------------------------------------------------------------
  const dishes = await seedDishes(fogon.id);
  const menus = await seedDailyMenus(fogon.id, dishes);
  const todayMenu = menus.find((m) => m.menuDate.getTime() === utcDate(0).getTime())!;

  // --- Pensions in every lifecycle state ---------------------------------
  const pensionActive = await findOrCreatePension(
    maria.id, fogon.id, PensionStatus.ACTIVE, -10,
  );
  await findOrCreatePension(jose.id, fogon.id, PensionStatus.PENDING_PAYMENT, 0);
  await findOrCreatePension(lucia.id, fogon.id, PensionStatus.EXPIRED, -40);
  await findOrCreatePension(carlos.id, fogon.id, PensionStatus.CANCELLED, -20);

  // --- Payment + simulated invoice for the active pension ----------------
  let payment = await prisma.payment.findFirst({
    where: { pensionId: pensionActive.id },
  });
  payment ??= await prisma.payment.create({
    data: {
      pensionId: pensionActive.id,
      amount: PENSION_PRICE,
      method: PaymentMethod.TRANSFER,
      status: PaymentStatus.CONFIRMED,
      paidAt: new Date(),
      registeredById: adminFogon.id,
    },
  });
  const series = await prisma.invoiceSeries.upsert({
    where: { restaurantId_series: { restaurantId: fogon.id, series: "F001" } },
    update: {},
    create: { restaurantId: fogon.id, series: "F001", nextNumber: 2 },
  });
  await prisma.invoice.upsert({
    where: { paymentId: payment.id },
    update: {},
    create: {
      paymentId: payment.id,
      seriesId: series.id,
      number: 1,
      total: PENSION_PRICE,
    },
  });

  // --- Today's operation: reservation + attendance ------------------------
  const existingReservation = await prisma.reservation.findFirst({
    where: {
      clientId: maria.id,
      dailyMenuId: todayMenu.id,
      status: { not: ReservationStatus.CANCELLED },
    },
  });
  if (!existingReservation) {
    await prisma.reservation.create({
      data: {
        clientId: maria.id,
        dailyMenuId: todayMenu.id,
        pensionId: pensionActive.id,
        estimatedArrival: timeOf("13:00"),
      },
    });
  }
  await prisma.attendance.upsert({
    where: {
      pensionId_attendanceDate: {
        pensionId: pensionActive.id,
        attendanceDate: utcDate(0),
      },
    },
    update: {},
    create: {
      pensionId: pensionActive.id,
      restaurantId: fogon.id,
      attendanceDate: utcDate(0),
      status: AttendanceStatus.WILL_ATTEND,
    },
  });

  // --- Conversation between pensioner and restaurant admin ---------------
  const conversation = await prisma.conversation.upsert({
    where: { pensionId: pensionActive.id },
    update: {},
    create: { pensionId: pensionActive.id },
  });
  const messageCount = await prisma.message.count({
    where: { conversationId: conversation.id },
  });
  if (messageCount === 0) {
    await prisma.message.createMany({
      data: [
        {
          conversationId: conversation.id,
          senderId: maria.id,
          content: "Hola, ¿el menú de mañana incluye opción sin ají?",
        },
        {
          conversationId: conversation.id,
          senderId: adminFogon.id,
          content: "¡Hola María! Sí, te podemos preparar el plato sin ají, sin problema.",
        },
      ],
    });
  }

  // --- Notice + notification ----------------------------------------------
  let notice = await prisma.notice.findFirst({
    where: { restaurantId: fogon.id, title: "Cambio de horario este viernes" },
  });
  notice ??= await prisma.notice.create({
    data: {
      restaurantId: fogon.id,
      title: "Cambio de horario este viernes",
      body: "Este viernes atenderemos solo hasta las 15:00 por mantenimiento del local.",
      type: NoticeType.SCHEDULE_CHANGE,
    },
  });
  const notified = await prisma.notification.findFirst({
    where: { userId: maria.id, type: NotificationType.NOTICE },
  });
  if (!notified) {
    await prisma.notification.create({
      data: {
        userId: maria.id,
        type: NotificationType.NOTICE,
        payload: { noticeId: notice.id },
      },
    });
  }

  // --- Audit trail ---------------------------------------------------------
  const audited = await prisma.auditLog.findFirst({
    where: { action: "restaurant.approved", entityId: fogon.id },
  });
  if (!audited) {
    await prisma.auditLog.createMany({
      data: [
        {
          actorId: superAdmin.id,
          action: "restaurant.approved",
          entityType: "restaurant",
          entityId: fogon.id,
          metadata: { from: "PENDING", to: "APPROVED" },
        },
        {
          actorId: adminFogon.id,
          action: "pension.activated",
          entityType: "pension",
          entityId: pensionActive.id,
          metadata: { paymentId: payment.id },
        },
      ],
    });
  }

  const counts = {
    users: await prisma.user.count(),
    restaurants: await prisma.restaurant.count(),
    dishes: await prisma.dish.count(),
    dailyMenus: await prisma.dailyMenu.count(),
    pensions: await prisma.pension.count(),
    reservations: await prisma.reservation.count(),
  };
  console.log("Seed complete:", counts);
  console.log(`Demo login (all users): ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

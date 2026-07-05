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
    monthlyPensionPrice: PENSION_PRICE,
  };
  const existing = await prisma.restaurant.findFirst({ where: { slug, deletedAt: null } });
  if (existing) {
    return prisma.restaurant.update({ where: { id: existing.id }, data });
  }
  return prisma.restaurant.create({ data });
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

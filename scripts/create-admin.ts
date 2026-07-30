import "dotenv/config";
import bcrypt from "bcryptjs";
import prisma from "../src/lib/prisma";

async function main() {
  const hash = await bcrypt.hash("admin123", 10);
  const user = await prisma.user.upsert({
    where: { email: "admin@local.dev" },
    update: { role: "ADMIN" },
    create: {
      username: "admin",
      email: "admin@local.dev",
      password: hash,
      role: "ADMIN",
    },
  });
  console.log(`Admin ready: ${user.email} (role: ${user.role})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

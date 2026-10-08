import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { demoTasks, demoUser } from './seed-data'

const prisma = new PrismaClient()

async function main() {
  await prisma.user.deleteMany({ where: { email: demoUser.email } })

  const user = await prisma.user.create({
    data: {
      name: demoUser.name,
      email: demoUser.email,
      passwordHash: await bcrypt.hash(demoUser.password, 10),
      tasks: { create: demoTasks },
    },
  })

  console.log(`Seeded ${user.email} with ${demoTasks.length} tasks`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

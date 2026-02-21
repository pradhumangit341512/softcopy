// lib/test-db.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testConnection() {
  try {
    console.log('Testing MongoDB connection...');
    
    // Try to connect
    await prisma.$connect();
    console.log('✅ Connected to MongoDB successfully!');
    
    // Count users
    const userCount = await prisma.user.count();
    console.log(`✅ Database is working! User count: ${userCount}`);
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Connection failed:', error);
    process.exit(1);
  }
}

testConnection();
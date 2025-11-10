import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const migratePhoneToEmail = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    const db = mongoose.connection.db;
    const usersCollection = db.collection("users");

    // 1. Add email field to all users
    await usersCollection.updateMany(
      { email: { $exists: false } },
      {
        $set: {
          email: null, // Will need manual update
        },
      }
    );

    // 2. Make username required if displayName exists
    await usersCollection.updateMany(
      { username: { $exists: false }, displayName: { $exists: true } },
      [
        {
          $set: {
            username: {
              $concat: [
                { $toLower: "$displayName" },
                "_",
                { $toString: "$_id" },
              ],
            },
          },
        },
      ]
    );

    // 3. Remove phone field index
    await usersCollection.dropIndex("phone_1").catch(() => {
      console.log("Phone index already removed or doesn't exist");
    });

    // 4. Create new indexes
    await usersCollection.createIndex({ email: 1 }, { unique: true, sparse: true });
    await usersCollection.createIndex({ username: 1 }, { unique: true });

    console.log("✅ Migration completed successfully");
    console.log("⚠️  WARNING: You need to manually populate email addresses for existing users");

    await mongoose.disconnect();
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
};

migratePhoneToEmail();

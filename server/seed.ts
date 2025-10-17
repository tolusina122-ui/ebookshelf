import { storage } from "./storage";
import bcrypt from "bcrypt";

async function seed() {
  console.log("🌱 Seeding database...");

  // Create admin user
  try {
    const existingAdmin = await storage.getAdminByUsername("admin");
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash("admin123", 10);
      await storage.createAdmin({
        username: "admin",
        password: hashedPassword,
      });
      console.log("✅ Admin user created (username: admin, password: admin123)");
    } else {
      console.log("ℹ️  Admin user already exists");
    }
  } catch (error) {
    console.error("❌ Error creating admin:", error);
  }

  // Create sample books
  const sampleBooks = [
    {
      title: "The Art of Programming",
      description: "Master the fundamentals of software development with this comprehensive guide to programming principles and best practices.",
      price: "50",
      coverImage: "https://images.unsplash.com/photo-1532012197267-da84d127e765?w=400&h=600&fit=crop",
      downloadUrl: "https://example.com/downloads/art-of-programming.pdf",
      category: "Technology",
    },
    {
      title: "Digital Marketing Mastery",
      description: "Learn proven strategies to grow your business online with modern digital marketing techniques and tools.",
      price: "30",
      coverImage: "https://images.unsplash.com/photo-1533750349088-cd871a92f312?w=400&h=600&fit=crop",
      downloadUrl: "https://example.com/downloads/digital-marketing.pdf",
      category: "Business",
    },
    {
      title: "The Creative Mind",
      description: "Unlock your creative potential with exercises and insights from the world's most innovative thinkers.",
      price: "25",
      coverImage: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400&h=600&fit=crop",
      downloadUrl: "https://example.com/downloads/creative-mind.pdf",
      category: "Self-Help",
    },
    {
      title: "Financial Freedom",
      description: "A step-by-step guide to building wealth and achieving financial independence in the modern economy.",
      price: "100",
      coverImage: "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=400&h=600&fit=crop",
      downloadUrl: "https://example.com/downloads/financial-freedom.pdf",
      category: "Finance",
    },
    {
      title: "Healthy Living Guide",
      description: "Transform your life with practical advice on nutrition, fitness, and mental wellness.",
      price: "20",
      coverImage: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=400&h=600&fit=crop",
      downloadUrl: "https://example.com/downloads/healthy-living.pdf",
      category: "Health",
    },
    {
      title: "Advanced AI & Machine Learning",
      description: "Deep dive into artificial intelligence and machine learning algorithms with hands-on projects.",
      price: "150",
      coverImage: "https://images.unsplash.com/photo-1555255707-c07966088b7b?w=400&h=600&fit=crop",
      downloadUrl: "https://example.com/downloads/ai-ml.pdf",
      category: "Technology",
    },
    {
      title: "Leadership Principles",
      description: "Essential leadership skills and strategies for managing teams and driving organizational success.",
      price: "75",
      coverImage: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=400&h=600&fit=crop",
      downloadUrl: "https://example.com/downloads/leadership.pdf",
      category: "Business",
    },
    {
      title: "Photography Basics",
      description: "Learn the fundamentals of photography, from camera settings to composition and lighting.",
      price: "35",
      coverImage: "https://images.unsplash.com/photo-1452587925148-ce544e77e70d?w=400&h=600&fit=crop",
      downloadUrl: "https://example.com/downloads/photography.pdf",
      category: "Arts",
    },
  ];

  try {
    const existingBooks = await storage.getBooks();
    if (existingBooks.length === 0) {
      for (const book of sampleBooks) {
        await storage.createBook(book);
      }
      console.log(`✅ Created ${sampleBooks.length} sample books`);
    } else {
      console.log("ℹ️  Books already exist");
    }
  } catch (error) {
    console.error("❌ Error creating books:", error);
  }

  console.log("✨ Seeding complete!");
  process.exit(0);
}

seed();

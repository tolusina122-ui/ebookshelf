import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const JWT_SECRET = process.env.SESSION_SECRET || "your-secret-key-change-in-production";

// Middleware to verify admin token
function verifyAdmin(req: any, res: any, next: any) {
  const token = req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Public Routes

  // Get all books
  app.get("/api/books", async (req, res) => {
    try {
      const books = await storage.getBooks();
      res.json(books);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create order and process payment
  app.post("/api/orders", async (req, res) => {
    try {
      const { customerEmail, paymentMethod, sessionId, items: orderItemsData } = req.body;

      if (!customerEmail || !paymentMethod || !orderItemsData?.length) {
        return res.status(400).send("Missing required fields");
      }

      // Calculate total
      const total = orderItemsData.reduce((sum: number, item: any) => {
        return sum + (parseFloat(item.price) * item.quantity);
      }, 0);

      // Process payment with session
      const paymentResult = await processPayment({
        amount: total,
        currency: "USD",
        paymentMethod,
        customerEmail,
        sessionId,
      });

      if (!paymentResult.success) {
        return res.status(400).json({
          error: "Payment failed",
          message: paymentResult.error || paymentResult.message || "Payment processing failed. Please try again.",
        });
      }

      // Create order
      const order = await storage.createOrder({
        customerEmail,
        totalAmount: total.toFixed(2),
        status: "completed",
      });

      // Create order items
      for (const item of orderItemsData) {
        await storage.createOrderItem({
          orderId: order.id,
          bookId: item.bookId,
          quantity: parseInt(item.quantity),
          price: item.price, // Store the price at the time of order
        });
      }

      // Create transaction record
      const transaction = await storage.createTransaction({
        orderId: order.id,
        amount: total.toFixed(2),
        paymentMethod: paymentMethod,
        status: "completed",
        paymentIntentId: (paymentResult as any).paymentIntentId || null,
      });

      // Create wallet transaction for received payment
      await storage.createWalletTransaction({
        type: "payment_received",
        amount: total.toFixed(2),
        status: "completed",
        description: `Payment for order ${order.id}`,
      });

      res.json({ order, transaction });
    } catch (error: any) {
      console.error("Order processing error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create payment session
  app.post("/api/payment/create-session", async (req, res) => {
    try {
      const { items, customerEmail, paymentMethod, amount, currency } = req.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, message: "No items provided for payment session" });
      }

      if (!customerEmail || !paymentMethod) {
        return res.status(400).json({ success: false, message: "Customer email and payment method are required" });
      }

      // Validate items and calculate total
      let calculatedTotal = 0;
      const validatedItems = [];

      for (const item of items) {
        const book = await storage.getBook(item.bookId);
        if (!book) {
          return res.status(400).json({ success: false, message: `Book ${item.bookId} not found` });
        }
        if (parseFloat(book.price) !== parseFloat(item.price)) {
          return res.status(400).json({ success: false, message: `Price mismatch for book ${book.title}` });
        }

        validatedItems.push({
          bookId: item.bookId,
          quantity: parseInt(item.quantity),
          price: book.price,
        });
        calculatedTotal += parseFloat(book.price) * parseInt(item.quantity);
      }

      // Verify amount matches
      if (Math.abs(calculatedTotal - amount) > 0.01) {
        return res.status(400).json({ success: false, message: "Amount mismatch" });
      }

      const sessionId = crypto.randomBytes(16).toString("hex");

      res.json({ 
        success: true, 
        sessionId, 
        totalAmount: calculatedTotal.toFixed(2) 
      });
    } catch (error: any) {
      console.error("Payment session creation error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Mastercard hosted checkout: create session and return checkout URL
  app.post("/api/payment/mastercard/create-session", async (req, res) => {
    try {
      const { items, customerEmail, amount, currency } = req.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, message: "No items provided for payment session" });
      }

      if (!customerEmail) {
        return res.status(400).json({ success: false, message: "Customer email required" });
      }

      // Validate items and calculate total
      let calculatedTotal = 0;
      const validatedItems: any[] = [];
      for (const item of items) {
        const book = await storage.getBook(item.bookId);
        if (!book) return res.status(400).json({ success: false, message: `Book ${item.bookId} not found` });
        if (parseFloat(book.price) !== parseFloat(item.price)) return res.status(400).json({ success: false, message: `Price mismatch for book ${book.title}` });
        validatedItems.push({ bookId: item.bookId, quantity: parseInt(item.quantity), price: book.price });
        calculatedTotal += parseFloat(book.price) * parseInt(item.quantity);
      }

      if (Math.abs(calculatedTotal - amount) > 0.01) {
        return res.status(400).json({ success: false, message: "Amount mismatch" });
      }

      // create a pending order and transaction to track the session
      const order = await storage.createOrder({
        customerEmail,
        totalAmount: calculatedTotal.toFixed(2),
        status: "pending",
      });

      for (const it of validatedItems) {
        await storage.createOrderItem({ orderId: order.id, bookId: it.bookId, quantity: it.quantity, price: it.price });
      }

      const sessionId = crypto.randomBytes(16).toString("hex");

      const transaction = await storage.createTransaction({
        orderId: order.id,
        amount: calculatedTotal.toFixed(2),
        paymentMethod: "mastercard",
        status: "pending",
        paymentIntentId: sessionId,
      });

      // determine allowed origin
      const allowedRaw = process.env.MASTERCARD_ALLOWED_ORIGINS || process.env.MASTERCARD_ALLOWED_ORIGIN || "https://animated-fortnight-97gwr446rvq927r47-5000.app.github.dev/checkout";
      const allowed = allowedRaw.split(",").map(s => s.trim()).filter(Boolean)[0];
      const checkoutUrl = `${allowed}?sessionId=${sessionId}`;

      res.json({ success: true, sessionId, checkoutUrl });
    } catch (error: any) {
      console.error("Mastercard create-session error:", error);
      res.status(500).json({ success: false, message: error.message || "Could not create session" });
    }
  });

  // Mastercard checkout complete: called by the client after checkout (or webhook)
  app.post("/api/payment/mastercard/complete", async (req, res) => {
    try {
      const { sessionId, success } = req.body;
      if (!sessionId) return res.status(400).json({ success: false, message: "sessionId required" });

      const transactions = await storage.getTransactions();
      const tx = transactions.find(t => t.paymentIntentId === sessionId);
      if (!tx) return res.status(404).json({ success: false, message: "Transaction not found" });

      if (success) {
        // mark transaction and order as completed
        await storage.updateTransactionStatus(tx.id, "completed");
        await storage.updateOrderStatus(tx.orderId, "completed");

        // create wallet transaction
        await storage.createWalletTransaction({ type: "payment_received", amount: tx.amount, status: "completed", description: `Payment for order ${tx.orderId}` });

        return res.json({ success: true, message: "Payment completed" });
      }

      // mark failed
      await storage.updateTransactionStatus(tx.id, "failed");
      await storage.updateOrderStatus(tx.orderId, "pending");
      return res.json({ success: false, message: "Payment failed" });
    } catch (error: any) {
      console.error("Mastercard complete error:", error);
      res.status(500).json({ success: false, message: error.message || "Could not complete session" });
    }
  });

  // Payment processing function with real Visa/Mastercard integration
  async function processPayment(paymentRequest: { amount: number; currency: string; paymentMethod: string; customerEmail: string; sessionId?: string }) {
    try {
      const { processVisaPayment, processMastercardPayment, processDigitalWalletPayment } = await import("./payment-service");

      const commonPaymentDetails = {
        amount: paymentRequest.amount,
        currency: paymentRequest.currency,
        email: paymentRequest.customerEmail,
        paymentMethod: paymentRequest.paymentMethod,
        orderId: paymentRequest.sessionId, // Use sessionId as orderId for payment processing
      };

      // Route to appropriate payment processor
      if (paymentRequest.paymentMethod === "visa") {
        const result = await processVisaPayment(commonPaymentDetails as any);
        return {
          success: result.success,
          paymentIntentId: result.transactionId,
          error: result.error,
          message: result.message,
        };
      } else if (paymentRequest.paymentMethod === "mastercard") {
        const result = await processMastercardPayment(commonPaymentDetails as any);
        return {
          success: result.success,
          paymentIntentId: result.transactionId,
          error: result.error,
          message: result.message,
        };
      } else if (paymentRequest.paymentMethod === "google_pay" || paymentRequest.paymentMethod === "apple_pay") {
        const result = await processDigitalWalletPayment(commonPaymentDetails as any);
        return {
          success: result.success,
          paymentIntentId: result.transactionId,
          error: result.error,
          message: result.message,
        };
      } else if (paymentRequest.paymentMethod === "prepaid") {
        // Prepaid cards also go through CyberSource
        const result = await processVisaPayment(commonPaymentDetails as any);
        return {
          success: result.success,
          paymentIntentId: result.transactionId,
          error: result.error,
          message: result.message,
        };
      }

      return {
        success: false,
        error: "Invalid payment method",
        message: "The selected payment method is not supported.",
      };
    } catch (error: any) {
      console.error("Payment processing error:", error);
      return {
        success: false,
        error: error.message || "Payment processing failed",
        message: "An error occurred while processing your payment. Please try again.",
      };
    }
  }

  // Server-side Visa charge (accepts card details) - admin or client can call with card info
  app.post('/api/payment/visa/charge', async (req, res) => {
    try {
      const { card, amount, currency, customerEmail } = req.body;
      if (!card || !card.number || !card.expiryMonth || !card.expiryYear) return res.status(400).json({ success: false, message: 'card details required' });
      if (!amount || !customerEmail) return res.status(400).json({ success: false, message: 'amount and customerEmail required' });

      // create pending order and transaction
      const order = await storage.createOrder({ customerEmail, totalAmount: parseFloat(amount).toFixed(2), status: 'pending' });
      const tx = await storage.createTransaction({ orderId: order.id, amount: parseFloat(amount).toFixed(2), paymentMethod: 'visa', status: 'pending' });

      const { processVisaPayment } = await import('./payment-service');

      const paymentResult = await processVisaPayment({ amount: parseFloat(amount), email: customerEmail, paymentMethod: 'visa', orderId: order.id, card });

      if (!paymentResult.success) {
        await storage.updateTransactionStatus(tx.id, 'failed');
        await storage.updateOrderStatus(order.id, 'pending');
        return res.status(400).json({ success: false, error: paymentResult.error });
      }

      // success
      await storage.updateTransactionStatus(tx.id, 'completed');
      await storage.updateOrderStatus(order.id, 'completed');
      await storage.createWalletTransaction({ type: 'payment_received', amount: parseFloat(amount).toFixed(2), status: 'completed', description: `Visa payment for order ${order.id}` });

      res.json({ success: true, transactionId: paymentResult.transactionId, orderId: order.id });
    } catch (err: any) {
      console.error('Visa charge error', err);
      res.status(500).json({ success: false, message: err.message || 'Visa charge failed' });
    }
  });

  // Admin Routes

  // Admin login
  app.post("/api/admin/login", async (req, res) => {
    try {
      const { username, password } = req.body;

      // Validate input
      if (!username || typeof username !== "string" || username.trim().length === 0) {
        return res.status(400).json({ message: "Username is required" });
      }

      if (!password || typeof password !== "string" || password.length === 0) {
        return res.status(400).json({ message: "Password is required" });
      }

      const admin = await storage.getAdminByUsername(username.trim());

      if (!admin) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const validPassword = await bcrypt.compare(password, admin.password);

      if (!validPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const token = jwt.sign({ id: admin.id, username: admin.username }, JWT_SECRET, {
        expiresIn: "7d",
      });

      res.json({ token, admin: { id: admin.id, username: admin.username } });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create initial admin (for setup)
  app.post("/api/admin/setup", async (req, res) => {
    try {
      const { username, password } = req.body;

      // Validate input
      if (!username || typeof username !== "string" || username.trim().length === 0) {
        return res.status(400).json({ message: "Username is required and must be a string" });
      }

      if (!password || typeof password !== "string" || password.length < 6) {
        return res.status(400).json({ message: "Password is required and must be at least 6 characters" });
      }

      const existingAdmin = await storage.getAdminByUsername(username.trim());
      if (existingAdmin) {
        return res.status(400).json({ message: "Admin already exists" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const admin = await storage.createAdmin({
        username: username.trim(),
        password: hashedPassword,
      });

      res.json({ message: "Admin created successfully", admin: { id: admin.id, username: admin.username } });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Dashboard stats
  app.get("/api/admin/dashboard-stats", verifyAdmin, async (req, res) => {
    try {
      const allTransactions = await storage.getTransactions();
      const completedTransactions = allTransactions.filter(t => t.status === "completed");

      const totalRevenue = completedTransactions.reduce(
        (sum, t) => sum + parseFloat(t.amount),
        0
      );

      const orders = await storage.getOrders();
      const books = await storage.getBooks();

      const averageOrderValue = orders.length > 0 ? totalRevenue / orders.length : 0;

      const recentTransactions = await Promise.all(
        allTransactions.slice(0, 5).map(async (t) => {
          const order = await storage.getOrder(t.orderId);
          return {
            id: t.id,
            amount: t.amount,
            customerEmail: order?.customerEmail || "Unknown",
            createdAt: t.createdAt,
          };
        })
      );


      res.json({
        totalRevenue,
        totalOrders: orders.length,
        totalBooks: books.length,
        averageOrderValue,
        recentTransactions,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // DB status (admin only)
  app.get("/api/admin/db-status", verifyAdmin, async (_req, res) => {
    try {
      // best-effort: call storage methods to infer whether DB is connected or in-memory
      const books = await storage.getBooks();
      const adminsList = await storage.getAdminByUsername ? await (async () => {
        // storage.getAdminByUsername exists always, but call to get an existing admin by username
        const admin = await storage.getAdminByUsername("admin");
        return admin ? [admin] : [];
      })() : [];

      res.json({
        connected: true,
        counts: {
          books: books.length,
          admins: adminsList.length,
        },
      });
    } catch (err: any) {
      res.json({ connected: false, error: err.message });
    }
  });

  // Backup status (admin only)
  app.get("/api/admin/backup-status", verifyAdmin, async (_req, res) => {
    try {
      // storage may be MirroredStorage
      const anyStorage: any = storage as any;
      if (anyStorage && typeof anyStorage.backupStatus === 'function') {
        // include queued tasks from backupQueue if available
        let tasks: any[] = [];
        try {
          // require here to avoid circular imports in modules that don't need the queue
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const queue = require('./backupQueue').default;
          if (queue && typeof queue.list === 'function') tasks = queue.list(50);
        } catch (e) {}

        return res.json({ enabled: true, status: anyStorage.backupStatus(), queue: tasks });
      }
      res.json({ enabled: false, message: 'No backup configured' });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Book management
  app.post("/api/admin/books", verifyAdmin, async (req, res) => {
    try {
      const { title, description, price, coverImage, downloadUrl, category } = req.body;

      // Validate required fields
      if (!title || !description || !price || !coverImage || !downloadUrl || !category) {
        return res.status(400).json({ message: "All fields are required" });
      }

      // Validate URLs
      try {
        new URL(coverImage);
        new URL(downloadUrl);
      } catch {
        return res.status(400).json({ message: "Invalid URL format for coverImage or downloadUrl" });
      }

      // Validate price
      const priceNum = parseFloat(price);
      if (isNaN(priceNum) || priceNum <= 0) {
        return res.status(400).json({ message: "Price must be a positive number" });
      }

      const book = await storage.createBook({
        title,
        description,
        price: priceNum.toFixed(2),
        coverImage,
        downloadUrl,
        category,
      });
      res.json(book);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/admin/books/:id", verifyAdmin, async (req, res) => {
    try {
      const { title, description, price, coverImage, downloadUrl, category } = req.body;

      // Validate URLs if provided
      if (coverImage) {
        try {
          new URL(coverImage);
        } catch {
          return res.status(400).json({ message: "Invalid coverImage URL" });
        }
      }

      if (downloadUrl) {
        try {
          new URL(downloadUrl);
        } catch {
          return res.status(400).json({ message: "Invalid downloadUrl URL" });
        }
      }

      // Validate price if provided
      if (price !== undefined) {
        const priceNum = parseFloat(price);
        if (isNaN(priceNum) || priceNum <= 0) {
          return res.status(400).json({ message: "Price must be a positive number" });
        }
      }

      const book = await storage.updateBook(req.params.id, req.body);
      if (!book) {
        return res.status(404).json({ message: "Book not found" });
      }
      res.json(book);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/admin/books/:id", verifyAdmin, async (req, res) => {
    try {
      await storage.deleteBook(req.params.id);
      res.json({ message: "Book deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Transaction management
  app.get("/api/admin/transactions", verifyAdmin, async (req, res) => {
    try {
      const transactions = await storage.getTransactions();
      const transactionsWithOrders = await Promise.all(
        transactions.map(async (t) => {
          const order = await storage.getOrder(t.orderId);
          return {
            ...t,
            order: {
              id: order?.id || "",
              customerEmail: order?.customerEmail || "Unknown",
              status: order?.status || "unknown",
            },
          };
        })
      );
      res.json(transactionsWithOrders);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Refund transaction
  app.post("/api/admin/transactions/:id/refund", verifyAdmin, async (req, res) => {
    try {
      const transaction = await storage.getTransaction(req.params.id);

      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }

      if (transaction.status === "refunded") {
        return res.status(400).json({ message: "Transaction already refunded" });
      }

      // Update transaction status
      await storage.updateTransactionStatus(req.params.id, "refunded");

      // Update order status
      await storage.updateOrderStatus(transaction.orderId, "refunded");

      // Create wallet transaction for refund
      await storage.createWalletTransaction({
        type: "refund_issued",
        amount: transaction.amount,
        status: "completed",
        description: `Refund for transaction ${transaction.id}`,
      });

      res.json({ message: "Refund processed successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Wallet
  app.get("/api/admin/wallet", verifyAdmin, async (req, res) => {
    try {
      const balance = await storage.getWalletBalance();
      const transactions = await storage.getWalletTransactions();

      res.json({
        ...balance,
        transactions,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Transfer to bank
  app.post("/api/admin/wallet/transfer", verifyAdmin, async (req, res) => {
    try {
      const { amount, bankAccountInfo } = req.body;

      // Validate input
      if (!amount || !bankAccountInfo) {
        return res.status(400).json({ message: "Amount and bank account info are required" });
      }

      const transferAmount = parseFloat(amount);
      if (isNaN(transferAmount) || transferAmount <= 0) {
        return res.status(400).json({ message: "Amount must be a positive number" });
      }

      const balance = await storage.getWalletBalance();

      if (transferAmount > balance.availableBalance) {
        return res.status(400).json({
          message: `Insufficient balance. Available: $${balance.availableBalance.toFixed(2)}, Requested: $${transferAmount.toFixed(2)}`,
        });
      }

      const transaction = await storage.createWalletTransaction({
        type: "transfer_to_bank",
        amount: transferAmount.toFixed(2),
        status: "completed",
        bankAccountInfo,
        description: `Transfer to bank account: ${bankAccountInfo}`,
      });

      res.json(transaction);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
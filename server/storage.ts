import {
  books,
  orders,
  orderItems,
  transactions,
  admins,
  walletTransactions,
  type Book,
  type InsertBook,
  type Order,
  type InsertOrder,
  type OrderItem,
  type InsertOrderItem,
  type Transaction,
  type InsertTransaction,
  type Admin,
  type InsertAdmin,
  type WalletTransaction,
  type InsertWalletTransaction,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql } from "drizzle-orm";

export interface IStorage {
  // Books
  getBooks(): Promise<Book[]>;
  getBook(id: string): Promise<Book | undefined>;
  createBook(book: InsertBook): Promise<Book>;
  updateBook(id: string, book: Partial<InsertBook>): Promise<Book | undefined>;
  deleteBook(id: string): Promise<void>;

  // Orders
  getOrders(): Promise<Order[]>;
  getOrder(id: string): Promise<Order | undefined>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrderStatus(id: string, status: "pending" | "completed" | "refunded"): Promise<void>;

  // Order Items
  createOrderItem(item: InsertOrderItem): Promise<OrderItem>;
  getOrderItems(orderId: string): Promise<OrderItem[]>;

  // Transactions
  getTransactions(): Promise<Transaction[]>;
  getTransaction(id: string): Promise<Transaction | undefined>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  updateTransactionStatus(id: string, status: "pending" | "completed" | "failed" | "refunded"): Promise<void>;

  // Admin
  getAdminByUsername(username: string): Promise<Admin | undefined>;
  createAdmin(admin: InsertAdmin): Promise<Admin>;

  // Wallet Transactions
  getWalletTransactions(): Promise<WalletTransaction[]>;
  createWalletTransaction(transaction: InsertWalletTransaction): Promise<WalletTransaction>;
  getWalletBalance(): Promise<{ availableBalance: number; pendingBalance: number }>;
}

export class DatabaseStorage implements IStorage {
  // Books
  async getBooks(): Promise<Book[]> {
    return db.select().from(books).orderBy(desc(books.createdAt));
  }

  async getBook(id: string): Promise<Book | undefined> {
    const [book] = await db.select().from(books).where(eq(books.id, id));
    return book || undefined;
  }

  async createBook(insertBook: InsertBook): Promise<Book> {
    const [book] = await db.insert(books).values(insertBook).returning();
    return book;
  }

  async updateBook(id: string, updateData: Partial<InsertBook>): Promise<Book | undefined> {
    const [book] = await db
      .update(books)
      .set(updateData)
      .where(eq(books.id, id))
      .returning();
    return book || undefined;
  }

  async deleteBook(id: string): Promise<void> {
    await db.delete(books).where(eq(books.id, id));
  }

  // Orders
  async getOrders(): Promise<Order[]> {
    return db.select().from(orders).orderBy(desc(orders.createdAt));
  }

  async getOrder(id: string): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    return order || undefined;
  }

  async createOrder(insertOrder: InsertOrder): Promise<Order> {
    const [order] = await db.insert(orders).values(insertOrder).returning();
    return order;
  }

  async updateOrderStatus(id: string, status: "pending" | "completed" | "refunded"): Promise<void> {
    await db.update(orders).set({ status }).where(eq(orders.id, id));
  }

  // Order Items
  async createOrderItem(insertItem: InsertOrderItem): Promise<OrderItem> {
    const [item] = await db.insert(orderItems).values(insertItem).returning();
    return item;
  }

  async getOrderItems(orderId: string): Promise<OrderItem[]> {
    return db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  }

  // Transactions
  async getTransactions(): Promise<Transaction[]> {
    return db.select().from(transactions).orderBy(desc(transactions.createdAt));
  }

  async getTransaction(id: string): Promise<Transaction | undefined> {
    const [transaction] = await db.select().from(transactions).where(eq(transactions.id, id));
    return transaction || undefined;
  }

  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    const [transaction] = await db.insert(transactions).values(insertTransaction).returning();
    return transaction;
  }

  async updateTransactionStatus(
    id: string,
    status: "pending" | "completed" | "failed" | "refunded"
  ): Promise<void> {
    await db.update(transactions).set({ status }).where(eq(transactions.id, id));
  }

  // Admin
  async getAdminByUsername(username: string): Promise<Admin | undefined> {
    const [admin] = await db.select().from(admins).where(eq(admins.username, username));
    return admin || undefined;
  }

  async createAdmin(insertAdmin: InsertAdmin): Promise<Admin> {
    const [admin] = await db.insert(admins).values(insertAdmin).returning();
    return admin;
  }

  // Wallet Transactions
  async getWalletTransactions(): Promise<WalletTransaction[]> {
    return db.select().from(walletTransactions).orderBy(desc(walletTransactions.createdAt));
  }

  async createWalletTransaction(
    insertTransaction: InsertWalletTransaction
  ): Promise<WalletTransaction> {
    const [transaction] = await db.insert(walletTransactions).values(insertTransaction).returning();
    return transaction;
  }

  async getWalletBalance(): Promise<{ availableBalance: number; pendingBalance: number }> {
    const walletTxs = await this.getWalletTransactions();
    
    let availableBalance = 0;
    let pendingBalance = 0;

    for (const tx of walletTxs) {
      const amount = parseFloat(tx.amount);
      
      if (tx.status === "completed") {
        if (tx.type === "payment_received") {
          availableBalance += amount;
        } else if (tx.type === "transfer_to_bank" || tx.type === "refund_issued") {
          availableBalance -= amount;
        }
      } else if (tx.status === "pending") {
        if (tx.type === "payment_received") {
          pendingBalance += amount;
        }
      }
    }

    return { availableBalance, pendingBalance };
  }
}

export const storage = new DatabaseStorage();

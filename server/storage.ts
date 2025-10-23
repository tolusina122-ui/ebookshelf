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
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
let BetterSqlite3: any;
try {
  BetterSqlite3 = require("better-sqlite3");
} catch (e) {
  BetterSqlite3 = null;
}
// runtime-safe import for pg Client (named exports can be tricky under ESM interop)
let PgClient: any;
try {
  // prefer require for compatibility in this environment
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pkg = require('pg');
  PgClient = pkg.Client || pkg.default?.Client || pkg.default || pkg;
} catch (e) {
  PgClient = null;
}

import backupQueue from './backupQueue';

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

// In-memory fallback storage used when DATABASE_URL is not provided (development)
class InMemoryStorage implements IStorage {
  private _books: any[] = [];
  private _orders: any[] = [];
  private _orderItems: any[] = [];
  private _transactions: any[] = [];
  private _admins: any[] = [];
  private _walletTransactions: any[] = [];

  constructor() {}

  // Books
  async getBooks(): Promise<any[]> {
    return this._books.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getBook(id: string) {
    return this._books.find((b) => b.id === id);
  }

  async createBook(insertBook: any) {
    const book = {
      id: randomUUID(),
      ...insertBook,
      price: parseFloat(insertBook.price).toFixed(2),
      createdAt: new Date().toISOString(),
    };
    this._books.push(book);
    return book;
  }

  async updateBook(id: string, updateData: any) {
    const book = await this.getBook(id);
    if (!book) return undefined;
    Object.assign(book, updateData);
    return book;
  }

  async deleteBook(id: string) {
    this._books = this._books.filter((b) => b.id !== id);
  }

  // Orders
  async getOrders() {
    return this._orders.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getOrder(id: string) {
    return this._orders.find((o) => o.id === id);
  }

  async createOrder(insertOrder: any) {
    const order = { id: randomUUID(), ...insertOrder, createdAt: new Date().toISOString() };
    this._orders.push(order);
    return order;
  }

  async updateOrderStatus(id: string, status: "pending" | "completed" | "refunded") {
    const order = await this.getOrder(id);
    if (order) order.status = status;
  }

  // Order Items
  async createOrderItem(insertItem: any) {
    const item = { id: randomUUID(), ...insertItem };
    this._orderItems.push(item);
    return item;
  }

  async getOrderItems(orderId: string) {
    return this._orderItems.filter((i) => i.orderId === orderId);
  }

  // Transactions
  async getTransactions() {
    return this._transactions.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getTransaction(id: string) {
    return this._transactions.find((t) => t.id === id);
  }

  async createTransaction(insertTransaction: any) {
    const tx = { id: randomUUID(), ...insertTransaction, createdAt: new Date().toISOString() };
    this._transactions.push(tx);
    return tx;
  }

  async updateTransactionStatus(id: string, status: string) {
    const tx = await this.getTransaction(id);
    if (tx) tx.status = status;
  }

  // Admin
  async getAdminByUsername(username: string) {
    return this._admins.find((a) => a.username === username);
  }

  async createAdmin(insertAdmin: any) {
    const admin = { id: randomUUID(), ...insertAdmin, createdAt: new Date().toISOString() };
    this._admins.push(admin);
    return admin;
  }

  // Wallet Transactions
  async getWalletTransactions() {
    return this._walletTransactions.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async createWalletTransaction(insertTransaction: any) {
    const tx = { id: randomUUID(), ...insertTransaction, createdAt: new Date().toISOString() };
    this._walletTransactions.push(tx);
    return tx;
  }

  async getWalletBalance() {
    let availableBalance = 0;
    let pendingBalance = 0;
    for (const tx of this._walletTransactions) {
      const amount = parseFloat(tx.amount);
      if (tx.status === "completed") {
        if (tx.type === "payment_received") availableBalance += amount;
        else if (tx.type === "transfer_to_bank" || tx.type === "refund_issued") availableBalance -= amount;
      } else if (tx.status === "pending") {
        if (tx.type === "payment_received") pendingBalance += amount;
      }
    }
    return { availableBalance, pendingBalance };
  }

  // Dev helper to seed sample data
  async seedSampleData() {
    // create admin
    if (!this._admins.find(a => a.username === 'admin')) {
      const hashed = await bcrypt.hash('admin123', 10);
      await this.createAdmin({ username: 'admin', password: hashed });
    }

    if (this._books.length === 0) {
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
      ];

      for (const b of sampleBooks) {
        await this.createBook(b);
      }
    }
  }
}

// Sqlite-based persistent storage for local development
class SqliteStorage implements IStorage {
  private db: any;
  constructor(dbPath: string) {
    if (!BetterSqlite3) throw new Error("better-sqlite3 is not installed");
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new BetterSqlite3(dbPath);
    this._migrate();
  }

  _migrate() {
    // Simple tables sufficient for the app's needs (admins, books, orders, order_items, transactions, wallet_transactions)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS admins (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS books (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        price TEXT NOT NULL,
        cover_image TEXT NOT NULL,
        download_url TEXT NOT NULL,
        category TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        customer_email TEXT NOT NULL,
        total_amount TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS order_items (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        book_id TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        price TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        amount TEXT NOT NULL,
        payment_method TEXT NOT NULL,
        status TEXT NOT NULL,
        payment_intent_id TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS wallet_transactions (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        amount TEXT NOT NULL,
        status TEXT NOT NULL,
        bank_account_info TEXT,
        description TEXT,
        created_at TEXT NOT NULL
      );
    `);
  }

  // Books
  async getBooks() {
    const rows = this.db.prepare(`SELECT * FROM books ORDER BY created_at DESC`).all();
    return rows;
  }

  async getBook(id: string) {
    return this.db.prepare(`SELECT * FROM books WHERE id = ?`).get(id);
  }

  async createBook(insertBook: any) {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    this.db.prepare(`INSERT INTO books (id,title,description,price,cover_image,download_url,category,created_at) VALUES (?,?,?,?,?,?,?,?)`).run(
      id,
      insertBook.title,
      insertBook.description,
      parseFloat(insertBook.price).toFixed(2),
      insertBook.coverImage,
      insertBook.downloadUrl,
      insertBook.category,
      createdAt,
    );
    return this.getBook(id);
  }

  async updateBook(id: string, updateData: any) {
    const book = await this.getBook(id);
    if (!book) return undefined;
    const updated = { ...book, ...updateData };
    this.db.prepare(`UPDATE books SET title=?,description=?,price=?,cover_image=?,download_url=?,category=? WHERE id=?`).run(
      updated.title,
      updated.description,
      parseFloat(updated.price).toFixed(2),
      updated.coverImage,
      updated.downloadUrl,
      updated.category,
      id,
    );
    return this.getBook(id);
  }

  async deleteBook(id: string) {
    this.db.prepare(`DELETE FROM books WHERE id = ?`).run(id);
  }

  // Orders
  async getOrders() {
    return this.db.prepare(`SELECT * FROM orders ORDER BY created_at DESC`).all();
  }

  async getOrder(id: string) {
    return this.db.prepare(`SELECT * FROM orders WHERE id = ?`).get(id);
  }

  async createOrder(insertOrder: any) {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    this.db.prepare(`INSERT INTO orders (id,customer_email,total_amount,status,created_at) VALUES (?,?,?,?,?)`).run(
      id,
      insertOrder.customerEmail,
      insertOrder.totalAmount,
      insertOrder.status || 'pending',
      createdAt,
    );
    return this.getOrder(id);
  }

  async updateOrderStatus(id: string, status: "pending" | "completed" | "refunded") {
    this.db.prepare(`UPDATE orders SET status = ? WHERE id = ?`).run(status, id);
  }

  // Order Items
  async createOrderItem(insertItem: any) {
    const id = randomUUID();
    this.db.prepare(`INSERT INTO order_items (id,order_id,book_id,quantity,price) VALUES (?,?,?,?,?)`).run(
      id,
      insertItem.orderId,
      insertItem.bookId,
      insertItem.quantity,
      parseFloat(insertItem.price).toFixed(2),
    );
    return this.db.prepare(`SELECT * FROM order_items WHERE id = ?`).get(id);
  }

  async getOrderItems(orderId: string) {
    return this.db.prepare(`SELECT * FROM order_items WHERE order_id = ?`).all(orderId);
  }

  // Transactions
  async getTransactions() {
    return this.db.prepare(`SELECT * FROM transactions ORDER BY created_at DESC`).all();
  }

  async getTransaction(id: string) {
    return this.db.prepare(`SELECT * FROM transactions WHERE id = ?`).get(id);
  }

  async createTransaction(insertTransaction: any) {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    this.db.prepare(`INSERT INTO transactions (id,order_id,amount,payment_method,status,payment_intent_id,created_at) VALUES (?,?,?,?,?,?,?)`).run(
      id,
      insertTransaction.orderId,
      parseFloat(insertTransaction.amount).toFixed(2),
      insertTransaction.paymentMethod,
      insertTransaction.status || 'pending',
      insertTransaction.paymentIntentId || null,
      createdAt,
    );
    return this.getTransaction(id);
  }

  async updateTransactionStatus(id: string, status: string) {
    this.db.prepare(`UPDATE transactions SET status = ? WHERE id = ?`).run(status, id);
  }

  // Admin
  async getAdminByUsername(username: string) {
    return this.db.prepare(`SELECT * FROM admins WHERE username = ?`).get(username);
  }

  async createAdmin(insertAdmin: any) {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    this.db.prepare(`INSERT INTO admins (id,username,password,created_at) VALUES (?,?,?,?)`).run(
      id,
      insertAdmin.username,
      insertAdmin.password,
      createdAt,
    );
    return this.getAdminByUsername(insertAdmin.username);
  }

  // Wallet Transactions
  async getWalletTransactions() {
    return this.db.prepare(`SELECT * FROM wallet_transactions ORDER BY created_at DESC`).all();
  }

  async createWalletTransaction(insertTransaction: any) {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    this.db.prepare(`INSERT INTO wallet_transactions (id,type,amount,status,bank_account_info,description,created_at) VALUES (?,?,?,?,?,?,?)`).run(
      id,
      insertTransaction.type,
      parseFloat(insertTransaction.amount).toFixed(2),
      insertTransaction.status || 'pending',
      insertTransaction.bankAccountInfo || null,
      insertTransaction.description || null,
      createdAt,
    );
    return this.db.prepare(`SELECT * FROM wallet_transactions WHERE id = ?`).get(id);
  }

  async getWalletBalance() {
    const rows = this.getWalletTransactions();
    let availableBalance = 0;
    let pendingBalance = 0;
    for (const tx of await rows) {
      const amount = parseFloat(tx.amount);
      if (tx.status === 'completed') {
        if (tx.type === 'payment_received') availableBalance += amount;
        else if (tx.type === 'transfer_to_bank' || tx.type === 'refund_issued') availableBalance -= amount;
      } else if (tx.status === 'pending') {
        if (tx.type === 'payment_received') pendingBalance += amount;
      }
    }
    return { availableBalance, pendingBalance };
  }

  // Seed sample data
  async seedSampleData() {
    const admin = await this.getAdminByUsername('admin');
    if (!admin) {
      const hashed = await bcrypt.hash('admin123', 10);
      await this.createAdmin({ username: 'admin', password: hashed });
    }

    const books = await this.getBooks();
    if (books.length === 0) {
      await this.createBook({
        title: 'The Art of Programming',
        description: 'Master the fundamentals of software development with this comprehensive guide to programming principles and best practices.',
        price: '50',
        coverImage: 'https://images.unsplash.com/photo-1532012197267-da84d127e765?w=400&h=600&fit=crop',
        downloadUrl: 'https://example.com/downloads/art-of-programming.pdf',
        category: 'Technology'
      });

      await this.createBook({
        title: 'Digital Marketing Mastery',
        description: 'Learn proven strategies to grow your business online with modern digital marketing techniques and tools.',
        price: '30',
        coverImage: 'https://images.unsplash.com/photo-1533750349088-cd871a92f312?w=400&h=600&fit=crop',
        downloadUrl: 'https://example.com/downloads/digital-marketing.pdf',
        category: 'Business'
      });
    }
  }
}

// Decide which storage to export based on DATABASE_URL
const createBackupClients = () => {
  const urlsRaw = process.env.BACKUP_DATABASE_URLS || process.env.BACKUP_DATABASE_URL;
  if (!urlsRaw || !PgClient) return [] as any[];
  const urls = urlsRaw.split(",").map(s => s.trim()).filter(Boolean);
  return urls.map(u => ({ connectionString: u }));
};

class MirroredStorage implements IStorage {
  primary: IStorage;
  backups: any[];
  backupConnected: Record<string, boolean> = {};

  constructor(primary: IStorage) {
    this.primary = primary;
    // store backup connection descriptors (we'll pass the connection string to the durable queue)
    this.backups = createBackupClients();
    for (const client of this.backups) {
      this.backupConnected[client.connectionString || client.connectionParameters?.connectionString || '<unknown>'] = false;
    }
  }

  // helper to mirror write operations by capturing SQL and params then enqueueing tasks
  async mirror(fn: (collector: { query: (sql: string, params?: any[]) => Promise<any> }) => Promise<any>) {
    // collector records the last SQL and params
    const collector: any = { _sql: null, _params: null, query(sql: any, params?: any) { this._sql = sql; this._params = params || []; return Promise.resolve(); } };
    try {
      await fn(collector);
    } catch (e) {
      // ignore errors from collector run
    }
    const sql = collector._sql;
    const params = collector._params || [];
    if (!sql) return;
    for (const c of this.backups) {
      const conn = c.connectionString || c.connectionParameters?.connectionString || String(c);
      backupQueue.enqueue(conn, sql, params);
    }
  }

  // Below - delegate reads/writes to primary, but mirror writes to backups asynchronously
  async getBooks() { return this.primary.getBooks(); }
  async getBook(id: string) { return this.primary.getBook(id); }
  async createBook(insertBook: any) {
    const result = await this.primary.createBook(insertBook);
    // mirror insert to backups
    this.mirror(async (client) => {
      await client.query(`INSERT INTO books (id,title,description,price,cover_image,download_url,category,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [result.id, result.title, result.description, result.price, result.coverImage, result.downloadUrl, result.category, result.createdAt]);
    });
    return result;
  }

  async updateBook(id: string, updateData: any) {
    const result = await this.primary.updateBook(id, updateData);
    if (result) {
      this.mirror(async (client) => {
        await client.query(`UPDATE books SET title=$1,description=$2,price=$3,cover_image=$4,download_url=$5,category=$6 WHERE id=$7`,
          [result.title, result.description, result.price, result.coverImage, result.downloadUrl, result.category, id]);
      });
    }
    return result;
  }

  async deleteBook(id: string) {
    await this.primary.deleteBook(id);
    this.mirror(async (client) => {
      await client.query(`DELETE FROM books WHERE id=$1`, [id]);
    });
  }

  // Orders
  async getOrders() { return this.primary.getOrders(); }
  async getOrder(id: string) { return this.primary.getOrder(id); }
  async createOrder(insertOrder: any) {
    const result = await this.primary.createOrder(insertOrder);
    this.mirror(async (client) => {
      await client.query(`INSERT INTO orders (id,customer_email,total_amount,status,created_at) VALUES ($1,$2,$3,$4,$5)`,
        [result.id, result.customerEmail, result.totalAmount, result.status, result.createdAt]);
    });
    return result;
  }
  async updateOrderStatus(id: string, status: "pending" | "completed" | "refunded") {
    await this.primary.updateOrderStatus(id, status);
    this.mirror(async (client) => {
      await client.query(`UPDATE orders SET status=$1 WHERE id=$2`, [status, id]);
    });
  }

  // Order Items
  async createOrderItem(insertItem: any) {
    const result = await this.primary.createOrderItem(insertItem);
    this.mirror(async (client) => {
      await client.query(`INSERT INTO order_items (id,order_id,book_id,quantity,price) VALUES ($1,$2,$3,$4,$5)`,
        [result.id, result.orderId, result.bookId, result.quantity, result.price]);
    });
    return result;
  }
  async getOrderItems(orderId: string) { return this.primary.getOrderItems(orderId); }

  // Transactions
  async getTransactions() { return this.primary.getTransactions(); }
  async getTransaction(id: string) { return this.primary.getTransaction(id); }
  async createTransaction(insertTransaction: any) {
    const result = await this.primary.createTransaction(insertTransaction);
    this.mirror(async (client) => {
      await client.query(`INSERT INTO transactions (id,order_id,amount,payment_method,status,payment_intent_id,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [result.id, result.orderId, result.amount, result.paymentMethod, result.status, result.paymentIntentId, result.createdAt]);
    });
    return result;
  }
  async updateTransactionStatus(id: string, status: "pending" | "completed" | "failed" | "refunded") { 
    await this.primary.updateTransactionStatus(id, status as any);
    this.mirror(async (client) => { await client.query(`UPDATE transactions SET status=$1 WHERE id=$2`, [status, id]); }); 
  }

  // Admin
  async getAdminByUsername(username: string) { return this.primary.getAdminByUsername(username); }
  async createAdmin(insertAdmin: any) { const result = await this.primary.createAdmin(insertAdmin); this.mirror(async (client) => { await client.query(`INSERT INTO admins (id,username,password,created_at) VALUES ($1,$2,$3,$4)`, [result.id, result.username, result.password, result.createdAt]); }); return result; }

  // Wallet Transactions
  async getWalletTransactions() { return this.primary.getWalletTransactions(); }
  async createWalletTransaction(insertTransaction: any) { const result = await this.primary.createWalletTransaction(insertTransaction); this.mirror(async (client) => { await client.query(`INSERT INTO wallet_transactions (id,type,amount,status,bank_account_info,description,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [result.id, result.type, result.amount, result.status, result.bankAccountInfo, result.description, result.createdAt]); }); return result; }
  async getWalletBalance() { return this.primary.getWalletBalance(); }

  // helper to report backup status
  backupStatus() {
    return { backups: this.backups.map(c => ({ conn: c.connectionParameters?.connectionString || '<unknown>', connected: !!this.backupConnected[c.connectionParameters?.connectionString || '<unknown>'] })) };
  }
}

// Build final storage: primary (DatabaseStorage or Sqlite/InMemory) and wrap with MirroredStorage if BACKUP_DATABASE_URL(S) provided
const primaryStorage: IStorage = process.env.DATABASE_URL ? new DatabaseStorage() : ((): IStorage => {
  if (BetterSqlite3) {
    try {
      const dbPath = path.resolve(process.cwd(), '.data', 'dev.sqlite');
      console.log('Using persistent sqlite at', dbPath);
      const s = new SqliteStorage(dbPath);
      s.seedSampleData().catch((e) => console.error('Failed to seed sqlite storage:', e));
      return s;
    } catch (e) {
      console.error('Failed to initialize sqlite storage, falling back to in-memory:', e);
    }
  }
  console.warn('DATABASE_URL not set — using in-memory storage for development');
  const s = new InMemoryStorage();
  s.seedSampleData().catch((e) => console.error('Failed to seed in-memory storage:', e));
  return s;
})();

export const storage: IStorage = (process.env.BACKUP_DATABASE_URLS || process.env.BACKUP_DATABASE_URL)
  ? new MirroredStorage(primaryStorage)
  : primaryStorage;

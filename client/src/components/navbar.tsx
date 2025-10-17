import { ThemeToggle } from "./theme-toggle";
import { ShoppingCartSheet } from "./shopping-cart";
import { BookOpen } from "lucide-react";
import { Link } from "wouter";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4 md:px-6">
        <Link href="/">
          <a className="flex items-center gap-2 font-bold text-xl hover-elevate px-3 py-2 rounded-md -ml-3" data-testid="link-home">
            <BookOpen className="h-6 w-6" />
            <span>Digital Books</span>
          </a>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <ShoppingCartSheet />
        </div>
      </div>
    </header>
  );
}

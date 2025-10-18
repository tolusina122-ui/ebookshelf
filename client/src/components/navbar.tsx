import { ThemeToggle } from "./theme-toggle";
import { ShoppingCart } from "./shopping-cart";
import { ShoppingCart as ShoppingCartIcon } from "lucide-react";
import { useCartStore } from "@/lib/cart-store";
import { Link } from "wouter";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "./ui/button";

export function Navbar() {
  const getTotalItems = useCartStore((state) => state.getTotalItems);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center space-x-2">
          <span className="text-xl font-bold">BookStore</span>
        </Link>

        <div className="flex items-center space-x-4">
          <ThemeToggle />
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="relative">
                <ShoppingCartIcon className="h-5 w-5" />
                {getTotalItems() > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-xs text-primary-foreground flex items-center justify-center">
                    {getTotalItems()}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-lg">
              <ShoppingCart />
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}